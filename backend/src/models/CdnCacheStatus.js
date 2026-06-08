const pool = require('../db/mysql');

class CdnCacheStatus {
  static async getStatus(nodeId, region) {
    const [rows] = await pool.query(
      'SELECT * FROM cdn_cache_status WHERE node_id = ? AND region = ?',
      [nodeId, region]
    );
    return rows[0] || null;
  }

  static async getStatusForNodes(nodeIds, region) {
    if (!nodeIds || nodeIds.length === 0) return [];
    const placeholders = nodeIds.map(() => '?').join(',');
    const [rows] = await pool.query(
      `SELECT * FROM cdn_cache_status 
       WHERE node_id IN (${placeholders}) AND region = ?`,
      [...nodeIds, region]
    );
    return rows;
  }

  static async recordHit(nodeId, region) {
    const existing = await this.getStatus(nodeId, region);
    if (existing) {
      await pool.query(
        `UPDATE cdn_cache_status 
         SET hit_count = hit_count + 1, last_hit_at = NOW(), is_cached = 1 
         WHERE node_id = ? AND region = ?`,
        [nodeId, region]
      );
    } else {
      await pool.query(
        `INSERT INTO cdn_cache_status (node_id, region, is_cached, hit_count, miss_count, last_hit_at) 
         VALUES (?, ?, 1, 1, 0, NOW())`,
        [nodeId, region]
      );
    }
    return true;
  }

  static async recordMiss(nodeId, region) {
    const existing = await this.getStatus(nodeId, region);
    if (existing) {
      await pool.query(
        `UPDATE cdn_cache_status SET miss_count = miss_count + 1 WHERE node_id = ? AND region = ?`,
        [nodeId, region]
      );
    } else {
      await pool.query(
        `INSERT INTO cdn_cache_status (node_id, region, is_cached, hit_count, miss_count) 
         VALUES (?, ?, 0, 0, 1)`,
        [nodeId, region]
      );
    }
    return true;
  }

  static async setCached(nodeId, region, isCached) {
    const existing = await this.getStatus(nodeId, region);
    if (existing) {
      await pool.query(
        'UPDATE cdn_cache_status SET is_cached = ? WHERE node_id = ? AND region = ?',
        [isCached ? 1 : 0, nodeId, region]
      );
    } else {
      await pool.query(
        `INSERT INTO cdn_cache_status (node_id, region, is_cached, hit_count, miss_count) 
         VALUES (?, ?, ?, 0, 0)`,
        [nodeId, region, isCached ? 1 : 0]
      );
    }
    return true;
  }

  static async getTopCachedNodes(region, limit = 10) {
    const [rows] = await pool.query(
      `SELECT * FROM cdn_cache_status 
       WHERE region = ? AND is_cached = 1 
       ORDER BY hit_count DESC 
       LIMIT ?`,
      [region, limit]
    );
    return rows;
  }

  static async getCacheHitRate(region) {
    const [rows] = await pool.query(
      `SELECT 
        SUM(hit_count) as total_hits,
        SUM(miss_count) as total_misses,
        SUM(hit_count) / (SUM(hit_count) + SUM(miss_count)) as hit_rate
       FROM cdn_cache_status 
       WHERE region = ?`,
      [region]
    );
    return rows[0] || { total_hits: 0, total_misses: 0, hit_rate: 0 };
  }
}

module.exports = CdnCacheStatus;
