<template>
  <div class="hierarchical-action-indicator">
    <div
      v-for="row in rows"
      :key="row.key"
      class="hierarchical-row"
    >
      <span class="row-label">{{ row.label }}</span>
      <div
        class="action-indicator"
        :style="{ 'background-color': q.dark.isActive ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)' }"
      >
        <div
          v-for="(entry, index) in row.entries"
          :key="index"
          :title="`Action: ${entry.label ? entry.label.name : entry.annotation.action}\nStart: ${
            entry.annotation.start
          }\nEnd: ${entry.annotation.end}\nDuration: ${
            entry.annotation.end - entry.annotation.start
          }\nDescription: ${entry.annotation.description}`"
          class="action"
          :style="{
            left: entry.leftPercent,
            right: entry.rightPercent,
            'background-color': entry.annotation.color
          }"
          @click="handleClick(entry)"
        ></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useQuasar } from 'quasar'
import { computed } from 'vue'

import { HIERARCHY_LEVELS, matchHierarchyLevel } from '~/libs/hierarchyLevels.js'
import utils from '~/libs/utils.js'
import { useAnnotationStore } from '~/store/annotation.js'
import { useConfigurationStore } from '~/store/configuration.js'

const annotationStore = useAnnotationStore()
const configurationStore = useConfigurationStore()
const q = useQuasar()

const INSTRUMENT_LANE_COUNT = 2

const toPositionedEntry = (action, label) => {
  const markerWidthUnit = 100 / (annotationStore.video.frames - 1)
  const leftFrame = utils.time2index(action.start)
  const rightFrame = utils.time2index(action.end)
  return {
    annotation: action,
    label,
    leftPercent: (leftFrame - 0.5) * markerWidthUnit + '%',
    rightPercent: (annotationStore.video.frames - rightFrame - 1.5) * markerWidthUnit + '%'
  }
}

const packInstrumentLanes = (items) => {
  const lanes = Array.from({ length: INSTRUMENT_LANE_COUNT }, () => ({ lastEnd: -Infinity, entries: [] }))
  const sorted = [...items].sort((a, b) => a.action.start - b.action.start)
  for (const { action, label } of sorted) {
    const lane = lanes.find((candidate) => candidate.lastEnd <= action.start) || lanes.reduce((a, b) => (a.lastEnd <= b.lastEnd ? a : b))
    lane.entries.push(toPositionedEntry(action, label))
    lane.lastEnd = action.end
  }
  return lanes.map((lane) => lane.entries)
}

const bucketedRows = computed(() => {
  const hierarchy = HIERARCHY_LEVELS.filter((level) => level.key !== 'instrument').map((level) => ({
    level,
    entries: []
  }))
  const instrumentActions = []

  if (annotationStore.video.frames) {
    for (const action of annotationStore.actionAnnotationList) {
      const label = configurationStore.actionLabelData.find((candidate) => candidate.id === action.action)
      const level = label ? matchHierarchyLevel(label.name) : null
      if (!level) {
        continue
      }
      if (level.key === 'instrument') {
        instrumentActions.push({ action, label })
      } else {
        hierarchy.find((row) => row.level.key === level.key).entries.push(toPositionedEntry(action, label))
      }
    }
  }

  return { hierarchy, instrumentActions }
})

const rows = computed(() => {
  const { hierarchy, instrumentActions } = bucketedRows.value
  const instrumentLanes = packInstrumentLanes(instrumentActions)
  const instrumentRows = instrumentLanes.map((entries, index) => ({
    key: `instrument-${index}`,
    label: index === 0 ? 'I1' : 'I2',
    entries
  }))
  return [
    ...hierarchy.map((row) => ({ key: row.level.key, label: row.level.label, entries: row.entries })),
    ...instrumentRows
  ]
})

const handleClick = (entry) => {
  const action = entry.annotation
  annotationStore.leftCurrentFrame = utils.time2index(action.start)
  annotationStore.rightCurrentFrame = utils.time2index(action.end)
  if (entry.label && entry.label.thumbnail) {
    annotationStore.currentThumbnailAction = annotationStore.currentThumbnailAction === action ? null : action
  } else {
    annotationStore.currentThumbnailAction = null
  }
}
</script>

<style>
.hierarchical-action-indicator {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

/* .row-label width + this gap must match the slider gutter spacer in KeyframePanel.vue
   so the slider's 0%-100% track lines up exactly with each row's track. */
.hierarchical-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.hierarchical-row .row-label {
  width: 20px;
  flex-shrink: 0;
  font-size: 8px;
  line-height: 1;
  text-align: right;
  opacity: 0.7;
}

.hierarchical-row .action-indicator {
  position: relative;
  flex: 1;
  height: 6px;
}

.hierarchical-row .action-indicator .action {
  position: absolute;
  height: 100%;
  background-blend-mode: multiply;
  cursor: pointer;
}

.hierarchical-row .action-indicator .action:hover {
  transform: scaleY(1.5);
  transition: transform 0.2s ease-in-out;
}
</style>
