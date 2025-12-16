import deepClone from 'lodash.clonedeep'
import { defineStore } from 'pinia'
import { computed, reactive, toRefs, watch } from 'vue'

import { ActionAnnotation, ObjectAnnotation, RegionAnnotation, SkeletonAnnotation } from '~/libs/annotationlib.js'
import utils from '~/libs/utils.js'
import { useMainStore } from '~/store/index.js'
import { usePreferenceStore } from '~/store/preference.js'
import frameCache from '~/libs/frameCache.js'

const CACHE_LIMIT = 800
const MEMORY_WARNING_THRESHOLD = 0.8
const MEMORY_CRITICAL_THRESHOLD = 0.95
const AGGRESSIVE_EVICT_LIMIT = 100
const THROTTLE_INTERVAL = 500

const DEFAULT_ANNOTATION = {
  video: {
    src: undefined,
    fps: undefined,
    frames: undefined,
    duration: undefined,
    height: undefined,
    width: undefined
  },

  objectAnnotationListMap: {},
  regionAnnotationListMap: {},
  skeletonAnnotationListMap: {},
  actionAnnotationList: [],

  leftCurrentFrame: 0,
  rightCurrentFrame: 0,
  keyframeList: [],
  mode: 'object', // 'object', 'region', 'skeleton', 'action'
  skeletonTypeId: 0,

  priorityQueue: [],
  backendQueue: [],
  cachedFrameList: [],
  cachedFrameOrder: [],
  isCaching: false,
  memoryStatus: 'normal',
  lastCacheTime: 0,

  delMode: false,
  copyMode: false,
  addPointMode: false,
  delPointMode: false,
  indicatingMode: false,

  currentSortedActionList: [],
  currentThumbnailAction: null,
  videoPlaybackRate: 1
}

export const useAnnotationStore = defineStore('annotation', () => {
  const preferenceStore = usePreferenceStore()
  const mainStore = useMainStore()
  let defaultAnnotation = deepClone(DEFAULT_ANNOTATION)
  const state = reactive(DEFAULT_ANNOTATION)

  const getMemoryUsagePercent = () => {
    if (performance.memory) {
      return performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit
    }
    return 0
  }

  const updateMemoryStatus = () => {
    const usage = getMemoryUsagePercent()
    if (usage > MEMORY_CRITICAL_THRESHOLD) {
      state.memoryStatus = 'critical'
      return 'critical'
    } else if (usage > MEMORY_WARNING_THRESHOLD) {
      state.memoryStatus = 'warning'
      return 'warning'
    } else {
      state.memoryStatus = 'normal'
      return 'normal'
    }
  }

  const evictFramesIfNeeded = () => {
    const memStatus = updateMemoryStatus()
    const targetLimit = memStatus === 'critical' ? AGGRESSIVE_EVICT_LIMIT : CACHE_LIMIT

    if (memStatus === 'critical') {
      utils.notify('Memory critical! Reducing cache aggressively.', 'warning')
    } else if (memStatus === 'warning') {
      utils.notify('Memory usage high. Limiting cache size.', 'warning')
    }

    let safety = state.cachedFrameOrder.length + 1
    while (state.cachedFrameOrder.length > targetLimit && safety > 0) {
      const evictIndex = state.cachedFrameOrder.shift()
      const isPinned =
        evictIndex === state.leftCurrentFrame ||
        evictIndex === state.rightCurrentFrame ||
        state.keyframeList.includes(evictIndex)
      if (isPinned) {
        state.cachedFrameOrder.push(evictIndex)
      } else {
        const blob = state.cachedFrameList[evictIndex]
        if (blob) {
          // offload to IndexedDB before dropping from memory
          frameCache.put(state.video.src, evictIndex, blob)
        }
        state.cachedFrameList[evictIndex] = null
      }
      safety -= 1
    }
  }

  const releaseVideoSrc = () => {
    if (state.video?.src && state.video.src.startsWith('blob:')) {
      URL.revokeObjectURL(state.video.src)
    }
  }

  const clearCachedFrames = () => {
    if (state.cachedFrameList.length) {
      for (let i = 0; i < state.cachedFrameList.length; i += 1) {
        state.cachedFrameList[i] = null
      }
    }
    state.cachedFrameList.length = 0
    state.cachedFrameOrder.length = 0
    state.priorityQueue.length = 0
    state.backendQueue.length = 0
    state.isCaching = false
    // also clear disk cache for this video
    if (state.video?.src) frameCache.clearForVideo(state.video.src)
  }
  watch(
    () => [preferenceStore.objects, preferenceStore.regions, preferenceStore.skeletons, preferenceStore.actions],
    (newValue, oldValue) => {
      if (!newValue.includes(true)) {
        utils.notify('You cannot disable all four modes at the same time!', 'warning')
        ;[preferenceStore.objects, preferenceStore.regions, preferenceStore.skeletons, preferenceStore.actions] =
          oldValue
      } else if (!newValue.slice(0, 3).includes(true) && newValue.at(-1) === true) {
        state.mode = 'action'
      } else if (!preferenceStore[state.mode + 's']) {
        state.mode = ['object', 'region', 'skeleton'].find((item) => preferenceStore[item + 's'])
      }
    },
    {
      immediate: true
    }
  )
  watch(
    () => state.keyframeList,
    (newValue) => {
      if (newValue.length >= 2) {
        state.leftCurrentFrame = newValue[0]
        state.rightCurrentFrame = newValue[1]
      } else if (newValue.length === 1) {
        state.rightCurrentFrame = newValue[0]
        state.leftCurrentFrame = newValue[0]
      } else {
        state.rightCurrentFrame = 0
        state.leftCurrentFrame = 0
      }
    }
  )
  watch(
    () => [
      state.objectAnnotationListMap,
      state.regionAnnotationListMap,
      state.skeletonAnnotationListMap,
      state.actionAnnotationList,
      state.keyframeList
    ],
    () => {
      mainStore.isSaved = false
    },
    { deep: true }
  )
  return {
    ...toRefs(state),
    hasVideo: computed(() => {
      return !!(state.video && state.video.src)
    }),
    cacheFrame: (frameIndex, frame) => {
      const memStatus = updateMemoryStatus()
      if (memStatus === 'critical') {
        return
      }

      const now = Date.now()
      const effectiveThrottle = memStatus === 'warning' ? THROTTLE_INTERVAL : 0
      if (effectiveThrottle > 0 && now - state.lastCacheTime < effectiveThrottle) {
        return
      }
      state.lastCacheTime = now

      state.cachedFrameList[frameIndex] = frame
      const existingIndex = state.cachedFrameOrder.indexOf(frameIndex)
      if (existingIndex !== -1) {
        state.cachedFrameOrder.splice(existingIndex, 1)
      }
      state.cachedFrameOrder.push(frameIndex)
      evictFramesIfNeeded()
    },
    ensureFrameLoaded: async (frameIndex) => {
      if (!state.cachedFrameList[frameIndex] && state.video?.src) {
        const blob = await frameCache.get(state.video.src, frameIndex)
        if (blob) {
          // bypass throttle for on-demand restore
          state.cachedFrameList[frameIndex] = blob
          const existingIndex = state.cachedFrameOrder.indexOf(frameIndex)
          if (existingIndex !== -1) {
            state.cachedFrameOrder.splice(existingIndex, 1)
          }
          state.cachedFrameOrder.push(frameIndex)
        }
      }
    },
    cleanupVideoMemory: ({ releaseVideoSrc: shouldReleaseVideoSrc = true } = {}) => {
      clearCachedFrames()
      state.lastCacheTime = 0
      if (shouldReleaseVideoSrc) {
        releaseVideoSrc()
      }
    },
    reset: () => {
      // drop references before overwriting the reactive state to allow GC
      clearCachedFrames()
      releaseVideoSrc()
      const annotation = deepClone(defaultAnnotation)
      annotation.mode = state.mode
      annotation.zoom = state.zoom
      annotation.skeletonTypeId = state.skeletonTypeId
      annotation.isSaved = true
      Object.keys(state).map((key) => (state[key] = annotation[key]))
    },
    exportAnnotation: () => {
      const objectAnnotationListMap = {}
      for (const frame in state.objectAnnotationListMap) {
        if (state.objectAnnotationListMap[frame].length) {
          objectAnnotationListMap[frame] = state.objectAnnotationListMap[frame]
        }
      }
      const regionAnnotationListMap = {}
      for (const frame in state.regionAnnotationListMap) {
        if (state.regionAnnotationListMap[frame].length) {
          regionAnnotationListMap[frame] = state.regionAnnotationListMap[frame]
        }
      }
      // remove type in each skeletonAnnotation
      const skeletonAnnotationListMap = {}
      for (const frame in state.skeletonAnnotationListMap) {
        if (state.skeletonAnnotationListMap[frame].length) {
          skeletonAnnotationListMap[frame] = state.skeletonAnnotationListMap[frame].map((skeletonAnnotation) => {
            return {
              instance: skeletonAnnotation.instance,
              score: skeletonAnnotation.score,
              centerX: skeletonAnnotation.centerX,
              centerY: skeletonAnnotation.centerY,
              typeId: skeletonAnnotation.typeId,
              color: skeletonAnnotation.color,
              _ratio: skeletonAnnotation._ratio,
              pointList: skeletonAnnotation.pointList
            }
          })
        }
      }
      mainStore.isSaved = true
      return {
        video: state.video,
        keyframeList: state.keyframeList,
        objectAnnotationListMap,
        regionAnnotationListMap,
        skeletonAnnotationListMap,
        actionAnnotationList: state.actionAnnotationList
      }
    },
    importAnnotation: (data) => {
      const {
        video,
        keyframeList,
        objectAnnotationListMap,
        regionAnnotationListMap,
        skeletonAnnotationListMap,
        actionAnnotationList
      } = data
      /// video
      if (!state.video.src && video.src.startsWith('blob')) {
        throw 'The src of video is blob (local), please load video first!'
      } else if (!state.video.src && !video.src.startsWith('blob')) {
        state.video = video
        mainStore.videoFormat = video.src.split('.').at(-1).toLowerCase()
      } else {
        if (state.video.duration && video.duration && state.video.duration !== video.duration) {
          throw `The duration of annotation and the video does not match (duration ${state.video.duration} != ${video.duration}).`
        }
        if (state.video.frames && video.frames && state.video.frames !== video.frames) {
          throw `The frames of annotation and the video does not match (duration ${state.video.frames} != ${video.frames}).`
        }
        if (state.video.width && video.width && state.video.width !== video.width) {
          utils.notify(
            `The width of annotation and the video does not match (width ${state.video.width} != ${video.width}).`,
            'warning'
          )
        }
        if (state.video.height && video.height && state.video.height !== video.height) {
          utils.notify(
            `The height of annotation and the video does not match (width ${state.video.height} != ${video.height}).`,
            'warning'
          )
        }
      }
      /// keyframeList
      state.keyframeList = keyframeList
      state.rightCurrentFrame = keyframeList.length >= 2 ? keyframeList[1] : keyframeList[0]
      /// objectAnnotationListMap
      for (let frame in objectAnnotationListMap) {
        const objectAnnotationList = objectAnnotationListMap[frame]
        for (let i in objectAnnotationList) {
          let objectAnnotation = objectAnnotationList[i]
          objectAnnotationList[i] = new ObjectAnnotation(
            objectAnnotation.x,
            objectAnnotation.y,
            objectAnnotation.width,
            objectAnnotation.height,
            objectAnnotation.labelId,
            objectAnnotation.color,
            objectAnnotation.instance,
            objectAnnotation.score
          )
        }
      }
      state.objectAnnotationListMap = objectAnnotationListMap
      /// regionAnnotationListMap
      for (let frame in regionAnnotationListMap) {
        const regionAnnotationList = regionAnnotationListMap[frame]
        for (let i in regionAnnotationList) {
          let regionAnnotation = regionAnnotationList[i]
          regionAnnotationList[i] = new RegionAnnotation(
            regionAnnotation.pointList,
            regionAnnotation.labelId,
            regionAnnotation.color,
            regionAnnotation.instance,
            regionAnnotation.score
          )
        }
      }
      state.regionAnnotationListMap = regionAnnotationListMap
      /// skeletonAnnotationListMap
      for (let frame in skeletonAnnotationListMap) {
        const skeletonAnnotationList = skeletonAnnotationListMap[frame]
        for (let i in skeletonAnnotationList) {
          let skeletonAnnotation = skeletonAnnotationList[i]
          const newSkeletonAnnotation = new SkeletonAnnotation(
            skeletonAnnotation.centerX,
            skeletonAnnotation.centerY,
            skeletonAnnotation.typeId,
            skeletonAnnotation.color,
            skeletonAnnotation.instance,
            skeletonAnnotation.score
          )
          newSkeletonAnnotation._ratio = skeletonAnnotation._ratio
          newSkeletonAnnotation.pointList = skeletonAnnotation.pointList
          skeletonAnnotationList[i] = newSkeletonAnnotation
        }
      }
      state.skeletonAnnotationListMap = skeletonAnnotationListMap
      /// actionAnnotationList
      for (let i in actionAnnotationList) {
        const actionAnnotation = actionAnnotationList[i]
        actionAnnotationList[i] = new ActionAnnotation(
          actionAnnotation.start,
          actionAnnotation.end,
          actionAnnotation.action,
          actionAnnotation.object,
          actionAnnotation.color,
          actionAnnotation.description
        )
      }
      state.actionAnnotationList = actionAnnotationList
      mainStore.isSaved = true
    }
  }
})
