// Simple IndexedDB-backed frame cache for large videos
const DB_NAME = 'vidat-frames'
const STORE_NAME = 'frames'

let dbPromise

const openDb = () => {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME)
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }
  return dbPromise
}

const keyFor = (videoSrc, frameIndex) => `${videoSrc}#${frameIndex}`

export default {
  async put(videoSrc, frameIndex, blob) {
    try {
      const db = await openDb()
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
        tx.objectStore(STORE_NAME).put(blob, keyFor(videoSrc, frameIndex))
      })
    } catch (e) {
      console.warn('frameCache.put error', e)
    }
  },
  async get(videoSrc, frameIndex) {
    try {
      const db = await openDb()
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly')
        tx.onerror = () => reject(tx.error)
        const req = tx.objectStore(STORE_NAME).get(keyFor(videoSrc, frameIndex))
        req.onsuccess = () => resolve(req.result || null)
        req.onerror = () => reject(req.error)
      })
    } catch (e) {
      console.warn('frameCache.get error', e)
      return null
    }
  },
  async clearForVideo(videoSrc) {
    try {
      const db = await openDb()
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
        const store = tx.objectStore(STORE_NAME)
        const req = store.openCursor()
        req.onsuccess = () => {
          const cursor = req.result
          if (cursor) {
            if (String(cursor.key).startsWith(`${videoSrc}#`)) {
              cursor.delete()
            }
            cursor.continue()
          }
        }
        req.onerror = () => reject(req.error)
      })
    } catch (e) {
      console.warn('frameCache.clearForVideo error', e)
    }
  }
}
