import { defineStore } from 'pinia'
import { dramaApi, cancelAllPendingRequests } from '../api/drama'

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
    isSelectingBranch: false,
    lastSelectedNodeId: null,
    lastBranchSelectTime: 0,
    lastOptionsFetchKey: null,
    personality: null,
    danmakuList: [],
    battleReport: null,
    isLoadingReport: false,
  }),

  getters: {
    hasOptions: (state) => state.branchOptions && state.branchOptions.length > 0,
    isEnding: (state) => state.currentNode?.is_ending || false,
    canSelectBranch: (state) => !state.isSelectingBranch && !state.isLoading,
    danmakuColor: (state) => state.personality?.dominant_color || '#ffffff',
    dominantTrait: (state) => state.personality?.dominant_trait || null,
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
        if (err.isCancel || err.isDebounced) return null
        console.error('获取继续观看失败:', err)
        throw err
      } finally {
        this.isLoading = false
      }
    },

    async fetchBranchOptions(nodeId, timestamp) {
      const fetchKey = `${nodeId}_${Math.floor(timestamp)}`
      if (this.lastOptionsFetchKey === fetchKey && this.branchOptions.length > 0) {
        return { options: this.branchOptions, fromCache: true }
      }

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
          this.lastOptionsFetchKey = fetchKey
          this.preloadBranchVideos(res.data.options || [])
        }
        return res.data
      } catch (err) {
        if (err.isCancel || err.isDebounced) return null
        console.error('获取分支选项失败:', err)
        throw err
      }
    },

    async selectBranch(option) {
      const now = Date.now()
      const DEBOUNCE_MS = 1000

      if (this.isSelectingBranch) {
        console.warn('[DramaStore] 正在切换分支中，忽略重复点击')
        return { skipped: true, reason: 'selecting' }
      }

      if (this.lastSelectedNodeId === option.to_node_id && 
          now - this.lastBranchSelectTime < DEBOUNCE_MS) {
        console.warn('[DramaStore] 短时间内重复选择同一节点，已防抖')
        return { skipped: true, reason: 'debounced' }
      }

      this.isSelectingBranch = true
      this.lastSelectedNodeId = option.to_node_id
      this.lastBranchSelectTime = now

      try {
        const res = await dramaApi.recordWatch({
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
        this.lastOptionsFetchKey = null

        if (!this.viewedNodeIds.includes(option.to_node_id)) {
          this.viewedNodeIds.push(option.to_node_id)
        }

        this.cleanupOldPreloadedVideos(option.to_node_id)

        return option
      } catch (err) {
        if (err.isCancel || err.isDebounced) {
          return { skipped: true, reason: err.isCancel ? 'cancelled' : 'debounced' }
        }
        console.error('选择分支失败:', err)
        throw err
      } finally {
        setTimeout(() => {
          this.isSelectingBranch = false
        }, 300)
      }
    },

    cleanupOldPreloadedVideos(keepNodeId) {
      const toRemove = []
      this.preloadedVideos.forEach((video, nodeId) => {
        if (nodeId !== keepNodeId && nodeId !== this.currentNodeId) {
          try {
            video.pause()
            video.src = ''
            video.load()
            video.removeAttribute('src')
          } catch (e) {
            console.warn('清理预加载视频失败:', e)
          }
          toRemove.push(nodeId)
        }
      })
      toRemove.forEach(id => this.preloadedVideos.delete(id))
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
        if (err.isCancel || err.isDebounced) return
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
        if (err.isCancel || err.isDebounced) return null
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
        if (err.isCancel || err.isDebounced) return null
        console.error('获取剧情树失败:', err)
        throw err
      }
    },

    preloadBranchVideos(options) {
      options.forEach((option) => {
        if (option.video_url && !this.preloadedVideos.has(option.to_node_id)) {
          try {
            const video = document.createElement('video')
            video.src = option.video_url
            video.preload = 'auto'
            video.muted = true
            video.playsInline = true
            video.setAttribute('preload', 'auto')
            this.preloadedVideos.set(option.to_node_id, video)
          } catch (e) {
            console.warn('创建预加载视频失败:', e)
          }
        }
      })
    },

    getPreloadedVideo(nodeId) {
      return this.preloadedVideos.get(nodeId) || null
    },

    clearPreloadedVideos() {
      this.preloadedVideos.forEach((video) => {
        try {
          video.pause()
          video.muted = true
          video.src = ''
          video.load()
          video.removeAttribute('src')
        } catch (e) {
          console.warn('清理预加载视频失败:', e)
        }
      })
      this.preloadedVideos.clear()
    },

    async fetchPersonality() {
      try {
        const res = await dramaApi.getUserPersonality(this.userId, this.seriesId)
        if (res.code === 0) {
          this.personality = res.data
        }
        return res.data
      } catch (err) {
        if (err.isCancel || err.isDebounced) return null
        console.error('获取性格画像失败:', err)
        return null
      }
    },

    async sendDanmaku(content, videoTime = 0) {
      if (!content || !content.trim()) return null
      
      try {
        const res = await dramaApi.sendDanmaku({
          user_id: this.userId,
          series_id: this.seriesId,
          node_id: this.currentNodeId,
          content: content.trim(),
          video_time: Math.floor(videoTime),
        })
        if (res.code === 0) {
          if (res.data.personality_info) {
            this.personality = res.data.personality_info
          }
          this.danmakuList.push(res.data)
          return res.data
        }
        return null
      } catch (err) {
        if (err.isCancel || err.isDebounced) return null
        console.error('发送弹幕失败:', err)
        return null
      }
    },

    async fetchDanmakuList(nodeId) {
      try {
        const targetNodeId = nodeId || this.currentNodeId
        if (!targetNodeId) return []
        
        const res = await dramaApi.getDanmakuList(targetNodeId)
        if (res.code === 0) {
          this.danmakuList = res.data || []
        }
        return this.danmakuList
      } catch (err) {
        if (err.isCancel || err.isDebounced) return []
        console.error('获取弹幕列表失败:', err)
        return []
      }
    },

    addLocalDanmaku(danmaku) {
      this.danmakuList.push(danmaku)
    },

    async fetchBattleReport() {
      this.isLoadingReport = true
      try {
        const res = await dramaApi.getBattleReport(this.userId, this.seriesId)
        if (res.code === 0) {
          this.battleReport = res.data
        }
        return res.data
      } catch (err) {
        if (err.isCancel || err.isDebounced) return null
        console.error('获取战报失败:', err)
        throw err
      } finally {
        this.isLoadingReport = false
      }
    },

    clearBattleReport() {
      this.battleReport = null
      this.isLoadingReport = false
    },

    resetAllState() {
      cancelAllPendingRequests()
      this.clearPreloadedVideos()
      this.isSelectingBranch = false
      this.lastSelectedNodeId = null
      this.lastBranchSelectTime = 0
      this.branchOptions = []
      this.lastOptionsFetchKey = null
      this.personality = null
      this.danmakuList = []
      this.battleReport = null
      this.isLoadingReport = false
    },
  },
})
