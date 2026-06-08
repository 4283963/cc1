const DramaNode = require('../models/DramaNode');
const DramaSeries = require('../models/DramaSeries');
const UserWatchHistory = require('../models/UserWatchHistory');
const CdnService = require('./cdnService');

const branchOptionsCache = new Map();
const BRANCH_OPTIONS_CACHE_TTL = 10000;

const pendingWrites = {
  cdnHits: new Map(),
  cdnMisses: new Map(),
  userWatches: new Set(),
};

let flushTimer = null;
const FLUSH_INTERVAL = 2000;

function startFlushTimer() {
  if (flushTimer) return;
  flushTimer = setInterval(() => {
    flushPendingWrites().catch(err => {
      console.error('[DramaService] 批量写入失败:', err.message);
    });
  }, FLUSH_INTERVAL);
  flushTimer.unref && flushTimer.unref();
}

startFlushTimer();

async function flushPendingWrites() {
  const hitsToFlush = Array.from(pendingWrites.cdnHits.entries());
  const missesToFlush = Array.from(pendingWrites.cdnMisses.entries());
  
  pendingWrites.cdnHits.clear();
  pendingWrites.cdnMisses.clear();
  
  for (const [key, count] of hitsToFlush) {
    try {
      const [nodeId, region] = key.split(':');
      for (let i = 0; i < count; i++) {
        await CdnService.recordCacheHit(parseInt(nodeId), region);
      }
    } catch (err) {
      console.warn('[DramaService] 刷新 CDN hit 失败:', err.message);
    }
  }
  
  for (const [key, count] of missesToFlush) {
    try {
      const [nodeId, region] = key.split(':');
      for (let i = 0; i < count; i++) {
        await CdnService.recordCacheMiss(parseInt(nodeId), region);
      }
    } catch (err) {
      console.warn('[DramaService] 刷新 CDN miss 失败:', err.message);
    }
  }
  
  if (hitsToFlush.length > 0 || missesToFlush.length > 0) {
    console.log(`[DramaService] 批量刷新 CDN 统计: hits=${hitsToFlush.length}, misses=${missesToFlush.length}`);
  }
}

function recordCdnHitAsync(nodeId, region) {
  const key = `${nodeId}:${region}`;
  const current = pendingWrites.cdnHits.get(key) || 0;
  pendingWrites.cdnHits.set(key, current + 1);
}

function recordCdnMissAsync(nodeId, region) {
  const key = `${nodeId}:${region}`;
  const current = pendingWrites.cdnMisses.get(key) || 0;
  pendingWrites.cdnMisses.set(key, current + 1);
}

function getBranchOptionsCacheKey(nodeId, timestamp, region) {
  const roundedTime = Math.floor(timestamp / 5) * 5;
  return `${nodeId}:${roundedTime}:${region}`;
}

function getCachedBranchOptions(nodeId, timestamp, region) {
  const key = getBranchOptionsCacheKey(nodeId, timestamp, region);
  const cached = branchOptionsCache.get(key);
  
  if (!cached) return null;
  
  const now = Date.now();
  if (now - cached.timestamp > BRANCH_OPTIONS_CACHE_TTL) {
    branchOptionsCache.delete(key);
    return null;
  }
  
  return cached.data;
}

function setCachedBranchOptions(nodeId, timestamp, region, data) {
  const key = getBranchOptionsCacheKey(nodeId, timestamp, region);
  
  if (branchOptionsCache.size > 500) {
    const keys = Array.from(branchOptionsCache.keys());
    const toRemove = keys.slice(0, 200);
    toRemove.forEach(k => branchOptionsCache.delete(k));
  }
  
  branchOptionsCache.set(key, {
    data,
    timestamp: Date.now(),
  });
}

class DramaService {
  static async getSeriesList() {
    return await DramaSeries.findAll();
  }

  static async getSeriesDetail(seriesId) {
    return await DramaSeries.findById(seriesId);
  }

  static async getRootNode(seriesId) {
    return await DramaSeries.getRootNode(seriesId);
  }

  static async getNodeDetail(nodeId) {
    const node = await DramaNode.findById(nodeId);
    if (!node) return null;
    
    const timestamps = await DramaNode.getTimestamps(nodeId);
    const edges = await DramaNode.getOutEdges(nodeId);
    
    return {
      ...node,
      timestamps,
      branches: edges,
    };
  }

  static async getDramaTree(seriesId) {
    return await DramaSeries.getFullTree(seriesId);
  }

  static async getBranchOptions(userId, seriesId, currentNodeId, timestamp, userRegion = null) {
    const region = userRegion || CdnService.detectRegion();
    
    const cached = getCachedBranchOptions(currentNodeId, timestamp, region);
    if (cached) {
      console.log(`[DramaService] 分支选项缓存命中: node=${currentNodeId}, ts=${timestamp}`);
      return {
        ...cached,
        from_cache: true,
      };
    }
    
    const currentNode = await DramaNode.findById(currentNodeId);
    if (!currentNode) {
      throw new Error('节点不存在');
    }
    
    let branches = await DramaNode.getBranchOptionsAtTimestamp(currentNodeId, timestamp);
    
    if (branches.length === 0) {
      return {
        current_node: currentNode,
        region,
        options: [],
        is_ending: currentNode.is_ending,
      };
    }
    
    const optimizedBranches = await CdnService.optimizeBranchOrder(branches, region);
    
    const topBranches = optimizedBranches.slice(0, 2);
    
    for (const branch of topBranches) {
      if (branch.cdn_info && branch.cdn_info.is_cached) {
        recordCdnHitAsync(branch.to_node_id, region);
      } else {
        recordCdnMissAsync(branch.to_node_id, region);
        CdnService.preWarmCache(branch.to_node_id, region).catch(err => {
          console.warn('预热缓存失败:', err.message);
        });
      }
    }
    
    const result = {
      current_node: currentNode,
      region,
      timestamp,
      options: topBranches.map(branch => ({
        id: branch.id,
        from_node_id: branch.from_node_id,
        to_node_id: branch.to_node_id,
        option_text: branch.option_text,
        option_label: branch.option_label,
        video_url: branch.video_url,
        to_node_title: branch.to_node_title,
        duration: branch.duration,
        is_ending: branch.is_ending,
        ending_type: branch.ending_type,
        cdn_info: branch.cdn_info,
      })),
      all_branches_count: branches.length,
    };
    
    setCachedBranchOptions(currentNodeId, timestamp, region, result);
    
    return result;
  }

  static async recordUserChoice(userId, seriesId, nodeId, region = null, watchDuration = 0, fromNodeId = null, edgeId = null) {
    const watchKey = `${userId}:${seriesId}:${nodeId}`;
    
    if (pendingWrites.userWatches.has(watchKey)) {
      console.log(`[DramaService] 观看记录已存在，去重: user=${userId}, node=${nodeId}`);
      return {
        idempotent: true,
        user_id: userId,
        series_id: seriesId,
        node_id: nodeId,
        message: 'duplicate request, skipped',
      };
    }
    
    pendingWrites.userWatches.add(watchKey);
    
    setTimeout(() => {
      pendingWrites.userWatches.delete(watchKey);
    }, 5000);
    
    const userRegion = region || CdnService.detectRegion();
    
    const alreadyWatched = await UserWatchHistory.hasWatchedNode(userId, nodeId);
    if (alreadyWatched) {
      return {
        idempotent: true,
        user_id: userId,
        series_id: seriesId,
        node_id: nodeId,
        region: userRegion,
        message: 'already watched, skipped',
      };
    }
    
    const historyId = await UserWatchHistory.recordWatch(
      userId, seriesId, nodeId, userRegion, watchDuration
    );
    
    if (fromNodeId) {
      const PersonalityService = require('./personalityService');
      PersonalityService.recordChoice(userId, seriesId, edgeId, fromNodeId, nodeId).catch(err => {
        console.warn('[DramaService] 更新性格画像失败:', err.message);
      });
    }
    
    return {
      history_id: historyId,
      user_id: userId,
      series_id: seriesId,
      node_id: nodeId,
      region: userRegion,
    };
  }

  static async getUserHistory(userId, seriesId) {
    const history = await UserWatchHistory.getUserHistory(userId, seriesId);
    const lastNode = await UserWatchHistory.getLastWatchedNode(userId, seriesId);
    const viewedIds = await UserWatchHistory.getViewedNodeIds(userId, seriesId);
    
    return {
      history,
      last_node: lastNode,
      viewed_node_ids: viewedIds,
      total_watched: history.length,
    };
  }

  static async continueWatching(userId, seriesId) {
    const lastWatched = await UserWatchHistory.getLastWatchedNode(userId, seriesId);
    if (lastWatched) {
      return {
        node_id: lastWatched.node_id,
        video_url: lastWatched.video_url,
        title: lastWatched.node_title,
        is_ending: lastWatched.is_ending,
        resume_from_history: true,
      };
    }
    
    const rootNode = await DramaSeries.getRootNode(seriesId);
    if (rootNode) {
      return {
        node_id: rootNode.id,
        video_url: rootNode.video_url,
        title: rootNode.title,
        is_ending: rootNode.is_ending,
        resume_from_history: false,
      };
    }
    
    return null;
  }

  static getCacheStats() {
    return {
      branch_options_cache_size: branchOptionsCache.size,
      pending_cdn_hits: pendingWrites.cdnHits.size,
      pending_cdn_misses: pendingWrites.cdnMisses.size,
      pending_user_watches: pendingWrites.userWatches.size,
    };
  }

  static async forceFlush() {
    await flushPendingWrites();
    return true;
  }
}

module.exports = DramaService;
