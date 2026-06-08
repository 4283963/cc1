<template>
  <div class="battle-report" v-if="report">
    <div class="report-container">
      <div class="report-canvas-wrap">
        <canvas ref="canvasEl" :width="canvasWidth" :height="canvasHeight"></canvas>
      </div>
      <div class="report-actions">
        <button class="action-btn" @click="downloadImage">
          📱 保存图片
        </button>
        <button class="action-btn secondary" @click="$emit('close')">
          关闭
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'

const props = defineProps({
  report: {
    type: Object,
    default: null,
  },
  visible: {
    type: Boolean,
    default: false,
  },
})

defineEmits(['close'])

const canvasEl = ref(null)
const canvasWidth = 480
const canvasHeight = 800

watch(() => props.report, (newReport) => {
  if (newReport) {
    nextTick(() => {
      drawReport()
    })
  }
}, { deep: true })

function drawReport() {
  const canvas = canvasEl.value
  if (!canvas) return
  
  const ctx = canvas.getContext('2d')
  const w = canvasWidth
  const h = canvasHeight
  
  ctx.clearRect(0, 0, w, h)
  
  drawBackground(ctx, w, h)
  
  let y = 40
  
  y = drawHeader(ctx, w, y)
  
  y = drawStats(ctx, w, y)
  
  y = drawPersonality(ctx, w, y)
  
  y = drawPath(ctx, w, y)
  
  y = drawFunFacts(ctx, w, y)
  
  drawFooter(ctx, w, h)
}

function drawBackground(ctx, w, h) {
  const gradient = ctx.createLinearGradient(0, 0, 0, h)
  gradient.addColorStop(0, '#1a1a2e')
  gradient.addColorStop(0.5, '#16213e')
  gradient.addColorStop(1, '#0f3460')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, w, h)
  
  ctx.globalAlpha = 0.05
  for (let i = 0; i < 30; i++) {
    const x = Math.random() * w
    const y = Math.random() * h
    const r = Math.random() * 80 + 20
    const glow = ctx.createRadialGradient(x, y, 0, x, y, r)
    glow.addColorStop(0, '#667eea')
    glow.addColorStop(1, 'transparent')
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

function drawHeader(ctx, w, y) {
  const report = props.report
  
  ctx.save()
  ctx.textAlign = 'center'
  
  ctx.font = 'bold 16px sans-serif'
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
  ctx.fillText('🎉 恭喜通关 🎉', w / 2, y)
  y += 30
  
  const titleGradient = ctx.createLinearGradient(w/2 - 200, y, w/2 + 200, y)
  titleGradient.addColorStop(0, '#ffd700')
  titleGradient.addColorStop(0.5, '#ff6b6b')
  titleGradient.addColorStop(1, '#667eea')
  ctx.font = 'bold 26px sans-serif'
  ctx.fillStyle = titleGradient
  ctx.fillText(report.title || '战报', w / 2, y)
  y += 45
  
  if (report.overall_comment) {
    ctx.font = '14px sans-serif'
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'
    
    const lines = wrapText(ctx, report.overall_comment, w - 80)
    lines.forEach(line => {
      ctx.fillText(line, w / 2, y)
      y += 22
    })
  }
  
  y += 10
  drawDivider(ctx, w, y)
  y += 20
  
  ctx.restore()
  return y
}

function drawStats(ctx, w, y) {
  const report = props.report
  const stats = report.stats || {}
  
  ctx.save()
  ctx.textAlign = 'center'
  
  ctx.font = 'bold 16px sans-serif'
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'left'
  ctx.fillText('📊 数据统计', 30, y)
  y += 30
  
  const items = [
    { label: '观看片段', value: stats.path_length || 0, unit: '个' },
    { label: '做出选择', value: stats.total_choices || 0, unit: '次' },
    { label: '探索完成度', value: stats.completion_rate || 0, unit: '%' },
    { label: '总节点数', value: stats.total_nodes || 0, unit: '个' },
  ]
  
  const cardWidth = (w - 70) / 2
  const cardHeight = 70
  
  items.forEach((item, idx) => {
    const col = idx % 2
    const row = Math.floor(idx / 2)
    const x = 30 + col * (cardWidth + 10)
    const cardY = y + row * (cardHeight + 12)
    
    drawCard(ctx, x, cardY, cardWidth, cardHeight, item)
  })
  
  y += Math.ceil(items.length / 2) * (cardHeight + 12) + 10
  
  drawDivider(ctx, w, y + 10)
  y += 30
  
  ctx.restore()
  return y
}

function drawCard(ctx, x, y, w, h, item) {
  ctx.save()
  
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)'
  ctx.beginPath()
  roundRect(ctx, x, y, w, h, 10)
  ctx.fill()
  
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
  ctx.lineWidth = 1
  ctx.stroke()
  
  ctx.textAlign = 'left'
  ctx.font = '12px sans-serif'
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
  ctx.fillText(item.label, x + 15, y + 28)
  
  ctx.font = 'bold 24px sans-serif'
  ctx.fillStyle = '#fff'
  ctx.fillText(item.value + item.unit, x + 15, y + 55)
  
  ctx.restore()
}

function drawPersonality(ctx, w, y) {
  const report = props.report
  const personality = report.personality || {}
  const traits = personality.traits || []
  
  if (traits.length === 0) return y
  
  ctx.save()
  
  ctx.font = 'bold 16px sans-serif'
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'left'
  ctx.fillText('🎭 性格画像', 30, y)
  y += 30
  
  const maxScore = Math.max(...traits.map(t => t.score || 0), 10)
  
  traits.slice(0, 5).forEach((trait, idx) => {
    const barY = y + idx * 32
    const barHeight = 20
    
    ctx.font = '12px sans-serif'
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'
    ctx.textAlign = 'left'
    ctx.fillText(trait.trait_name || trait.trait_key, 30, barY + 14)
    
    const barX = 100
    const barWidth = w - 180
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'
    ctx.beginPath()
    roundRect(ctx, barX, barY, barWidth, barHeight, 4)
    ctx.fill()
    
    const scoreWidth = (trait.score / maxScore) * barWidth
    const color = trait.color || '#667eea'
    const gradient = ctx.createLinearGradient(barX, 0, barX + scoreWidth, 0)
    gradient.addColorStop(0, color)
    gradient.addColorStop(1, adjustColor(color, 30))
    ctx.fillStyle = gradient
    ctx.beginPath()
    roundRect(ctx, barX, barY, scoreWidth, barHeight, 4)
    ctx.fill()
    
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 11px sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(trait.score + '分', w - 30, barY + 14)
  })
  
  y += Math.min(traits.length, 5) * 32 + 15
  
  if (personality.dominant_trait) {
    ctx.fillStyle = 'rgba(255, 215, 0, 0.15)'
    ctx.beginPath()
    roundRect(ctx, 30, y, w - 60, 40, 8)
    ctx.fill()
    
    ctx.font = '13px sans-serif'
    ctx.fillStyle = '#ffd700'
    ctx.textAlign = 'center'
    ctx.fillText(`⭐ 主导性格：${traits[0]?.trait_name || personality.dominant_trait}`, w / 2, y + 25)
    
    y += 55
  }
  
  drawDivider(ctx, w, y + 5)
  y += 25
  
  ctx.restore()
  return y
}

function drawPath(ctx, w, y) {
  const report = props.report
  const path = report.path || []
  
  if (path.length === 0) return y
  
  ctx.save()
  
  ctx.font = 'bold 16px sans-serif'
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'left'
  ctx.fillText('🛤️ 你的冒险路线', 30, y)
  y += 28
  
  const showPath = path.slice(-6)
  const startIdx = path.length > 6 ? path.length - 5 : 1
  
  if (path.length > 6) {
    ctx.font = '12px sans-serif'
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'
    ctx.fillText('...前面还有' + (path.length - 5) + '个片段', 45, y + 5)
    y += 20
  }
  
  showPath.forEach((node, idx) => {
    const nodeY = y + idx * 28
    
    ctx.fillStyle = node.is_ending ? '#ff6b6b' : '#667eea'
    ctx.beginPath()
    ctx.arc(38, nodeY + 8, 5, 0, Math.PI * 2)
    ctx.fill()
    
    ctx.font = '13px sans-serif'
    ctx.fillStyle = node.is_ending ? '#ff6b6b' : 'rgba(255, 255, 255, 0.9)'
    ctx.textAlign = 'left'
    
    const idxLabel = startIdx + idx
    ctx.fillText(`第${idxLabel}站：${node.title || ''}`, 55, nodeY + 12)
    
    if (idx < showPath.length - 1) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(38, nodeY + 14)
      ctx.lineTo(38, nodeY + 26)
      ctx.stroke()
    }
  })
  
  y += showPath.length * 28 + 15
  
  drawDivider(ctx, w, y + 5)
  y += 25
  
  ctx.restore()
  return y
}

function drawFunFacts(ctx, w, y) {
  const report = props.report
  const funFacts = report.fun_facts || []
  
  if (funFacts.length === 0) return y
  
  ctx.save()
  
  ctx.font = 'bold 16px sans-serif'
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'left'
  ctx.fillText('💡 趣味数据', 30, y)
  y += 28
  
  const showFacts = funFacts.slice(0, 3)
  
  showFacts.forEach((fact, idx) => {
    const factY = y + idx * 26
    
    ctx.font = '12px sans-serif'
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
    ctx.textAlign = 'left'
    
    const lines = wrapText(ctx, fact, w - 70)
    lines.forEach((line, lineIdx) => {
      ctx.fillText(line, 40, factY + lineIdx * 18 + 14)
    })
  })
  
  y += showFacts.length * 50
  
  ctx.restore()
  return y
}

function drawFooter(ctx, w, h) {
  ctx.save()
  ctx.textAlign = 'center'
  
  ctx.font = '11px sans-serif'
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'
  ctx.fillText('互动短剧 · 你的专属战报', w / 2, h - 25)
  
  const dateStr = new Date().toLocaleDateString('zh-CN')
  ctx.fillText(dateStr, w / 2, h - 10)
  
  ctx.restore()
}

function drawDivider(ctx, w, y) {
  ctx.save()
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(30, y)
  ctx.lineTo(w - 30, y)
  ctx.stroke()
  ctx.restore()
}

function roundRect(ctx, x, y, w, h, r) {
  if (w < 2 * r) r = w / 2
  if (h < 2 * r) r = h / 2
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function wrapText(ctx, text, maxWidth) {
  const lines = []
  let currentLine = ''
  
  for (const char of text) {
    const testLine = currentLine + char
    const metrics = ctx.measureText(testLine)
    
    if (metrics.width > maxWidth && currentLine.length > 0) {
      lines.push(currentLine)
      currentLine = char
    } else {
      currentLine = testLine
    }
  }
  
  if (currentLine) {
    lines.push(currentLine)
  }
  
  return lines
}

function adjustColor(color, amount) {
  const hex = color.replace('#', '')
  const r = Math.min(255, Math.max(0, parseInt(hex.substr(0, 2), 16) + amount))
  const g = Math.min(255, Math.max(0, parseInt(hex.substr(2, 2), 16) + amount))
  const b = Math.min(255, Math.max(0, parseInt(hex.substr(4, 2), 16) + amount))
  return `rgb(${r}, ${g}, ${b})`
}

function downloadImage() {
  const canvas = canvasEl.value
  if (!canvas) return
  
  const link = document.createElement('a')
  link.download = '互动短剧战报_' + Date.now() + '.png'
  link.href = canvas.toDataURL('image/png')
  link.click()
}

onMounted(() => {
  if (props.report) {
    drawReport()
  }
})

defineExpose({
  redraw: drawReport,
  downloadImage,
  getCanvas: () => canvasEl.value,
})
</script>

<style scoped>
.battle-report {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  z-index: 100;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.report-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  max-height: 90vh;
}

.report-canvas-wrap {
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5),
              0 0 0 1px rgba(255, 255, 255, 0.1);
}

.report-canvas-wrap canvas {
  display: block;
  max-height: 70vh;
  width: auto;
}

.report-actions {
  display: flex;
  gap: 12px;
}

.action-btn {
  padding: 12px 28px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  border-radius: 25px;
  color: white;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
}

.action-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
}

.action-btn.secondary {
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(10px);
}

.action-btn.secondary:hover {
  background: rgba(255, 255, 255, 0.25);
}
</style>
