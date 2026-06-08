const pool = require('../db/mysql');

class DramaSeries {
  static async findById(id) {
    const [rows] = await pool.query('SELECT * FROM drama_series WHERE id = ?', [id]);
    return rows[0] || null;
  }

  static async findAll() {
    const [rows] = await pool.query('SELECT * FROM drama_series ORDER BY id DESC');
    return rows;
  }

  static async getRootNode(seriesId) {
    const series = await this.findById(seriesId);
    if (!series) return null;
    if (series.root_node_id) {
      const DramaNode = require('./DramaNode');
      return await DramaNode.findById(series.root_node_id);
    }
    const [rows] = await pool.query(
      'SELECT * FROM drama_nodes WHERE series_id = ? ORDER BY id ASC LIMIT 1',
      [seriesId]
    );
    return rows[0] || null;
  }

  static async getFullTree(seriesId) {
    const DramaNode = require('./DramaNode');
    const nodes = await DramaNode.findBySeries(seriesId);
    const nodeMap = {};
    
    for (const node of nodes) {
      nodeMap[node.id] = { ...node, children: [], edges: [] };
      const edges = await DramaNode.getOutEdges(node.id);
      nodeMap[node.id].edges = edges;
      for (const edge of edges) {
        if (nodeMap[edge.to_node_id]) {
          nodeMap[node.id].children.push(nodeMap[edge.to_node_id]);
        }
      }
    }
    
    const root = await this.getRootNode(seriesId);
    return root ? nodeMap[root.id] : Object.values(nodeMap)[0];
  }
}

module.exports = DramaSeries;
