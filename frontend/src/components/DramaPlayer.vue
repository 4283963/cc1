<template>
  <div class="drama-player" ref="playerContainer">
    <div class="video-wrapper">
      <video
        ref="videoEl"
        class="main-video"
        :src="currentVideoUrl"
        @timeupdate="onTimeUpdate"
        @loadedmetadata="onLoadedMetadata"
        @play="onPlay"
        @pause="onPause"
        @ended="onEnded"
        @seeking="onSeeking"
        playsinline
        webkit-playsinline
      ></video>

      <div class="video-overlay" v-if="showControls || !isPlaying">
        <div class="play-button" v-if="!isPlaying" @click="togglePlay">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z"/>
          </svg>
        </div>
      </div>

      <div class="controls" v-show="showControls" @click.stop>
        <div class="progress-bar" @click="seekTo">
          <div class="progress-bg">
            <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
            <div class="progress-buffered" :style="{ width: bufferedPercent + '%' }"></div>
          </div>
          <div class="progress-handle" :style="{ left: progressPercent + '%' }"></div>
          <div
            v-for="ts in visibleTimestamps"
            :key="ts"
            class="timestamp-marker"
            :style="{ left: (ts / duration * 100) + '%' }"
            :title="'埋点: ' + formatTime(ts)"
          ></div>
        </div>

        <div class="controls-row">
          <div class="controls-left">
            <button class="ctrl-btn" @click="togglePlay">
              <svg v-if="isPlaying" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
              </svg>
              <svg v-else viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </button>

            <div class="time-display">
              <span>{{ formatTime(currentTime) }}</span>
              <span class="time-separator">/</span>
              <span>{{ formatTime(duration) }}</span>
            </div>
          </div>

          <div class="controls-right">
            <div class="node-info">
              <span class="node-title">{{ currentNode?.title || '' }}</span>
            </div>
            <button class="ctrl-btn" @click="toggleFullscreen">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <transition name="fade">
        <div class="branch-options" v-if="showBranchOptions && branchOptions.length > 0">
          <div class="branch-title">请选择你的剧情走向</div>
          <div class="branch-buttons">
            <button
              v-for="(option, index) in branchOptions"
              :key="option.id"
              class="branch-btn"
              :class="'branch-' + (index + 1)"
              @click="selectBranch(option)"
            >
              <span class="option-label">{{ option.option_label || String.fromCharCode(65 + index) }}</span>
              <span class="option-text">{{ option.option_text }}</span>
              <span class="option-badge" v-if="option.cdn_info?.is_cached">
                <span class="badge-dot"></span>
                极速加载
              </span>
            </button>
          </div>
        </div>
      </transition>

      <div class="ending-banner" v-if="isEnding && isPlaying">
        <div class="ending-content">
          <div class="ending-label">结局</div>
          <div class="ending-title">{{ currentNode?.title }}</div>
          <button class="restart-btn" @click="$emit('restart')">
            重新开始
          </button>
        </div>
      </div>

      <transition name="fade">
        <div class="loading-overlay" v-if="isLoading">
          <div class="loading-spinner"></div>
          <span class="loading-text">加载中...</span>
        </div>
      </transition>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useDramaStore } from '../stores/drama'

const props = defineProps({
  videoUrl: {
    type: String,
    default: '',
  },
  currentNode: {
    type: Object,
    default: null,
  },
  timestamps: {
    type: Array,
    default: () => [],
  },
  isLoading: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['time-update', 'branch-trigger', 'select-branch', 'restart', 'play', 'pause'])

const dramaStore = useDramaStore()

const playerContainer = ref(null)
const videoEl = ref(null)
const currentTime = ref(0)
const duration = ref(0)
const bufferedPercent = ref(0)
const isPlaying = ref(false)
const showControls = ref(true)
const showBranchOptions = ref(false)
const triggeredTimestamps = ref(new Set())
const controlsTimer = ref(null)

const branchOptions = computed(() => dramaStore.branchOptions)

const currentVideoUrl = computed(() => props.videoUrl || dramaStore.currentNode?.video_url || '')

const isEnding = computed(() => props.currentNode?.is_ending || dramaStore.currentNode?.is_ending || false)

const progressPercent = computed(() => {
  if (duration.value <= 0) return 0
  return (currentTime.value / duration.value) * 100
})

const visibleTimestamps = computed(() => {
  return props.timestamps
    .filter(t => t > 0 && t < duration.value)
    .map(t => t)
})

let hideControlsTimeout = null

function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '00:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

function togglePlay() {
  if (!videoEl.value) return
  if (videoEl.value.paused) {
    videoEl.value.play()
  } else {
    videoEl.value.pause()
  }
}

function onPlay() {
  isPlaying.value = true
  emit('play')
  resetControlsTimer()
}

function onPause() {
  isPlaying.value = false
  emit('pause')
  showControls.value = true
  clearTimeout(hideControlsTimeout)
}

function onLoadedMetadata() {
  duration.value = videoEl.value.duration || 0
}

function onTimeUpdate() {
  if (!videoEl.value) return
  
  currentTime.value = videoEl.value.currentTime
  emit('time-update', currentTime.value)
  
  if (videoEl.value.buffered.length > 0) {
    const bufferedEnd = videoEl.value.buffered.end(videoEl.value.buffered.length - 1)
    bufferedPercent.value = (bufferedEnd / duration.value) * 100
  }
  
  checkTimestamps(currentTime.value)
}

function checkTimestamps(time) {
  props.timestamps.forEach((ts) => {
    if (time >= ts - 0.5 && time <= ts + 0.5 && !triggeredTimestamps.value.has(ts)) {
      triggeredTimestamps.value.add(ts)
      triggerBranchOptions(ts)
    }
  })
}

async function triggerBranchOptions(timestamp) {
  const nodeId = props.currentNode?.id || dramaStore.currentNodeId
  
  if (!nodeId) return
  
  emit('branch-trigger', timestamp)
  
  try {
    await dramaStore.fetchBranchOptions(nodeId, timestamp)
    
    if (dramaStore.branchOptions.length > 0) {
      showBranchOptions.value = true
      if (videoEl.value) {
        videoEl.value.pause()
      }
    }
  } catch (err) {
    console.error('触发分支选项失败:', err)
  }
}

async function selectBranch(option) {
  showBranchOptions.value = false
  
  const preloadedVideo = dramaStore.getPreloadedVideo(option.to_node_id)
  
  emit('select-branch', option)
  
  try {
    await dramaStore.selectBranch(option)
    
    await nextTick()
    
    if (preloadedVideo && videoEl.value) {
      videoEl.value.src = option.video_url
      videoEl.value.load()
      
      videoEl.value.play().catch(err => {
        console.warn('自动播放失败:', err)
      })
    }
    
    triggeredTimestamps.value.clear()
    
    currentTime.value = 0
  } catch (err) {
    console.error('切换分支失败:', err)
  }
}

function onEnded() {
  isPlaying.value = false
}

function onSeeking() {
  showControls.value = true
  resetControlsTimer()
}

function seekTo(event) {
  if (!videoEl.value || !duration.value) return
  
  const rect = event.currentTarget.getBoundingClientRect()
  const percent = (event.clientX - rect.left) / rect.width
  const newTime = percent * duration.value
  
  videoEl.value.currentTime = newTime
}

function toggleFullscreen() {
  if (!playerContainer.value) return
  
  if (!document.fullscreenElement) {
    playerContainer.value.requestFullscreen?.() ||
    playerContainer.value.webkitRequestFullscreen?.()
  } else {
    document.exitFullscreen?.() ||
    document.webkitExitFullscreen?.()
  }
}

function resetControlsTimer() {
  showControls.value = true
  clearTimeout(hideControlsTimeout)
  if (isPlaying.value) {
    hideControlsTimeout = setTimeout(() => {
      if (isPlaying.value && !showBranchOptions.value) {
        showControls.value = false
      }
    }, 3000)
  }
}

function onMouseMove() {
  resetControlsTimer()
}

watch(() => props.videoUrl, (newUrl) => {
  if (newUrl && videoEl.value) {
    triggeredTimestamps.value.clear()
    currentTime.value = 0
    videoEl.value.load()
  }
})

watch(() => props.currentNode, (newNode) => {
  if (newNode) {
    triggeredTimestamps.value.clear()
    showBranchOptions.value = false
  }
})

onMounted(() => {
  if (playerContainer.value) {
    playerContainer.value.addEventListener('mousemove', onMouseMove)
  }
})

onUnmounted(() => {
  clearTimeout(hideControlsTimeout)
  if (playerContainer.value) {
    playerContainer.value.removeEventListener('mousemove', onMouseMove)
  }
})

defineExpose({
  play: () => videoEl.value?.play(),
  pause: () => videoEl.value?.pause(),
  seek: (time) => { if (videoEl.value) videoEl.value.currentTime = time },
  videoElement: videoEl,
})
</script>

<style scoped>
.drama-player {
  width: 100%;
  background: #000;
  border-radius: 12px;
  overflow: hidden;
  position: relative;
}

.video-wrapper {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  background: #000;
}

.main-video {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #000;
}

.video-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.3);
  cursor: pointer;
}

.play-button {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.9);
  color: #333;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
}

.play-button:hover {
  transform: scale(1.1);
  background: #fff;
}

.play-button svg {
  width: 36px;
  height: 36px;
}

.controls {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 16px 20px;
  background: linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%);
  transition: opacity 0.3s ease;
}

.progress-bar {
  width: 100%;
  height: 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  position: relative;
}

.progress-bg {
  width: 100%;
  height: 4px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 2px;
  position: relative;
  overflow: hidden;
}

.progress-buffered {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  background: rgba(255, 255, 255, 0.4);
  transition: width 0.3s ease;
}

.progress-fill {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  background: linear-gradient(90deg, #667eea, #764ba2);
  border-radius: 2px;
  transition: width 0.1s linear;
}

.progress-handle {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 12px;
  height: 12px;
  background: #fff;
  border-radius: 50%;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.progress-bar:hover .progress-handle {
  opacity: 1;
}

.timestamp-marker {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 8px;
  height: 8px;
  background: #ff6b6b;
  border-radius: 50%;
  z-index: 1;
}

.controls-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 12px;
}

.controls-left,
.controls-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.ctrl-btn {
  background: transparent;
  border: none;
  color: #fff;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.2s ease;
}

.ctrl-btn:hover {
  opacity: 0.8;
}

.ctrl-btn svg {
  width: 24px;
  height: 24px;
}

.time-display {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.9);
  font-variant-numeric: tabular-nums;
}

.time-separator {
  margin: 0 4px;
  opacity: 0.6;
}

.node-info {
  display: flex;
  align-items: center;
}

.node-title {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.9);
  font-weight: 500;
}

.branch-options {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  z-index: 10;
}

.branch-title {
  font-size: 24px;
  font-weight: 600;
  color: #fff;
  margin-bottom: 32px;
  text-shadow: 0 2px 8px rgba(0,0,0,0.5);
}

.branch-buttons {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  max-width: 400px;
  padding: 0 20px;
}

.branch-btn {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px 24px;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.9) 0%, rgba(118, 75, 162, 0.9) 100%);
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 12px;
  color: white;
  font-size: 18px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.branch-btn::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 50%);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.branch-btn:hover {
  transform: translateY(-3px) scale(1.02);
  border-color: rgba(255, 255, 255, 0.6);
  box-shadow: 0 8px 32px rgba(102, 126, 234, 0.5);
}

.branch-btn:hover::before {
  opacity: 1;
}

.branch-btn:active {
  transform: translateY(-1px) scale(1.01);
}

.option-label {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: rgba(255, 255, 255, 0.25);
  border-radius: 8px;
  font-size: 16px;
  font-weight: 700;
  flex-shrink: 0;
}

.option-text {
  flex: 1;
  text-align: left;
}

.option-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  background: rgba(76, 175, 80, 0.3);
  padding: 4px 10px;
  border-radius: 20px;
  flex-shrink: 0;
}

.badge-dot {
  width: 6px;
  height: 6px;
  background: #4caf50;
  border-radius: 50%;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.ending-banner {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(0,0,0,0.9) 0%, rgba(30,30,30,0.95) 100%);
  z-index: 15;
}

.ending-content {
  text-align: center;
}

.ending-label {
  font-size: 16px;
  color: #888;
  margin-bottom: 12px;
  letter-spacing: 4px;
}

.ending-title {
  font-size: 32px;
  font-weight: 700;
  color: #fff;
  margin-bottom: 32px;
}

.restart-btn {
  padding: 14px 40px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  border-radius: 30px;
  color: white;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
}

.restart-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(102, 126, 234, 0.4);
}

.loading-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  z-index: 20;
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

.loading-text {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.8);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
