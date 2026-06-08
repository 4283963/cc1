const pool = require('../db/mysql');

class UserWatchHistory {
  static async recordWatch(userId, seriesId, nodeId, region = null, watchDuration = 0) {
    const [result] = await pool.query(
      `INSERT INTO user_watch_history (user_id, series_id, node_id, region, watch_duration) 
       VALUES (?, ?, ?, ?, ?)`,
      [userId, seriesId, nodeId, region, watchDuration]
    );
    return result.insertId;
  }

  static async getUserHistory(userId, seriesId) {
    const [rows] = await pool.query(
      `SELECT h.*, n.title as node_title, n.video_url 
       FROM user_watch_history h 
       INNER JOIN drama_nodes n ON h.node_id = n.id 
       WHERE h.user_id = ? AND h.series_id = ? 
       ORDER BY h.created_at ASC`,
      [userId, seriesId]
    );
    return rows;
  }

  static async getLastWatchedNode(userId, seriesId) {
    const [rows] = await pool.query(
      `SELECT h.*, n.title as node_title, n.video_url, n.duration, n.is_ending 
       FROM user_watch_history h 
       INNER JOIN drama_nodes n ON h.node_id = n.id 
       WHERE h.user_id = ? AND h.series_id = ? 
       ORDER BY h.created_at DESC 
       LIMIT 1`,
      [userId, seriesId]
    );
    return rows[0] || null;
  }

  static async hasWatchedNode(userId, nodeId) {
    const [rows] = await pool.query(
      'SELECT id FROM user_watch_history WHERE user_id = ? AND node_id = ? LIMIT 1',
      [userId, nodeId]
    );
    return rows.length > 0;
  }

  static async getViewedNodeIds(userId, seriesId) {
    const [rows] = await pool.query(
      'SELECT DISTINCT node_id FROM user_watch_history WHERE user_id = ? AND series_id = ?',
      [userId, seriesId]
    );
    return rows.map(r => r.node_id);
  }
}

module.exports = UserWatchHistory;
