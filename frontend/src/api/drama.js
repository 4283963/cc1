import axios from 'axios'

const pendingRequests = new Map()

function generateRequestKey(config) {
  const { method, url, data, params } = config
  const dataStr = typeof data === 'string' ? data : JSON.stringify(data || {})
  const paramsStr = JSON.stringify(params || {})
  return `${method}_${url}_${dataStr}_${paramsStr}`
}

function addPendingRequest(config) {
  const key = generateRequestKey(config)
  if (pendingRequests.has(key)) {
    const controller = pendingRequests.get(key)
    controller.abort()
    pendingRequests.delete(key)
  }
  const controller = new AbortController()
  config.signal = controller.signal
  pendingRequests.set(key, controller)
}

function removePendingRequest(config) {
  const key = generateRequestKey(config)
  if (pendingRequests.has(key)) {
    pendingRequests.delete(key)
  }
}

const request = axios.create({
  baseURL: '/api/v1/drama',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

request.interceptors.request.use(
  (config) => {
    addPendingRequest(config)
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

request.interceptors.response.use(
  (response) => {
    removePendingRequest(response.config)
    return response.data
  },
  (error) => {
    if (error.config) {
      removePendingRequest(error.config)
    }
    if (axios.isCancel(error)) {
      console.log('[API] 请求被取消（重复请求自动取消）:', error.message)
      return Promise.reject({ isCancel: true, message: '请求被取消' })
    }
    console.error('[API Error]', error)
    return Promise.reject(error)
  }
)

const lastRequestTimestamps = new Map()

function debounceRequest(key, wait = 300) {
  const now = Date.now()
  const lastTime = lastRequestTimestamps.get(key) || 0
  if (now - lastTime < wait) {
    return false
  }
  lastRequestTimestamps.set(key, now)
  return true
}

export const dramaApi = {
  getSeriesList() {
    return request.get('/series')
  },

  getSeriesDetail(id) {
    return request.get(`/series/${id}`)
  },

  getDramaTree(id) {
    return request.get(`/series/${id}/tree`)
  },

  getNodeDetail(id) {
    return request.get(`/node/${id}`)
  },

  getBranchOptions(params) {
    const key = `options_${params.user_id}_${params.node_id}_${params.timestamp}`
    if (!debounceRequest(key, 500)) {
      return Promise.reject({ isDebounced: true, message: '请求过于频繁，已防抖' })
    }
    return request.post('/options', params)
  },

  recordWatch(params) {
    const key = `watch_${params.user_id}_${params.series_id}_${params.node_id}`
    if (!debounceRequest(key, 800)) {
      return Promise.reject({ isDebounced: true, message: '请求过于频繁，已防抖' })
    }
    return request.post('/watch', params)
  },

  getUserHistory(userId, seriesId) {
    return request.get('/history', {
      params: { user_id: userId, series_id: seriesId },
    })
  },

  continueWatching(userId, seriesId) {
    return request.get('/continue', {
      params: { user_id: userId, series_id: seriesId },
    })
  },
}

export function cancelAllPendingRequests() {
  pendingRequests.forEach((controller) => {
    controller.abort()
  })
  pendingRequests.clear()
}

export default request
