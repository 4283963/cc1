class RateLimitService {
  constructor(options = {}) {
    this.buckets = new Map()
    this.defaultLimit = options.defaultLimit || 60
    this.defaultWindow = options.defaultWindow || 60000
    this.cleanupInterval = options.cleanupInterval || 60000
    
    setInterval(() => this.cleanup(), this.cleanupInterval)
  }

  _getKey(identifier) {
    return identifier
  }

  hit(identifier, limit = null, window = null) {
    const effectiveLimit = limit || this.defaultLimit
    const effectiveWindow = window || this.defaultWindow
    const key = this._getKey(identifier)
    const now = Date.now()
    
    let bucket = this.buckets.get(key)
    
    if (!bucket || now - bucket.windowStart >= effectiveWindow) {
      bucket = {
        windowStart: now,
        count: 0,
        limit: effectiveLimit,
        window: effectiveWindow,
      }
      this.buckets.set(key, bucket)
    }
    
    bucket.count++
    
    const remaining = Math.max(0, effectiveLimit - bucket.count)
    const resetTime = bucket.windowStart + effectiveWindow
    
    return {
      allowed: bucket.count <= effectiveLimit,
      remaining,
      limit: effectiveLimit,
      resetTime,
      retryAfter: bucket.count > effectiveLimit 
        ? Math.ceil((resetTime - now) / 1000) 
        : 0,
    }
  }

  getInfo(identifier) {
    const key = this._getKey(identifier)
    return this.buckets.get(key) || null
  }

  reset(identifier) {
    const key = this._getKey(identifier)
    return this.buckets.delete(key)
  }

  cleanup() {
    const now = Date.now()
    let cleaned = 0
    
    for (const [key, bucket] of this.buckets.entries()) {
      if (now - bucket.windowStart >= bucket.window * 2) {
        this.buckets.delete(key)
        cleaned++
      }
    }
    
    if (cleaned > 0) {
      console.log(`[RateLimit] 清理了 ${cleaned} 个过期限流桶`)
    }
  }

  getStats() {
    return {
      activeBuckets: this.buckets.size,
    }
  }
}

const rateLimitService = new RateLimitService({
  defaultLimit: 100,
  defaultWindow: 60000,
})

function rateLimitMiddleware(options = {}) {
  const { 
    limit = 60, 
    window = 60000, 
    keyGenerator = null,
    skip = null,
  } = options

  return (req, res, next) => {
    if (skip && skip(req)) {
      return next()
    }

    let identifier
    if (keyGenerator) {
      identifier = keyGenerator(req)
    } else {
      identifier = req.ip || req.headers['x-forwarded-for'] || 'unknown'
    }

    const result = rateLimitService.hit(identifier, limit, window)

    res.set('X-RateLimit-Limit', result.limit)
    res.set('X-RateLimit-Remaining', result.remaining)
    res.set('X-RateLimit-Reset', Math.floor(result.resetTime / 1000))

    if (!result.allowed) {
      res.set('Retry-After', result.retryAfter)
      return res.status(429).json({
        code: 429,
        error: 'Too Many Requests',
        message: `请求过于频繁，请 ${result.retryAfter} 秒后重试`,
        retry_after: result.retryAfter,
      })
    }

    next()
  }
}

module.exports = {
  rateLimitService,
  rateLimitMiddleware,
}
