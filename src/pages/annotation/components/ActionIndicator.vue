<template>
  <div class="action-indicator-lanes">
    <div
      v-for="(lane, laneIndex) in actionIndicatorLanes"
      :key="laneIndex"
      class="action-indicator"
      :style="{ 'background-color': q.dark.isActive ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)' }"
    >
      <div
        v-for="(entry, index) in lane"
        :key="index"
        :title="`Action: ${entry.annotation.action}\nStart: ${entry.annotation.start}\nEnd: ${
          entry.annotation.end
        }\nDuration: ${entry.annotation.end - entry.annotation.start}\nDescription: ${
          entry.annotation.description
        }`"
        class="action"
        :style="{
          left: entry.leftPercent,
          right: entry.rightPercent,
          'background-color': entry.annotation.color
        }"
        @click="handleClick(entry.annotation)"
      ></div>
    </div>
  </div>
</template>

<script setup>
import { useQuasar } from 'quasar'
import { computed } from 'vue'

import utils from '~/libs/utils.js'
import { useAnnotationStore } from '~/store/annotation.js'
import { useConfigurationStore } from '~/store/configuration.js'

const annotationStore = useAnnotationStore()
const configurationStore = useConfigurationStore()
const q = useQuasar()

const toPositionedEntry = (action) => {
  const markerWidthUnit = 100 / (annotationStore.video.frames - 1)
  const leftFrame = utils.time2index(action.start)
  const rightFrame = utils.time2index(action.end)
  return {
    annotation: action,
    leftPercent: (leftFrame - 0.5) * markerWidthUnit + '%',
    rightPercent: (annotationStore.video.frames - rightFrame - 1.5) * markerWidthUnit + '%'
  }
}

// Greedily packs annotations into as few lanes as needed so that annotations
// overlapping in time land in different lanes instead of painting over each other.
const actionIndicatorLanes = computed(() => {
  if (!annotationStore.video.frames) {
    return []
  }
  const sorted = [...annotationStore.actionAnnotationList].sort((a, b) => a.start - b.start)
  const lanes = []
  for (const action of sorted) {
    let lane = lanes.find((candidate) => candidate.lastEnd <= action.start)
    if (!lane) {
      lane = { lastEnd: -Infinity, entries: [] }
      lanes.push(lane)
    }
    lane.entries.push(toPositionedEntry(action))
    lane.lastEnd = action.end
  }
  return lanes.map((lane) => lane.entries)
})

const handleClick = (action) => {
  annotationStore.leftCurrentFrame = utils.time2index(action.start)
  annotationStore.rightCurrentFrame = utils.time2index(action.end)
  if (configurationStore.actionLabelData.find((label) => label.id === action.action).thumbnail) {
    annotationStore.currentThumbnailAction = annotationStore.currentThumbnailAction === action ? null : action
  } else {
    annotationStore.currentThumbnailAction = null
  }
}
</script>

<style>
.action-indicator-lanes {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.action-indicator {
  position: relative;
  height: 8px;
}

.action-indicator .action {
  position: absolute;
  height: 100%;
  background-blend-mode: multiply;
  cursor: pointer;
}

.action-indicator .action:hover {
  transform: scaleY(1.5);
  transition: transform 0.2s ease-in-out;
}
</style>
