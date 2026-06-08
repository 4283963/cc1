const pool = require('../db/mysql');

class Danmaku {
  static async create(danmakuData) {
    const { user_id, series_id, node_id, content, color, video_time, personality_trait } = danmakuData;
    const [result] = await pool.query(
      `INSERT INTO danmaku (user_id, series_id, node_id, content, color, video_time, personality_trait) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [user_id, series_id, node_id, content, color || '#ffffff', video_time || 0, personality_trait || null]
    );
    return result.insertId;
  }

  static async getByNode(nodeId, limit = 100) {
    const [rows] = await pool.query(
      `SELECT * FROM danmaku WHERE node_id = ? ORDER BY video_time ASC, created_at ASC LIMIT ?`,
      [nodeId, limit]
    );
    return rows;
  }

  static async getBySeries(seriesId, limit = 500) {
    const [rows] = await pool.query(
      `SELECT * FROM danmaku WHERE series_id = ? ORDER BY created_at DESC LIMIT ?`,
      [seriesId, limit]
    );
    return rows;
  }

  static async getByUser(userId, seriesId = null) {
    if (seriesId) {
      const [rows] = await pool.query(
        `SELECT * FROM danmaku WHERE user_id = ? AND series_id = ? ORDER BY created_at DESC`,
        [userId, seriesId]
      );
      return rows;
    }
    const [rows] = await pool.query(
      `SELECT * FROM danmaku WHERE user_id = ? ORDER BY created_at DESC LIMIT 100`,
      [userId]
    );
    return rows;
  }
}

module.exports = Danmaku;
