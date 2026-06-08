<template>
  <div class="drama-tree">
    <div class="tree-header">
      <h3 class="tree-title">剧情树状图</h3>
      <div class="tree-legend">
        <div class="legend-item">
          <span class="legend-dot current"></span>
          <span>当前</span>
        </div>
        <div class="legend-item">
          <span class="legend-dot viewed"></span>
          <span>已观看</span>
        </div>
        <div class="legend-item">
          <span class="legend-dot unviewed"></span>
          <span>未观看</span>
        </div>
        <div class="legend-item">
          <span class="legend-dot ending"></span>
          <span>结局</span>
        </div>
      </div>
    </div>

    <div class="tree-container" ref="treeContainer">
      <div class="tree-scroll">
        <div v-if="treeData" class="tree-root">
          <tree-node
            :node="treeData"
            :viewed-ids="viewedNodeIds"
            :current-id="currentNodeId"
            @node-click="handleNodeClick"
          />
        </div>
        <div v-else class="tree-empty">
          <p>暂无剧情数据</p>
        </div>
      </div>
    </div>

    <div class="tree-stats" v-if="stats.totalNodes > 0">
      <div class="stat-item">
        <span class="stat-label">总节点</span>
        <span class="stat-value">{{ stats.totalNodes }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">已观看</span>
        <span class="stat-value">{{ stats.viewedCount }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">结局数</span>
        <span class="stat-value">{{ stats.endingCount }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">完成度</span>
        <span class="stat-value">{{ stats.completionRate }}%</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, h } from 'vue'
import { useDramaStore } from '../stores/drama'

const props = defineProps({
  treeData: {
    type: Object,
    default: null,
  },
  viewedNodeIds: {
    type: Array,
    default: () => [],
  },
  currentNodeId: {
    type: [Number, String],
    default: null,
  },
})

const emit = defineEmits(['node-click'])

const dramaStore = useDramaStore()
const treeContainer = ref(null)

const stats = computed(() => {
  if (!props.treeData) {
    return { totalNodes: 0, viewedCount: 0, endingCount: 0, completionRate: 0 }
  }

  let total = 0
  let viewed = 0
  let endings = 0

  function traverse(node) {
    total++
    if (props.viewedNodeIds.includes(node.id)) {
      viewed++
    }
    if (node.is_ending) {
      endings++
    }
    if (node.children && node.children.length > 0) {
      node.children.forEach(child => traverse(child))
    }
  }

  traverse(props.treeData)

  return {
    totalNodes: total,
    viewedCount: viewed,
    endingCount: endings,
    completionRate: total > 0 ? Math.round((viewed / total) * 100) : 0,
  }
})

function handleNodeClick(node) {
  emit('node-click', node)
}

const TreeNode = {
  name: 'TreeNode',
  props: {
    node: Object,
    viewedIds: Array,
    currentId: [Number, String],
  },
  emits: ['node-click'],
  setup(props, { emit }) {
    const isViewed = computed(() => props.viewedIds.includes(props.node.id))
    const isCurrent = computed(() => String(props.node.id) === String(props.currentId))
    const isEnding = computed(() => props.node.is_ending)

    const nodeClass = computed(() => ({
      'tree-node': true,
      'is-viewed': isViewed.value,
      'is-current': isCurrent.value,
      'is-ending': isEnding.value,
      'is-unviewed': !isViewed.value,
    }))

    return () => {
      const node = h('div', { class: nodeClass.value, onClick: () => emit('node-click', props.node) }, [
        h('div', { class: 'node-content' }, [
          h('span', { class: 'node-icon' }, isEnding.value ? '★' : '●'),
          h('span', { class: 'node-title' }, props.node.title || `节点 ${props.node.id}`),
        ]),
        h('div', { class: 'node-badge' }, isCurrent.value ? '当前' : (isViewed.value ? '已看' : '未看')),
      ])

      const children = props.node.children || []

      if (children.length > 0) {
        const childElements = children.map(child => {
          return h('div', { class: 'tree-branch' }, [
            h('div', { class: 'branch-line' }),
            h(TreeNode, {
              node: child,
              viewedIds: props.viewedIds,
              currentId: props.currentId,
              onNodeClick: (n) => emit('node-click', n),
            }),
          ])
        })

        return h('div', { class: 'tree-node-wrapper' }, [
          node,
          h('div', { class: 'tree-children' }, childElements),
        ])
      }

      return h('div', { class: 'tree-node-wrapper' }, [node])
    }
  },
}
</script>

<style scoped>
.drama-tree {
  background: #1a1a2e;
  border-radius: 12px;
  padding: 20px;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.tree-header {
  margin-bottom: 16px;
}

.tree-title {
  font-size: 18px;
  font-weight: 600;
  color: #fff;
  margin-bottom: 12px;
}

.tree-legend {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.legend-dot.current {
  background: #667eea;
  box-shadow: 0 0 8px rgba(102, 126, 234, 0.6);
}

.legend-dot.viewed {
  background: #4caf50;
}

.legend-dot.unviewed {
  background: rgba(255, 255, 255, 0.3);
}

.legend-dot.ending {
  background: #ffc107;
}

.tree-container {
  flex: 1;
  overflow: auto;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  padding: 20px;
}

.tree-scroll {
  min-width: 100%;
  display: flex;
  justify-content: center;
}

.tree-root {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.tree-node-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.tree-node {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: rgba(255, 255, 255, 0.08);
  border: 2px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 140px;
  position: relative;
}

.tree-node:hover {
  background: rgba(255, 255, 255, 0.15);
  transform: translateY(-1px);
}

.tree-node.is-current {
  border-color: #667eea;
  background: rgba(102, 126, 234, 0.2);
  box-shadow: 0 0 16px rgba(102, 126, 234, 0.3);
}

.tree-node.is-viewed {
  background: rgba(76, 175, 80, 0.15);
}

.tree-node.is-ending {
  background: rgba(255, 193, 7, 0.15);
}

.tree-node.is-ending.is-viewed {
  background: rgba(255, 193, 7, 0.25);
}

.node-content {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.node-icon {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.5);
}

.tree-node.is-current .node-icon {
  color: #667eea;
}

.tree-node.is-viewed .node-icon {
  color: #4caf50;
}

.tree-node.is-ending .node-icon {
  color: #ffc107;
}

.node-title {
  font-size: 13px;
  color: #fff;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100px;
}

.node-badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.3);
  color: rgba(255, 255, 255, 0.6);
  flex-shrink: 0;
}

.tree-node.is-current .node-badge {
  background: #667eea;
  color: #fff;
}

.tree-node.is-viewed:not(.is-current) .node-badge {
  background: #4caf50;
  color: #fff;
}

.tree-children {
  display: flex;
  gap: 20px;
  margin-top: 20px;
  position: relative;
  padding-top: 20px;
}

.tree-children::before {
  content: '';
  position: absolute;
  top: 0;
  left: 50%;
  width: 2px;
  height: 20px;
  background: rgba(255, 255, 255, 0.2);
}

.tree-branch {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
}

.branch-line {
  width: 2px;
  height: 20px;
  background: rgba(255, 255, 255, 0.2);
}

.tree-empty {
  text-align: center;
  padding: 40px;
  color: rgba(255, 255, 255, 0.5);
}

.tree-stats {
  display: flex;
  justify-content: space-around;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.stat-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
}

.stat-value {
  font-size: 18px;
  font-weight: 600;
  color: #fff;
}
</style>
