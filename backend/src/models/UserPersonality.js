const pool = require('../db/mysql');

class UserPersonality {
  static async findByUser(userId, seriesId) {
    const [rows] = await pool.query(
      'SELECT * FROM user_personality WHERE user_id = ? AND series_id = ?',
      [userId, seriesId]
    );
    return rows[0] || null;
  }

  static async getScores(userId, seriesId) {
    const record = await this.findByUser(userId, seriesId);
    if (!record || !record.trait_scores) {
      return { scores: {}, dominant: null, dominantColor: null, totalChoices: 0 };
    }
    try {
      const scores = JSON.parse(record.trait_scores);
      return {
        scores,
        dominant: record.dominant_trait,
        dominantColor: record.dominant_color,
        totalChoices: record.total_choices || 0,
      };
    } catch (e) {
      return { scores: {}, dominant: null, dominantColor: null, totalChoices: 0 };
    }
  }

  static async updateScores(userId, seriesId, scores, totalChoices, dominantTrait, dominantColor) {
    const scoresJson = JSON.stringify(scores);
    const [result] = await pool.query(
      `INSERT INTO user_personality (user_id, series_id, trait_scores, dominant_trait, dominant_color, total_choices) 
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE 
         trait_scores = VALUES(trait_scores),
         dominant_trait = VALUES(dominant_trait),
         dominant_color = VALUES(dominant_color),
         total_choices = VALUES(total_choices),
         last_updated = NOW()`,
      [userId, seriesId, scoresJson, dominantTrait, dominantColor, totalChoices]
    );
    return result.affectedRows > 0;
  }

  static async addTraitScores(userId, seriesId, traitKeys, colorMap, scorePerTrait = 10) {
    const existing = await this.getScores(userId, seriesId);
    const scores = { ...existing.scores };
    
    for (const key of traitKeys) {
      scores[key] = (scores[key] || 0) + scorePerTrait;
    }
    
    const totalChoices = existing.totalChoices + 1;
    
    let dominantTrait = null;
    let dominantColor = '#ffffff';
    let maxScore = 0;
    
    for (const [key, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        dominantTrait = key;
        dominantColor = colorMap[key]?.color || '#ffffff';
      }
    }
    
    await this.updateScores(userId, seriesId, scores, totalChoices, dominantTrait, dominantColor);
    
    return {
      scores,
      dominant: dominantTrait,
      dominantColor,
      totalChoices,
    };
  }
}

module.exports = UserPersonality;
