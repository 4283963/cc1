const DramaService = require('../services/dramaService');
const PersonalityService = require('../services/personalityService');
const BattleReportService = require('../services/battleReportService');

class DramaController {
  static async listSeries(req, res, next) {
    try {
      const series = await DramaService.getSeriesList();
      res.json({
        code: 0,
        data: series,
        message: 'success',
      });
    } catch (err) {
      next(err);
    }
  }

  static async getSeriesDetail(req, res, next) {
    try {
      const { id } = req.params;
      const series = await DramaService.getSeriesDetail(id);
      if (!series) {
        return res.status(404).json({ code: 404, message: '剧集不存在' });
      }
      res.json({ code: 0, data: series, message: 'success' });
    } catch (err) {
      next(err);
    }
  }

  static async getNodeDetail(req, res, next) {
    try {
      const { id } = req.params;
      const node = await DramaService.getNodeDetail(id);
      if (!node) {
        return res.status(404).json({ code: 404, message: '节点不存在' });
      }
      res.json({ code: 0, data: node, message: 'success' });
    } catch (err) {
      next(err);
    }
  }

  static async getBranchOptions(req, res, next) {
    try {
      const { user_id, series_id, node_id, timestamp, region } = req.body;
      
      if (!user_id || !series_id || !node_id || timestamp === undefined) {
        return res.status(400).json({
          code: 400,
          message: '缺少必要参数: user_id, series_id, node_id, timestamp',
        });
      }

      const result = await DramaService.getBranchOptions(
        user_id,
        series_id,
        node_id,
        parseInt(timestamp),
        region
      );

      res.json({
        code: 0,
        data: result,
        message: 'success',
      });
    } catch (err) {
      next(err);
    }
  }

  static async recordWatch(req, res, next) {
    try {
      const { user_id, series_id, node_id, region, watch_duration, from_node_id, edge_id } = req.body;
      
      if (!user_id || !series_id || !node_id) {
        return res.status(400).json({
          code: 400,
          message: '缺少必要参数: user_id, series_id, node_id',
        });
      }

      const result = await DramaService.recordUserChoice(
        user_id,
        series_id,
        node_id,
        region,
        watch_duration || 0,
        from_node_id || null,
        edge_id || null
      );

      res.json({
        code: 0,
        data: result,
        message: 'success',
      });
    } catch (err) {
      next(err);
    }
  }

  static async getUserHistory(req, res, next) {
    try {
      const { user_id, series_id } = req.query;
      
      if (!user_id || !series_id) {
        return res.status(400).json({
          code: 400,
          message: '缺少必要参数: user_id, series_id',
        });
      }

      const result = await DramaService.getUserHistory(user_id, series_id);
      res.json({
        code: 0,
        data: result,
        message: 'success',
      });
    } catch (err) {
      next(err);
    }
  }

  static async continueWatching(req, res, next) {
    try {
      const { user_id, series_id } = req.query;
      
      if (!user_id || !series_id) {
        return res.status(400).json({
          code: 400,
          message: '缺少必要参数: user_id, series_id',
        });
      }

      const result = await DramaService.continueWatching(user_id, series_id);
      if (!result) {
        return res.status(404).json({ code: 404, message: '无可用内容' });
      }

      res.json({
        code: 0,
        data: result,
        message: 'success',
      });
    } catch (err) {
      next(err);
    }
  }

  static async getDramaTree(req, res, next) {
    try {
      const { id } = req.params;
      const tree = await DramaService.getDramaTree(id);
      res.json({
        code: 0,
        data: tree,
        message: 'success',
      });
    } catch (err) {
      next(err);
    }
  }

  static async getUserPersonality(req, res, next) {
    try {
      const { user_id, series_id } = req.query;
      
      if (!user_id || !series_id) {
        return res.status(400).json({
          code: 400,
          message: '缺少必要参数: user_id, series_id',
        });
      }

      const personality = await PersonalityService.getUserPersonality(user_id, series_id);
      res.json({
        code: 0,
        data: personality,
        message: 'success',
      });
    } catch (err) {
      next(err);
    }
  }

  static async getTraitList(req, res, next) {
    try {
      const traits = await PersonalityService.getAllTraits();
      res.json({
        code: 0,
        data: traits,
        message: 'success',
      });
    } catch (err) {
      next(err);
    }
  }

  static async sendDanmaku(req, res, next) {
    try {
      const { user_id, series_id, node_id, content, video_time } = req.body;
      
      if (!user_id || !series_id || !node_id || !content) {
        return res.status(400).json({
          code: 400,
          message: '缺少必要参数: user_id, series_id, node_id, content',
        });
      }

      if (content.length > 200) {
        return res.status(400).json({
          code: 400,
          message: '弹幕内容不能超过200字',
        });
      }

      const result = await PersonalityService.sendDanmaku(
        user_id, series_id, node_id, content, video_time || 0
      );

      res.json({
        code: 0,
        data: result,
        message: 'success',
      });
    } catch (err) {
      next(err);
    }
  }

  static async getDanmakuList(req, res, next) {
    try {
      const { node_id, limit } = req.query;
      
      if (!node_id) {
        return res.status(400).json({
          code: 400,
          message: '缺少必要参数: node_id',
        });
      }

      const danmakus = await PersonalityService.getDanmakuList(
        parseInt(node_id),
        parseInt(limit) || 200
      );

      res.json({
        code: 0,
        data: danmakus,
        message: 'success',
      });
    } catch (err) {
      next(err);
    }
  }

  static async getBattleReport(req, res, next) {
    try {
      const { user_id, series_id } = req.query;
      
      if (!user_id || !series_id) {
        return res.status(400).json({
          code: 400,
          message: '缺少必要参数: user_id, series_id',
        });
      }

      const report = await BattleReportService.generateReport(user_id, series_id);
      
      if (report.error === 'no_history') {
        return res.status(400).json({
          code: 400,
          message: '暂无观看历史，无法生成战报',
        });
      }

      res.json({
        code: 0,
        data: report,
        message: 'success',
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = DramaController;
