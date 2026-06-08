<template>
  <div class="drama-danmaku" ref="danmakuContainer">
    <div class="danmaku-layer" ref="danmakuLayer">
      <transition-group name="danmaku-fade">
        <div
          v-for="item in activeDanmakus"
          :key="item.uid"
          class="danmaku-item"
          :style="item.style"
        >
          <span
            class="danmaku-text"
            :style="{ color: item.color }"
          >
            {{ item.content }}
          </span>
          <span v-if="item.personality_trait" class="danmaku-tag" :style="{ background: item.color + '33', color: item.color }">
            {{ item.trait_name || item.personality_trait }}
          </span>
        </div>
      </transition-group>
    </div>

    <div class="danmaku-input-wrap" v-if="showInput">
      <div class="color-indicator" :style="{ background: danmakuColor }">
        <span class="color-dot"></span>
      </div>
      <input
        ref="inputEl"
        v-model="inputText"
        class="danmaku-input"
        type="text"
        placeholder="发送弹幕，会用你的性格专属颜色哦~"
        maxlength="50"
        @keydown.enter="handleSend"
      />
      <button class="send-btn" @click="handleSend" :disabled="!canSend">
        发送
      </button>
    </div>

    <button v-if="!showInput" class="toggle-btn" @click="showInput = true">
      💬 发弹幕
    </button>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useDramaStore } from '../stores/drama'

const props = defineProps({
  showInput: {
    type: Boolean,
    default: true,
  },
  danmakuList: {
    type: Array,
    default: () => [],
  },
  currentTime: {
    type: Number,
    default: 0,
  },
  autoPlay: {
    type: Boolean,
    default: true,
  },
})

const emit = defineEmits(['send'])

const dramaStore = useDramaStore()

const danmakuContainer = ref(null)
const danmakuLayer = ref(null)
const inputEl = ref(null)
const inputText = ref('')
const activeDanmakus = ref([])
const shownDanmakuIds = ref(new Set())
let uidCounter = 0

const danmakuColor = computed(() => dramaStore.danmakuColor)
const dominantTrait = computed(() => dramaStore.dominantTrait)

const canSend = computed(() => {
  return inputText.value.trim().length > 0 && !dramaStore.isSelectingBranch
})

const traitNameMap = {
  brave: '勇敢',
  cowardly: '胆小',
  violent: '暴躁',
  peaceful: '温和',
  smart: '机智',
  reckless: '鲁莽',
  kind: '善良',
  cunning: '狡诈',
}

function getTraitName(key) {
  return traitNameMap[key] || key
}

function getRandomTop() {
  const containerHeight = danmakuLayer.value?.clientHeight || 300
  const maxTop = containerHeight - 40
  return Math.floor(Math.random() * maxTop * 0.7) + 10
}

function getRandomDuration() {
  return 8 + Math.random() * 6
}

function addDanmaku(danmaku) {
  const uid = ++uidCounter
  const top = getRandomTop()
  const duration = getRandomDuration()
  
  const item = {
    ...danmaku,
    uid,
    style: {
      top: top + 'px',
      animationDuration: duration + 's',
    },
    trait_name: getTraitName(danmaku.personality_trait),
  }
  
  activeDanmakus.value.push(item)
  
  setTimeout(() => {
    const idx = activeDanmakus.value.findIndex(d => d.uid === uid)
    if (idx > -1) {
      activeDanmakus.value.splice(idx, 1)
    }
  }, duration * 1000 + 1000)
}

function handleSend() {
  if (!canSend.value) return
  
  const content = inputText.value.trim()
  if (!content) return
  
  dramaStore.sendDanmaku(content, props.currentTime).then(result => {
    if (result) {
      addDanmaku(result)
      emit('send', result)
    }
  })
  
  inputText.value = ''
}

function checkAndShowDanmakus() {
  if (!props.autoPlay) return
  
  const time = props.currentTime
  
  props.danmakuList.forEach(danmaku => {
    if (!shownDanmakuIds.value.has(danmaku.id) && 
        Math.abs(danmaku.video_time - time) < 1) {
      shownDanmakuIds.value.add(danmaku.id)
      addDanmaku(danmaku)
    }
  })
}

function addSystemDanmaku(content, color = '#ffffff') {
  addDanmaku({
    id: 'system_' + Date.now(),
    content,
    color,
    personality_trait: null,
  })
}

watch(() => props.currentTime, () => {
  checkAndShowDanmakus()
})

watch(() => props.danmakuList, () => {
  shownDanmakuIds.value.clear()
}, { deep: true })

onMounted(() => {
  dramaStore.fetchPersonality()
})

defineExpose({
  addDanmaku,
  addSystemDanmaku,
  clear: () => {
    activeDanmakus.value = []
    shownDanmakuIds.value.clear()
  },
  focus: () => {
    inputEl.value?.focus()
  },
})
</script>

<style scoped>
.drama-danmaku {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  pointer-events: none;
}

.danmaku-layer {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.danmaku-item {
  position: absolute;
  left: 100%;
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  animation: danmaku-move linear forwards;
  pointer-events: none;
}

@keyframes danmaku-move {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(calc(-100vw - 100%));
  }
}

.danmaku-text {
  font-size: 16px;
  font-weight: 500;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8), 0 0 6px rgba(0, 0, 0, 0.4);
  letter-spacing: 0.5px;
}

.danmaku-tag {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 10px;
  font-weight: 600;
  text-shadow: none;
  backdrop-filter: blur(4px);
}

.danmaku-input-wrap {
  position: absolute;
  bottom: 60px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(10px);
  border-radius: 30px;
  pointer-events: auto;
  width: 80%;
  max-width: 400px;
}

.color-indicator {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #667eea;
  flex-shrink: 0;
  box-shadow: 0 0 8px currentColor;
}

.color-dot {
  width: 8px;
  height: 8px;
  background: #fff;
  border-radius: 50%;
  opacity: 0.8;
}

.danmaku-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: #fff;
  font-size: 14px;
  padding: 4px 0;
}

.danmaku-input::placeholder {
  color: rgba(255, 255, 255, 0.5);
}

.send-btn {
  padding: 6px 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  border-radius: 20px;
  color: white;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.send-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.toggle-btn {
  position: absolute;
  bottom: 70px;
  right: 20px;
  padding: 8px 16px;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 20px;
  color: white;
  font-size: 13px;
  cursor: pointer;
  pointer-events: auto;
  transition: all 0.2s ease;
}

.toggle-btn:hover {
  background: rgba(102, 126, 234, 0.4);
  border-color: rgba(102, 126, 234, 0.6);
}

.danmaku-fade-enter-active {
  transition: opacity 0.3s ease;
}

.danmaku-fade-enter-from {
  opacity: 0;
}

.danmaku-fade-leave-active {
  transition: opacity 0.5s ease;
}

.danmaku-fade-leave-to {
  opacity: 0;
}
</style>
