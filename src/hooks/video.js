import utils from '~/libs/utils.js'
import { useAnnotationStore } from '~/store/annotation.js'
import { useMainStore } from '~/store/index.js'

export const useVideo = () => {
  const annotationStore = useAnnotationStore()
  const mainStore = useMainStore()
  const doOpen = (processor) => {
    const importFunc = processor ? utils.importVideoAndProcess : utils.importVideo
    importFunc().then(({ type, videoSrc }) => {
      mainStore.videoFormat = type
      annotationStore.video.src = videoSrc
      mainStore.drawer = false
    })
  }

  return {
    handleOpen: () => {
      if (annotationStore.hasVideo) {
        utils.confirm('Are you sure to open a new video? You will LOSE all data!').onOk(() => {
          annotationStore.cachedFrameList = []
          annotationStore.reset()
          doOpen(false)
        })
      } else {
        doOpen(false)
      }
    },
    handleOpenProcessed: () => {
      if (annotationStore.hasVideo) {
        utils.confirm('Are you sure to open a new video? You will LOSE all data!').onOk(() => {
          annotationStore.cachedFrameList = []
          annotationStore.reset()
          doOpen(true)
        })
      } else {
        doOpen(true)
      }
    },
    handleClose: () => {
      utils.confirm('Are you sure to close? You will LOSE all data!').onOk(() => {
        annotationStore.cachedFrameList = []
        annotationStore.reset()
        mainStore.drawer = false
        mainStore.videoFormat = null
      })
    }
  }
}
