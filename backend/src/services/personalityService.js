const PersonalityTrait = require('../models/PersonalityTrait');
const UserPersonality = require('../models/UserPersonality');
const Danmaku = require('../models/Danmaku');

let colorMapCache = null;
let cacheTime = 0;
const CACHE_TTL = 60000;

class PersonalityService {
  static async getColorMap(forceRefresh = false) {
    const now = Date.now();
    if (colorMapCache && now - cacheTime < CACHE_TTL && !forceRefresh) {
      return colorMapCache;
    }
    
    colorMapCache = await PersonalityTrait.getColorMap();
    cacheTime = now;
    return colorMapCache;
  }

  static async getUserPersonality(userId, seriesId) {
    const colorMap = await this.getColorMap();
    const personality = await UserPersonality.getScores(userId, seriesId);
    
    const traitsWithDetails = [];
    for (const [key, score] of Object.entries(personality.scores)) {
      traitsWithDetails.push({
        trait_key: key,
        trait_name: colorMap[key]?.name || key,
        color: colorMap[key]?.color || '#ffffff',
        score,
        description: colorMap[key]?.description || '',
      });
    }
    
    traitsWithDetails.sort((a, b) => b.score - a.score);
    
    return {
      user_id: userId,
      series_id: seriesId,
      dominant_trait: personality.dominant,
      dominant_color: personality.dominantColor,
      total_choices: personality.totalChoices,
      traits: traitsWithDetails,
    };
  }

  static async recordChoice(userId, seriesId, edgeId, fromNodeId, toNodeId) {
    const colorMap = await this.getColorMap();
    
    const personalityTags = await this.getEdgePersonalityTags(edgeId, fromNodeId, toNodeId);
    
    if (personalityTags.length === 0) {
      return await this.getUserPersonality(userId, seriesId);
    }
    
    const result = await UserPersonality.addTraitScores(
      userId, seriesId, personalityTags, colorMap, 10
    );
    
    return await this.getUserPersonality(userId, seriesId);
  }

  static async getEdgePersonalityTags(edgeId, fromNodeId, toNodeId) {
    const pool = require('../db/mysql');
    
    if (edgeId) {
      const [rows] = await pool.query(
        'SELECT personality_tags FROM drama_edges WHERE id = ?',
        [edgeId]
      );
      if (rows.length > 0 && rows[0].personality_tags) {
        try {
          return JSON.parse(rows[0].personality_tags);
        } catch (e) {
          return [];
        }
      }
    }
    
    if (fromNodeId && toNodeId) {
      const [rows] = await pool.query(
        'SELECT personality_tags FROM drama_edges WHERE from_node_id = ? AND to_node_id = ? LIMIT 1',
        [fromNodeId, toNodeId]
      );
      if (rows.length > 0 && rows[0].personality_tags) {
        try {
          return JSON.parse(rows[0].personality_tags);
        } catch (e) {
          return [];
        }
      }
    }
    
    return [];
  }

  static async sendDanmaku(userId, seriesId, nodeId, content, videoTime = 0) {
    const personality = await this.getUserPersonality(userId, seriesId);
    const color = personality.dominant_color || '#ffffff';
    const dominantTrait = personality.dominant_trait || null;
    
    const danmakuId = await Danmaku.create({
      user_id: userId,
      series_id: seriesId,
      node_id: nodeId,
      content,
      color,
      video_time: videoTime,
      personality_trait: dominantTrait,
    });
    
    return {
      id: danmakuId,
      user_id: userId,
      content,
      color,
      video_time: videoTime,
      personality_trait: dominantTrait,
      personality_info: personality,
    };
  }

  static async getDanmakuList(nodeId, limit = 100) {
    return await Danmaku.getByNode(nodeId, limit);
  }

  static async getAllTraits() {
    return await PersonalityTrait.findAll();
  }
}

module.exports = PersonalityService;
