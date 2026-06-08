class UserLockService {
  constructor() {
    this.locks = new Map()
    this.lockTimeout = 5000
    this.cleanupInterval = 60000
    
    setInterval(() => this.cleanup(), this.cleanupInterval)
  }

  _getLockKey(userId, actionType) {
    return `${userId}:${actionType}`
  }

  acquireLock(userId, actionType = 'default') {
    const key = this._getLockKey(userId, actionType)
    const now = Date.now()
    const existing = this.locks.get(key)
    
    if (existing) {
      if (now - existing.acquiredAt < this.lockTimeout) {
        return { acquired: false, reason: 'locked', lock: existing }
      } else {
        console.log(`[UserLock] 锁已过期，自动释放: ${key}`)
      }
    }
    
    const lock = {
      userId,
      actionType,
      acquiredAt: now,
      requestCount: (existing?.requestCount || 0) + 1,
    }
    
    this.locks.set(key, lock)
    return { acquired: true, lock }
  }

  releaseLock(userId, actionType = 'default') {
    const key = this._getLockKey(userId, actionType)
    this.locks.delete(key)
    return true
  }

  isLocked(userId, actionType = 'default') {
    const key = this._getLockKey(userId, actionType)
    const lock = this.locks.get(key)
    if (!lock) return false
    
    const now = Date.now()
    if (now - lock.acquiredAt >= this.lockTimeout) {
      this.locks.delete(key)
      return false
    }
    
    return true
  }

  getLockInfo(userId, actionType = 'default') {
    const key = this._getLockKey(userId, actionType)
    return this.locks.get(key) || null
  }

  cleanup() {
    const now = Date.now()
    let cleaned = 0
    
    for (const [key, lock] of this.locks.entries()) {
      if (now - lock.acquiredAt >= this.lockTimeout) {
        this.locks.delete(key)
        cleaned++
      }
    }
    
    if (cleaned > 0) {
      console.log(`[UserLock] 清理了 ${cleaned} 个过期锁`)
    }
  }

  getLockCount() {
    return this.locks.size
  }
}

const userLockService = new UserLockService()

module.exports = userLockService
