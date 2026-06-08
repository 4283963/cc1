const DramaNode = require('../models/DramaNode');
const DramaSeries = require('../models/DramaSeries');
const UserWatchHistory = require('../models/UserWatchHistory');
const CdnService = require('./cdnService');

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
        await CdnService.recordCacheHit(branch.to_node_id, region);
      } else {
        await CdnService.recordCacheMiss(branch.to_node_id, region);
        await CdnService.preWarmCache(branch.to_node_id, region);
      }
    }
    
    return {
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
  }

  static async recordUserChoice(userId, seriesId, nodeId, region = null, watchDuration = 0) {
    const userRegion = region || CdnService.detectRegion();
    
    const historyId = await UserWatchHistory.recordWatch(
      userId, seriesId, nodeId, userRegion, watchDuration
    );
    
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
}

module.exports = DramaService;
