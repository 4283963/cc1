<template>
  <div class="drama-page">
    <header class="page-header">
      <div class="header-left">
        <h1 class="app-title">🎬 互动短剧</h1>
        <span class="app-subtitle">选择你的剧情走向</span>
      </div>
      <div class="header-right">
        <div class="user-info">
          <span class="user-label">用户ID:</span>
          <span class="user-id">{{ dramaStore.userId.slice(0, 15) }}...</span>
        </div>
        <div class="region-badge" v-if="dramaStore.region">
          <span class="region-dot"></span>
          {{ dramaStore.region }} CDN
        </div>
      </div>
    </header>

    <main class="page-main">
      <div class="player-section">
        <DramaPlayer
          ref="playerRef"
          :video-url="currentVideoUrl"
          :current-node="dramaStore.currentNode"
          :timestamps="nodeTimestamps"
          :is-loading="dramaStore.isLoading"
          @time-update="onTimeUpdate"
          @branch-trigger="onBranchTrigger"
          @select-branch="onSelectBranch"
          @restart="restartDrama"
        />

        <div class="info-cards">
          <div class="info-card">
            <div class="info-card-title">当前剧情</div>
            <div class="info-card-content">
              <h4>{{ dramaStore.currentNode?.title || '加载中...' }}</h4>
              <p v-if="dramaStore.currentNode?.description">{{ dramaStore.currentNode.description }}</p>
            </div>
          </div>

          <div class="info-card" v-if="cdnInfo.length > 0">
            <div class="info-card-title">CDN 缓存状态</div>
            <div class="cdn-list">
              <div v-for="info in cdnInfo" :key="info.to_node_id" class="cdn-item">
                <span class="cdn-name">{{ info.option_text }}</span>
                <span class="cdn-status" :class="{ cached: info.cdn_info?.is_cached }">
                  {{ info.cdn_info?.is_cached ? '已缓存' : '未缓存' }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="tree-section">
        <DramaTree
          :tree-data="dramaStore.dramaTree"
          :viewed-node-ids="dramaStore.viewedNodeIds"
          :current-node-id="dramaStore.currentNodeId"
          @node-click="onTreeNodeClick"
        />
      </div>
    </main>

    <div class="loading-init" v-if="isInitializing">
      <div class="loading-spinner"></div>
      <p>正在加载剧情...</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useDramaStore } from './stores/drama'
import { dramaApi } from './api/drama'
import DramaPlayer from './components/DramaPlayer.vue'
import DramaTree from './components/DramaTree.vue'

const dramaStore = useDramaStore()

const playerRef = ref(null)
const isInitializing = ref(true)
const currentTime = ref(0)
const nodeTimestamps = ref([45])

const currentVideoUrl = computed(() => {
  return dramaStore.currentNode?.video_url || ''
})

const cdnInfo = computed(() => {
  return dramaStore.branchOptions.map(opt => ({
    to_node_id: opt.to_node_id,
    option_text: opt.option_text,
    cdn_info: opt.cdn_info,
  }))
})

async function initDrama() {
  isInitializing.value = true
  try {
    await Promise.all([
      dramaStore.fetchContinueWatching(),
      dramaStore.fetchUserHistory(),
      dramaStore.fetchDramaTree(),
    ])

    if (dramaStore.currentNode) {
      await loadNodeDetail(dramaStore.currentNodeId)
    }
  } catch (err) {
    console.error('初始化失败:', err)
  } finally {
    isInitializing.value = false
  }
}

async function loadNodeDetail(nodeId) {
  try {
    const res = await dramaApi.getNodeDetail(nodeId)
    if (res.code === 0 && res.data) {
      if (res.data.timestamps && res.data.timestamps.length > 0) {
        nodeTimestamps.value = res.data.timestamps.map(t => t.timestamp)
      } else if (res.data.branches && res.data.branches.length > 0) {
        const triggerTimes = [...new Set(res.data.branches.map(b => b.trigger_time))]
        nodeTimestamps.value = triggerTimes.sort((a, b) => a - b)
      }
    }
  } catch (err) {
    console.error('加载节点详情失败:', err)
  }
}

function onTimeUpdate(time) {
  currentTime.value = time
}

function onBranchTrigger(timestamp) {
  console.log(`触发分支选项，时间点: ${timestamp}s`)
}

async function onSelectBranch(option) {
  console.log('选择分支:', option)
  await loadNodeDetail(option.to_node_id)
}

async function onTreeNodeClick(node) {
  if (dramaStore.viewedNodeIds.includes(node.id)) {
    dramaStore.currentNode = {
      id: node.id,
      title: node.title,
      video_url: node.video_url,
      is_ending: node.is_ending,
    }
    dramaStore.currentNodeId = node.id
    await loadNodeDetail(node.id)
  }
}

async function restartDrama() {
  dramaStore.clearPreloadedVideos()
  await initDrama()
}

watch(() => dramaStore.currentNodeId, (newId) => {
  if (newId) {
    loadNodeDetail(newId)
  }
})

onMounted(() => {
  initDrama()
})
</script>

<style scoped>
.drama-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%);
  padding: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding: 0 10px;
}

.header-left {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.app-title {
  font-size: 28px;
  font-weight: 700;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.app-subtitle {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.6);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
  background: rgba(255, 255, 255, 0.08);
  padding: 8px 12px;
  border-radius: 20px;
}

.user-label {
  opacity: 0.7;
}

.user-id {
  font-family: monospace;
}

.region-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #4caf50;
  background: rgba(76, 175, 80, 0.15);
  padding: 8px 12px;
  border-radius: 20px;
}

.region-dot {
  width: 8px;
  height: 8px;
  background: #4caf50;
  border-radius: 50%;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.page-main {
  display: grid;
  grid-template-columns: 1fr 350px;
  gap: 20px;
  max-width: 1400px;
  margin: 0 auto;
}

@media (max-width: 1024px) {
  .page-main {
    grid-template-columns: 1fr;
  }
}

.player-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.info-cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

@media (max-width: 640px) {
  .info-cards {
    grid-template-columns: 1fr;
  }
}

.info-card {
  background: #1a1a2e;
  border-radius: 12px;
  padding: 16px;
}

.info-card-title {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 10px;
}

.info-card-content h4 {
  font-size: 16px;
  font-weight: 600;
  color: #fff;
  margin-bottom: 6px;
}

.info-card-content p {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.5;
}

.cdn-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cdn-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 6px;
  font-size: 13px;
}

.cdn-name {
  color: #fff;
}

.cdn-status {
  font-size: 12px;
  color: #ff9800;
  background: rgba(255, 152, 0, 0.15);
  padding: 4px 8px;
  border-radius: 10px;
}

.cdn-status.cached {
  color: #4caf50;
  background: rgba(76, 175, 80, 0.15);
}

.tree-section {
  min-height: 500px;
}

.loading-init {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(15, 15, 26, 0.95);
  z-index: 100;
  gap: 16px;
}

.loading-spinner {
  width: 48px;
  height: 48px;
  border: 4px solid rgba(255, 255, 255, 0.2);
  border-top-color: #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-init p {
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
}
</style>
