const userLockService = require('../services/userLockService')
const idempotencyService = require('../services/idempotencyService')

function userActionLock(actionType = 'default', options = {}) {
  const { userIdExtractor = null } = options

  return (req, res, next) => {
    const userId = userIdExtractor 
      ? userIdExtractor(req) 
      : (req.body?.user_id || req.query?.user_id)

    if (!userId) {
      return res.status(400).json({
        code: 400,
        error: 'Bad Request',
        message: '缺少 user_id 参数',
      })
    }

    const lockResult = userLockService.acquireLock(userId, actionType)

    if (!lockResult.acquired) {
      return res.status(429).json({
        code: 429,
        error: 'Too Many Requests',
        message: '操作过于频繁，请稍后再试',
        reason: 'user_locked',
      })
    }

    const originalJson = res.json.bind(res)
    res.json = function(body) {
      userLockService.releaseLock(userId, actionType)
      return originalJson(body)
    }

    const originalEnd = res.end.bind(res)
    res.end = function(...args) {
      userLockService.releaseLock(userId, actionType)
      return originalEnd(...args)
    }

    req.userLock = lockResult.lock
    next()
  }
}

function idempotentCheck(idempotencyKeyGenerator, options = {}) {
  const { ttl = 3000 } = options

  return (req, res, next) => {
    const key = idempotencyKeyGenerator(req)
    
    if (!key) {
      return next()
    }

    const result = idempotencyService.checkAndSet(key, ttl)

    if (result.isDuplicate) {
      return res.status(200).json({
        code: 0,
        data: result.data || null,
        message: 'success',
        idempotent: true,
        repeat_count: result.count,
      })
    }

    const originalJson = res.json.bind(res)
    res.json = function(body) {
      if (body && body.code === 0) {
        idempotencyService.setData(key, body.data)
      }
      return originalJson(body)
    }

    req.idempotencyKey = key
    next()
  }
}

function debounceRequest(keyGenerator, wait = 1000) {
  const lastRequests = new Map()

  return (req, res, next) => {
    const key = keyGenerator(req)
    
    if (!key) {
      return next()
    }

    const now = Date.now()
    const lastTime = lastRequests.get(key) || 0

    if (now - lastTime < wait) {
      return res.status(429).json({
        code: 429,
        error: 'Too Many Requests',
        message: '请求过于频繁，已防抖',
        reason: 'debounced',
        retry_after: Math.ceil((wait - (now - lastTime)) / 1000),
      })
    }

    lastRequests.set(key, now)
    next()
  }
}

module.exports = {
  userActionLock,
  idempotentCheck,
  debounceRequest,
}
