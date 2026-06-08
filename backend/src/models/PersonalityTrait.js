const pool = require('../db/mysql');

class PersonalityTrait {
  static async findAll() {
    const [rows] = await pool.query('SELECT * FROM personality_traits ORDER BY id');
    return rows;
  }

  static async findByKey(traitKey) {
    const [rows] = await pool.query('SELECT * FROM personality_traits WHERE trait_key = ?', [traitKey]);
    return rows[0] || null;
  }

  static async findByKeys(traitKeys) {
    if (!traitKeys || traitKeys.length === 0) return [];
    const placeholders = traitKeys.map(() => '?').join(',');
    const [rows] = await pool.query(
      `SELECT * FROM personality_traits WHERE trait_key IN (${placeholders})`,
      traitKeys
    );
    return rows;
  }

  static async getColorMap() {
    const traits = await this.findAll();
    const colorMap = {};
    for (const t of traits) {
      colorMap[t.trait_key] = {
        name: t.trait_name,
        color: t.color,
        description: t.description,
      };
    }
    return colorMap;
  }
}

module.exports = PersonalityTrait;
