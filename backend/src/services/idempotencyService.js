class IdempotencyService {
  constructor(options = {}) {
    this.cache = new Map()
    this.defaultTtl = options.defaultTtl || 3000
    this.maxSize = options.maxSize || 10000
    this.cleanupInterval = options.cleanupInterval || 60000
    
    setInterval(() => this.cleanup(), this.cleanupInterval)
  }

  _generateKey(...parts) {
    return parts.map(p => String(p)).join(':')
  }

  checkAndSet(key, ttl = null) {
    const effectiveTtl = ttl || this.defaultTtl
    const now = Date.now()
    
    const existing = this.cache.get(key)
    
    if (existing) {
      if (now - existing.timestamp < effectiveTtl) {
        return {
          isDuplicate: true,
          existing: true,
          data: existing.data,
          count: existing.count + 1,
        }
      } else {
        this.cache.delete(key)
      }
    }
    
    if (this.cache.size >= this.maxSize) {
      this.evictOldest()
    }
    
    const entry = {
      key,
      timestamp: now,
      ttl: effectiveTtl,
      count: 1,
      data: null,
    }
    
    this.cache.set(key, entry)
    
    return {
      isDuplicate: false,
      existing: false,
      data: null,
      count: 1,
    }
  }

  setData(key, data) {
    const entry = this.cache.get(key)
    if (entry) {
      entry.data = data
    }
    return entry
  }

  has(key, ttl = null) {
    const effectiveTtl = ttl || this.defaultTtl
    const entry = this.cache.get(key)
    
    if (!entry) return false
    
    const now = Date.now()
    if (now - entry.timestamp >= effectiveTtl) {
      this.cache.delete(key)
      return false
    }
    
    return true
  }

  get(key) {
    return this.cache.get(key) || null
  }

  delete(key) {
    return this.cache.delete(key)
  }

  checkWatch(userId, seriesId, nodeId) {
    const key = this._generateKey('watch', userId, seriesId, nodeId)
    return this.checkAndSet(key, 2000)
  }

  checkOptions(userId, nodeId, timestamp) {
    const key = this._generateKey('options', userId, nodeId, Math.floor(timestamp / 5))
    return this.checkAndSet(key, 3000)
  }

  evictOldest() {
    let oldestKey = null
    let oldestTime = Infinity
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp
        oldestKey = key
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey)
    }
  }

  cleanup() {
    const now = Date.now()
    let cleaned = 0
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp >= entry.ttl) {
        this.cache.delete(key)
        cleaned++
      }
    }
    
    if (cleaned > 0) {
      console.log(`[Idempotency] 清理了 ${cleaned} 条过期记录`)
    }
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
    }
  }
}

const idempotencyService = new IdempotencyService({
  defaultTtl: 3000,
  maxSize: 20000,
})

module.exports = idempotencyService
