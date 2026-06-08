import { defineStore } from 'pinia'
import { dramaApi } from '../api/drama'

export const useDramaStore = defineStore('drama', {
  state: () => ({
    userId: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    seriesId: 1,
    currentNode: null,
    currentNodeId: null,
    branchOptions: [],
    watchHistory: [],
    viewedNodeIds: [],
    region: null,
    isLoading: false,
    dramaTree: null,
    preloadedVideos: new Map(),
  }),

  getters: {
    hasOptions: (state) => state.branchOptions && state.branchOptions.length > 0,
    isEnding: (state) => state.currentNode?.is_ending || false,
  },

  actions: {
    async fetchContinueWatching() {
      this.isLoading = true
      try {
        const res = await dramaApi.continueWatching(this.userId, this.seriesId)
        if (res.code === 0 && res.data) {
          this.currentNode = {
            id: res.data.node_id,
            video_url: res.data.video_url,
            title: res.data.title,
            is_ending: res.data.is_ending,
          }
          this.currentNodeId = res.data.node_id
        }
        return res.data
      } catch (err) {
        console.error('获取继续观看失败:', err)
        throw err
      } finally {
        this.isLoading = false
      }
    },

    async fetchBranchOptions(nodeId, timestamp) {
      try {
        const res = await dramaApi.getBranchOptions({
          user_id: this.userId,
          series_id: this.seriesId,
          node_id: nodeId,
          timestamp: Math.floor(timestamp),
          region: this.region,
        })
        if (res.code === 0) {
          this.branchOptions = res.data.options || []
          this.region = res.data.region
          this.preloadBranchVideos(res.data.options || [])
        }
        return res.data
      } catch (err) {
        console.error('获取分支选项失败:', err)
        throw err
      }
    },

    async selectBranch(option) {
      this.isLoading = true
      try {
        await dramaApi.recordWatch({
          user_id: this.userId,
          series_id: this.seriesId,
          node_id: option.to_node_id,
          region: this.region,
          watch_duration: 0,
        })

        this.currentNode = {
          id: option.to_node_id,
          video_url: option.video_url,
          title: option.to_node_title,
          is_ending: option.is_ending,
        }
        this.currentNodeId = option.to_node_id
        this.branchOptions = []

        if (!this.viewedNodeIds.includes(option.to_node_id)) {
          this.viewedNodeIds.push(option.to_node_id)
        }

        return option
      } catch (err) {
        console.error('选择分支失败:', err)
        throw err
      } finally {
        this.isLoading = false
      }
    },

    async recordWatch(nodeId, duration) {
      try {
        await dramaApi.recordWatch({
          user_id: this.userId,
          series_id: this.seriesId,
          node_id: nodeId,
          region: this.region,
          watch_duration: duration,
        })
      } catch (err) {
        console.error('记录观看失败:', err)
      }
    },

    async fetchUserHistory() {
      try {
        const res = await dramaApi.getUserHistory(this.userId, this.seriesId)
        if (res.code === 0) {
          this.watchHistory = res.data.history || []
          this.viewedNodeIds = res.data.viewed_node_ids || []
        }
        return res.data
      } catch (err) {
        console.error('获取用户历史失败:', err)
        throw err
      }
    },

    async fetchDramaTree() {
      try {
        const res = await dramaApi.getDramaTree(this.seriesId)
        if (res.code === 0) {
          this.dramaTree = res.data
        }
        return res.data
      } catch (err) {
        console.error('获取剧情树失败:', err)
        throw err
      }
    },

    preloadBranchVideos(options) {
      options.forEach((option) => {
        if (option.video_url && !this.preloadedVideos.has(option.to_node_id)) {
          const video = document.createElement('video')
          video.src = option.video_url
          video.preload = 'auto'
          video.muted = true
          video.playsInline = true
          this.preloadedVideos.set(option.to_node_id, video)
        }
      })
    },

    getPreloadedVideo(nodeId) {
      return this.preloadedVideos.get(nodeId) || null
    },

    clearPreloadedVideos() {
      this.preloadedVideos.forEach((video) => {
        video.src = ''
        video.load()
      })
      this.preloadedVideos.clear()
    },
  },
})
