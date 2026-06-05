/**
 * Utils
 */
import { Dialog, Notify } from 'quasar'

import { useAnnotationStore } from '~/store/annotation.js'

export default {
  /**
   * Confirm popup
   * @param message
   * @returns
   */
  confirm(message) {
    return Dialog.create({
      title: 'Confirm',
      message: message,
      cancel: true,
      persistent: true
    })
  },
  /**
   * Notify popup
   * @param message
   * @param color
   * @param timeout
   * @param position
   * @returns
   */
  notify(message, color = 'positive', timeout = 5000, position = 'bottom-right') {
    switch (color) {
      case 'positive':
        console.debug(message)
        break
      case 'info':
        console.info(message)
        break
      case 'negative':
        console.error(message)
        break
      case 'warning':
        console.warn(message)
        break
      default:
        console.log(message)
        break
    }
    return Notify.create({
      message: message,
      color: color,
      position: position,
      timeout: timeout,
      closeBtn: timeout === 0 ? 'Dismiss' : false
    })
  },
  /**
   * Prompt popup
   * @param title
   * @param message
   * @param defaultValue of input
   * @param type of input
   * @returns
   */
  prompt(title, message, defaultValue, type = 'text') {
    return Dialog.create({
      title: title,
      message: message,
      prompt: {
        model: defaultValue,
        type: type
      },
      cancel: true,
      persistent: true
    })
  },
  /**
   * Read text file
   * @param pathname
   * @returns {Promise}
   */
  readFile: (pathname) => {
    return new Promise(function (resolve, reject) {
      fetch(pathname)
        .then((res) => {
          if (!res.ok) reject(`${pathname}: ${res.statusText} (${res.status})`)
          return res.text()
        })
        .then((text) => {
          resolve(text)
        })
        .catch((err) => {
          reject(err)
        })
    })
  },
  /**
   * Import a json file
   * @returns {Promise}
   */
  importFile: () => {
    return new Promise(function (resolve, reject) {
      const dialog = document.createElement('input')
      dialog.type = 'file'
      dialog.accept = 'application/json'
      dialog.onchange = (e) => {
        const file = e.target.files[0]
        const reader = new FileReader()
        reader.onload = (readerEvent) => {
          resolve(readerEvent.target.result)
        }
        reader.readAsText(file, 'UTF-8')
      }
      dialog.click()
    })
  },
  /**
   * Import a video file
   * @returns {Promise}
   */
  importVideo: () => {
    return new Promise(function (resolve, reject) {
      const dialog = document.createElement('input')
      dialog.type = 'file'
      dialog.accept = 'video/*'
      dialog.onchange = (e) => {
        const file = e.target.files[0]
        resolve({
          type: file.type.split('/').at(-1),
          videoSrc: URL.createObjectURL(file)
        })
      }
      dialog.click()
    })
  },
  /**
   * Import a video file and process it
   * @returns {Promise}
   */
  importVideoAndProcess: () => {
    return new Promise(function (resolve, reject) {
      const dialog = document.createElement('input')
      dialog.type = 'file'
      dialog.accept = 'video/*'
      dialog.onchange = (e) => {
        const file = e.target.files[0]
        const formData = new FormData()
        formData.append('video', file)

        const notification = Notify.create({
          message: 'Uploading and processing video... Please wait.',
          color: 'info',
          timeout: 0,
          caption: 'This may take a while depending on file size.'
        })

        // Assuming backend is running on localhost:3000
        const backendUrl = 'http://localhost:3000'

        fetch(`${backendUrl}/preprocess`, {
          method: 'POST',
          body: formData
        })
          .then((res) => {
            if (!res.ok) throw new Error(res.statusText)
            return res.json()
          })
          .then((data) => {
            notification() // Dismiss notification
            Notify.create({ message: 'Processing complete! Downloading files...', color: 'positive' })
            
            // Helper to download a file from URL
            const downloadFile = (url, filename) => {
               const link = document.createElement('a')
               link.href = url
               link.download = filename
               document.body.appendChild(link)
               link.click()
               document.body.removeChild(link)
            }

            // Ask user which videostream (left/right) to open in Vidat
            Dialog.create({
              title: 'Select Stream',
              message: 'Processing complete. Files will be downloaded.\n\nWhich stream do you want to OPEN in Vidat now?',
              options: {
                type: 'radio',
                model: 'left',
                items: [
                  { label: 'Left Stream', value: 'left' },
                  { label: 'Right Stream', value: 'right' }
                ]
              },
              cancel: true,
              persistent: true
            }).onOk((dataOption) => {
              // Trigger downloads of both files
              const leftDownloadUrl = `${backendUrl}${data.left.downloadUrl}`
              const rightDownloadUrl = `${backendUrl}${data.right.downloadUrl}`
              
              // We download both so user has them locally
              // Using the new download endpoint ensures they are downloaded as attachments
              // rather than opened in the browser/player
              downloadFile(leftDownloadUrl, data.left.name)
              // Small delay to ensure browser handles both downloads
              setTimeout(() => downloadFile(rightDownloadUrl, data.right.name), 1000)

              // Load the selected stream from the backend URL (Blob/Stream)
              const selectedUrl = dataOption === 'left' ? `${backendUrl}${data.left.url}` : `${backendUrl}${data.right.url}`
              
              // We can fetch the blob to make it behave like a local file (better seeking)
              fetch(selectedUrl)
                .then(response => response.blob())
                .then(blob => {
                   const blobUrl = URL.createObjectURL(blob)
                   resolve({
                      type: 'mp4',
                      videoSrc: blobUrl
                   })
                })
            })
          })
          .catch((err) => {
            notification() // Dismiss notification
            Notify.create({ message: `Error: ${err.message}`, color: 'negative' })
            reject(err)
          })
      }
      dialog.click()
    })
  },
  /**
   * Convert time to index
   * @param time
   * @returns {number}
   */
  time2index(time) {
    return Math.round(useAnnotationStore().video.fps * time)
  },
  /**
   * Convert index to time
   * @param index
   * @returns {number}
   */
  index2time(index) {
    return parseFloat((index / useAnnotationStore().video.fps).toFixed(3))
  },
  /**
   * Convert a number to fixed 2 format
   * @param value
   * @returns {string}
   */
  toFixed2(value) {
    if (value) {
      return value.toFixed(2)
    } else {
      return '0.00'
    }
  },
  /**
   * Generate a random color
   * @returns {string}
   */
  randomColor() {
    return `#${('000000' + ((Math.random() * 16777216) | 0).toString(16)).slice(-6)}`
  }
}
