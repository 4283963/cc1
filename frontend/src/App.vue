<template>
  <div class="drama-page">
    <header class="page-header">
      <div class="header-left">
        <h1 class="app-title">🎬 互动短剧</h1>
        <span class="app-subtitle">选择你的剧情走向</span>
      </div>
      <div class="header-right">
        <div class="personality-badge" v-if="dramaStore.personality?.dominant_trait">
          <span class="p-color" :style="{ background: dramaStore.danmakuColor }"></span>
          <span class="p-name">{{ dominantTraitName }}</span>
        </div>
        <div class="region-badge" v-if="dramaStore.region">
          <span class="region-dot"></span>
          {{ dramaStore.region }} CDN
        </div>
        <div class="user-info">
          <span class="user-id">{{ dramaStore.userId.slice(0, 10) }}...</span>
        </div>
      </div>
    </header>

    <main class="page-main">
      <div class="player-section">
        <div class="player-wrapper">
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
          
          <div class="danmaku-overlay">
            <DramaDanmaku
              ref="danmakuRef"
              :danmaku-list="dramaStore.danmakuList"
              :current-time="currentTime"
              :show-input="showDanmakuInput"
              :auto-play="true"
              @send="onDanmakuSend"
            />
          </div>

          <button 
            class="danmaku-toggle-btn" 
            @click="showDanmakuInput = !showDanmakuInput"
          >
            {{ showDanmakuInput ? '隐藏弹幕' : '显示弹幕' }}
          </button>
        </div>

        <div class="info-cards">
          <div class="info-card">
            <div class="info-card-title">当前剧情</div>
            <div class="info-card-content">
              <h4>{{ dramaStore.currentNode?.title || '加载中...' }}</h4>
              <p v-if="dramaStore.currentNode?.description">{{ dramaStore.currentNode.description }}</p>
            </div>
          </div>

          <div class="info-card">
            <div class="info-card-title">我的性格画像</div>
            <div class="personality-info" v-if="dramaStore.personality && dramaStore.personality.traits?.length">
              <div class="personality-dominant">
                <span class="p-label">主导</span>
                <span class="p-value" :style="{ color: dramaStore.danmakuColor }">
                  {{ dominantTraitName }}
                </span>
              </div>
              <div class="personality-bars">
                <div 
                  v-for="trait in dramaStore.personality.traits.slice(0, 3)" 
                  :key="trait.trait_key"
                  class="p-bar-row"
                >
                  <span class="p-bar-name">{{ trait.trait_name }}</span>
                  <div class="p-bar-bg">
                    <div 
                      class="p-bar-fill" 
                      :style="{ 
                        width: (trait.score / maxTraitScore * 100) + '%',
                        background: trait.color 
                      }"
                    ></div>
                  </div>
                </div>
              </div>
            </div>
            <div class="no-personality" v-else>
              <p>多做几个选择，系统会生成你的专属性格画像~</p>
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

    <BattleReport
      v-if="showBattleReport && dramaStore.battleReport"
      :report="dramaStore.battleReport"
      :visible="showBattleReport"
      @close="showBattleReport = false"
    />

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
import DramaDanmaku from './components/DramaDanmaku.vue'
import BattleReport from './components/BattleReport.vue'

const dramaStore = useDramaStore()

const playerRef = ref(null)
const danmakuRef = ref(null)
const isInitializing = ref(true)
const currentTime = ref(0)
const nodeTimestamps = ref([45])
const showDanmakuInput = ref(true)
const showBattleReport = ref(false)
const hasTriggeredEnding = ref(false)

const traitNameMap = {
  brave: '勇敢型',
  cowardly: '苟活型',
  violent: '暴躁型',
  peaceful: '佛系型',
  smart: '机智型',
  reckless: '鲁莽型',
  kind: '善良型',
  cunning: '狡诈型',
}

const currentVideoUrl = computed(() => {
  return dramaStore.currentNode?.video_url || ''
})

const dominantTraitName = computed(() => {
  const key = dramaStore.dominantTrait
  return traitNameMap[key] || key || '未知'
})

const maxTraitScore = computed(() => {
  const traits = dramaStore.personality?.traits || []
  if (traits.length === 0) return 10
  return Math.max(...traits.map(t => t.score || 0), 10)
})

async function initDrama() {
  isInitializing.value = true
  try {
    await Promise.all([
      dramaStore.fetchContinueWatching(),
      dramaStore.fetchUserHistory(),
      dramaStore.fetchDramaTree(),
      dramaStore.fetchPersonality(),
    ])

    if (dramaStore.currentNode) {
      await loadNodeDetail(dramaStore.currentNodeId)
      await loadDanmakuList(dramaStore.currentNodeId)
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

async function loadDanmakuList(nodeId) {
  if (!nodeId) return
  await dramaStore.fetchDanmakuList(nodeId)
}

function onTimeUpdate(time) {
  currentTime.value = time
}

function onBranchTrigger(timestamp) {
  console.log(`触发分支选项，时间点: ${timestamp}s`)
}

async function onSelectBranch(option) {
  hasTriggeredEnding.value = false
  
  await loadNodeDetail(option.to_node_id)
  await loadDanmakuList(option.to_node_id)
  
  await dramaStore.fetchPersonality()
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
    hasTriggeredEnding.value = false
    
    await loadNodeDetail(node.id)
    await loadDanmakuList(node.id)
  }
}

function onDanmakuSend(danmaku) {
  console.log('弹幕已发送:', danmaku)
}

async function checkEndingAndGenerateReport() {
  if (!dramaStore.currentNode?.is_ending || hasTriggeredEnding.value) return
  
  hasTriggeredEnding.value = true
  
  setTimeout(async () => {
    try {
      await dramaStore.fetchBattleReport()
      if (dramaStore.battleReport) {
        showBattleReport.value = true
      }
    } catch (err) {
      console.error('生成战报失败:', err)
    }
  }, 2000)
}

async function restartDrama() {
  showBattleReport.value = false
  hasTriggeredEnding.value = false
  dramaStore.clearBattleReport()
  dramaStore.clearPreloadedVideos()
  await initDrama()
}

watch(() => dramaStore.currentNode, (newNode) => {
  if (newNode?.is_ending) {
    checkEndingAndGenerateReport()
  }
}, { deep: true })

onMounted(() => {
  initDrama()
})
</script>

<style scoped>
.drama-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%);
  padding: 20px;
  position: relative;
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
  gap: 12px;
}

.personality-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 20px;
}

.p-color {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  box-shadow: 0 0 6px currentColor;
}

.p-name {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
  font-weight: 500;
}

.region-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #4caf50;
  background: rgba(76, 175, 80, 0.15);
  padding: 6px 12px;
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

.user-info {
  background: rgba(255, 255, 255, 0.08);
  padding: 6px 12px;
  border-radius: 20px;
}

.user-id {
  font-family: monospace;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
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

.player-wrapper {
  position: relative;
  border-radius: 12px;
  overflow: hidden;
}

.danmaku-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 5;
}

.danmaku-toggle-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 6;
  padding: 6px 14px;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 20px;
  color: white;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.danmaku-toggle-btn:hover {
  background: rgba(102, 126, 234, 0.4);
  border-color: rgba(102, 126, 234, 0.6);
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

.personality-info {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.personality-dominant {
  display: flex;
  align-items: center;
  gap: 8px;
}

.p-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  background: rgba(255, 255, 255, 0.08);
  padding: 2px 8px;
  border-radius: 10px;
}

.p-value {
  font-size: 18px;
  font-weight: 700;
}

.personality-bars {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.p-bar-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.p-bar-name {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
  width: 48px;
  flex-shrink: 0;
}

.p-bar-bg {
  flex: 1;
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  overflow: hidden;
}

.p-bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.5s ease;
}

.no-personality {
  text-align: center;
  padding: 20px 0;
}

.no-personality p {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  line-height: 1.6;
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
