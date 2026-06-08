const pool = require('../db/mysql');

class DramaNode {
  static async findById(id) {
    const [rows] = await pool.query('SELECT * FROM drama_nodes WHERE id = ?', [id]);
    return rows[0] || null;
  }

  static async findBySeries(seriesId) {
    const [rows] = await pool.query('SELECT * FROM drama_nodes WHERE series_id = ? ORDER BY id', [seriesId]);
    return rows;
  }

  static async getOutEdges(nodeId) {
    const [rows] = await pool.query(
      `SELECT e.*, n.title as to_node_title, n.video_url, n.duration, n.is_ending 
       FROM drama_edges e 
       INNER JOIN drama_nodes n ON e.to_node_id = n.id 
       WHERE e.from_node_id = ? 
       ORDER BY e.sort_order ASC, e.id ASC`,
      [nodeId]
    );
    return rows;
  }

  static async getInEdges(nodeId) {
    const [rows] = await pool.query(
      `SELECT e.*, n.title as from_node_title 
       FROM drama_edges e 
       INNER JOIN drama_nodes n ON e.from_node_id = n.id 
       WHERE e.to_node_id = ?`,
      [nodeId]
    );
    return rows;
  }

  static async getTimestamps(nodeId) {
    const [rows] = await pool.query(
      'SELECT * FROM video_timestamps WHERE node_id = ? ORDER BY timestamp',
      [nodeId]
    );
    return rows;
  }

  static async getBranchOptionsAtTimestamp(nodeId, timestamp) {
    const [rows] = await pool.query(
      `SELECT e.*, n.title as to_node_title, n.video_url, n.duration, n.is_ending, n.ending_type
       FROM drama_edges e 
       INNER JOIN drama_nodes n ON e.to_node_id = n.id 
       WHERE e.from_node_id = ? AND e.trigger_time <= ?
       ORDER BY e.sort_order ASC, e.weight DESC`,
      [nodeId, timestamp]
    );
    return rows;
  }
}

module.exports = DramaNode;
