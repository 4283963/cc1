require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const dramaRoutes = require('./routes/drama');
const { rateLimitMiddleware } = require('./middleware/rateLimit');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.use(rateLimitMiddleware({
  limit: 120,
  window: 60000,
  keyGenerator: (req) => req.ip || req.headers['x-forwarded-for'] || 'unknown',
}));

app.use('/api/v1/drama', dramaRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/stats', (req, res) => {
  const DramaService = require('./services/dramaService');
  const userLockService = require('./services/userLockService');
  const idempotencyService = require('./services/idempotencyService');
  const { rateLimitService } = require('./middleware/rateLimit');
  
  res.json({
    status: 'ok',
    cache_stats: DramaService.getCacheStats(),
    lock_stats: {
      active_locks: userLockService.getLockCount(),
    },
    idempotency_stats: idempotencyService.getStats(),
    rate_limit_stats: rateLimitService.getStats(),
  });
});

app.use((err, req, res, next) => {
  console.error('[Error]', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
  });
});

app.listen(PORT, () => {
  console.log(`🚀 互动短剧后端服务已启动: http://localhost:${PORT}`);
  console.log(`📍 API 前缀: /api/v1/drama`);
  console.log(`📊 状态监控: /api/stats`);
});

module.exports = app;
