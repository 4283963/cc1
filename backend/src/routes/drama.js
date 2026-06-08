const express = require('express');
const DramaController = require('../controllers/dramaController');
const { rateLimitMiddleware } = require('../middleware/rateLimit');
const { userActionLock, idempotentCheck, debounceRequest } = require('../middleware/requestGuard');

const router = express.Router();

const strictRateLimit = rateLimitMiddleware({
  limit: 30,
  window: 60000,
  keyGenerator: (req) => {
    return req.body?.user_id || req.query?.user_id || req.ip;
  },
});

const optionsRateLimit = rateLimitMiddleware({
  limit: 15,
  window: 60000,
  keyGenerator: (req) => {
    return `options:${req.body?.user_id || req.ip}`;
  },
});

const watchRateLimit = rateLimitMiddleware({
  limit: 20,
  window: 60000,
  keyGenerator: (req) => {
    return `watch:${req.body?.user_id || req.ip}`;
  },
});

router.get('/series', DramaController.listSeries);
router.get('/series/:id', DramaController.getSeriesDetail);
router.get('/series/:id/tree', DramaController.getDramaTree);

router.get('/node/:id', DramaController.getNodeDetail);

router.post(
  '/options',
  optionsRateLimit,
  debounceRequest(
    (req) => `options:${req.body?.user_id}:${req.body?.node_id}:${Math.floor(req.body?.timestamp / 5)}`,
    800
  ),
  idempotentCheck(
    (req) => `options:${req.body?.user_id}:${req.body?.node_id}:${Math.floor(req.body?.timestamp / 5)}`,
    { ttl: 5000 }
  ),
  DramaController.getBranchOptions
);

router.post(
  '/watch',
  watchRateLimit,
  debounceRequest(
    (req) => `watch:${req.body?.user_id}:${req.body?.series_id}:${req.body?.node_id}`,
    1000
  ),
  userActionLock('watch', {
    userIdExtractor: (req) => req.body?.user_id,
  }),
  idempotentCheck(
    (req) => `watch:${req.body?.user_id}:${req.body?.series_id}:${req.body?.node_id}`,
    { ttl: 3000 }
  ),
  DramaController.recordWatch
);

router.get('/history', DramaController.getUserHistory);
router.get('/continue', DramaController.continueWatching);

module.exports = router;
