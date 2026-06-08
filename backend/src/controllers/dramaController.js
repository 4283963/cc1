const DramaService = require('../services/dramaService');

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
      const { user_id, series_id, node_id, region, watch_duration } = req.body;
      
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
        watch_duration || 0
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
}

module.exports = DramaController;
