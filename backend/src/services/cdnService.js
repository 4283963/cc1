const CdnCacheStatus = require('../models/CdnCacheStatus');

const CDN_REGIONS = (process.env.CDN_REGIONS || 'beijing,shanghai,guangzhou,chengdu').split(',');

class CdnService {
  static getAllRegions() {
    return CDN_REGIONS;
  }

  static detectRegion(userIp = null) {
    const regions = this.getAllRegions();
    const randomIndex = Math.floor(Math.random() * regions.length);
    return regions[randomIndex];
  }

  static async getNodeCacheStatus(nodeId, region) {
    const status = await CdnCacheStatus.getStatus(nodeId, region);
    if (!status) {
      return {
        node_id: nodeId,
        region,
        is_cached: false,
        hit_count: 0,
        miss_count: 0,
        hit_rate: 0,
      };
    }
    const total = status.hit_count + status.miss_count;
    return {
      ...status,
      hit_rate: total > 0 ? (status.hit_count / total) : 0,
    };
  }

  static async getBulkCacheStatus(nodeIds, region) {
    const statuses = await CdnCacheStatus.getStatusForNodes(nodeIds, region);
    const statusMap = {};
    for (const s of statuses) {
      const total = s.hit_count + s.miss_count;
      statusMap[s.node_id] = {
        ...s,
        hit_rate: total > 0 ? (s.hit_count / total) : 0,
      };
    }
    for (const id of nodeIds) {
      if (!statusMap[id]) {
        statusMap[id] = {
          node_id: id,
          region,
          is_cached: false,
          hit_count: 0,
          miss_count: 0,
          hit_rate: 0,
        };
      }
    }
    return statusMap;
  }

  static async recordCacheHit(nodeId, region) {
    await CdnCacheStatus.recordHit(nodeId, region);
  }

  static async recordCacheMiss(nodeId, region) {
    await CdnCacheStatus.recordMiss(nodeId, region);
  }

  static async optimizeBranchOrder(branches, region) {
    if (!branches || branches.length === 0) return [];
    
    const nodeIds = branches.map(b => b.to_node_id);
    const cacheStatusMap = await this.getBulkCacheStatus(nodeIds, region);
    
    const scored = branches.map(branch => {
      const cacheStatus = cacheStatusMap[branch.to_node_id];
      const cacheScore = cacheStatus.is_cached ? 10 : 0;
      const hitRateScore = (cacheStatus.hit_rate || 0) * 5;
      const weightScore = (branch.weight || 0) * 2;
      const totalScore = cacheScore + hitRateScore + weightScore;
      
      return {
        ...branch,
        cdn_info: {
          region,
          is_cached: cacheStatus.is_cached,
          hit_rate: cacheStatus.hit_rate,
          hit_count: cacheStatus.hit_count,
        },
        cdn_score: totalScore,
      };
    });
    
    scored.sort((a, b) => b.cdn_score - a.cdn_score);
    
    return scored;
  }

  static async preWarmCache(nodeId, region) {
    const current = await CdnCacheStatus.getStatus(nodeId, region);
    if (!current || !current.is_cached) {
      await CdnCacheStatus.setCached(nodeId, region, true);
      console.log(`[CDN] 预热缓存: node=${nodeId}, region=${region}`);
    }
    return true;
  }

  static async getCacheStats(region) {
    return await CdnCacheStatus.getCacheHitRate(region);
  }
}

module.exports = CdnService;
