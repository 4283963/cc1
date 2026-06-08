import axios from 'axios'

const request = axios.create({
  baseURL: '/api/v1/drama',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

request.interceptors.response.use(
  (response) => {
    return response.data
  },
  (error) => {
    console.error('[API Error]', error)
    return Promise.reject(error)
  }
)

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
    return request.post('/options', params)
  },

  recordWatch(params) {
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

export default request
