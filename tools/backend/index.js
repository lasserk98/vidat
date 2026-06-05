// index.js
// Copyright (C) 2021, ANU CVML

// --- setup ----------------------------------------------------------------------

const fs = require('fs')
const express = require('express')
const bodyParser = require('body-parser')
const path = require('path')
const cors = require('cors')
const multer = require('multer')
const { exec } = require('child_process')
const { url } = require('inspector')

const app = express()
const port = process.env.PORT || 3000

// view engine setup
app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'ejs')

// public assets
app.use(express.static(path.join(__dirname, 'public')))

// handling posts
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())
app.use(cors())

// static serving of vidat
app.use('/vidat', express.static('vidat'))
const vidat = 'http://localhost:' + port + '/vidat'
const submit = 'http://localhost:' + port + '/'

// multer setup
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, 'vidat', 'video')
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    cb(null, dir)
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname)
  }
})
const upload = multer({ storage: storage })

// --- helper functions -----------------------------------------------------------

function clearProcessedTemp() {
  const directory = path.join(__dirname, 'vidat', 'video', 'processed_temp')
  if (fs.existsSync(directory)) {
    try {
      const files = fs.readdirSync(directory)
      for (const file of files) {
        fs.unlinkSync(path.join(directory, file))
      }
      console.log('Cleaned processed_temp directory')
    } catch (err) {
      console.error('Error cleaning temp files:', err)
    }
  }
}

function get_videos(base) {
  videos = {}

  // read video directory
  fs.readdirSync(path.join(base, 'video')).forEach((file) => {
    //console.log(file)
    ext = file.split('.').pop()
    if (ext == 'avi' || ext == 'mp4') {
      name = file.substr(0, file.length - ext.length - 1)
      videos[name] = { video: file, annotation: null }
    }
  })

  // read annotation directory
  fs.readdirSync(path.join(base, 'annotation')).forEach((file) => {
    //console.log(file)
    ext = file.split('.').pop()
    if (ext == 'json') {
      name = file.substr(0, file.length - ext.length - 1)
      if (name in videos) {
        videos[name].annotation = file
      }
    }
  })

  return videos
}

// --- routes ---------------------------------------------------------------------

app.get('/stream', (req, res) => {
  const filePath = req.query.path
  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).send('File not found')
  }
  const stat = fs.statSync(filePath)
  const fileSize = stat.size
  const range = req.headers.range

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-')
    const start = parseInt(parts[0], 10)
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1
    const chunksize = end - start + 1
    const file = fs.createReadStream(filePath, { start, end })
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'video/mp4'
    }
    res.writeHead(206, head)
    file.pipe(res)
  } else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': 'video/mp4'
    }
    res.writeHead(200, head)
    fs.createReadStream(filePath).pipe(res)
  }
})

// download processed file
app.get('/download/processed/:filename', (req, res) => {
  const filename = req.params.filename
  // Validate filename to prevent directory traversal
  if (filename.includes('..') || filename.includes('/')) {
      return res.status(400).send('Invalid filename')
  }
  // The processed_temp directory
  const filePath = path.join(__dirname, 'vidat', 'video', 'processed_temp', filename)
  if (fs.existsSync(filePath)) {
      res.download(filePath, filename) // This sets Content-Disposition attachment
  } else {
      res.status(404).send('File not found')
  }
})

app.get('/', (req, res) => {
  videos = get_videos(path.join(__dirname, 'vidat'))
  res.render('index.ejs', { videos: videos, vidaturl: vidat, submission: submit })
})

app.post('/', (req, res) => {
  const name = req.query.token
  const json = JSON.stringify(req.body)

  if (name == null) {
    return res.status(500).send('Invalid token')
  }

  const base = path.join(path.join(__dirname, 'vidat'), 'annotation')
  fs.writeFile(path.join(base, name + '.json'), json, (err, data) => {
    if (err) {
      console.log(err)
      return res.status(500).send('Server error!')
    }
    res.send('Annotation saved!')
  })
})


// process endpoint
app.post('/preprocess', upload.single('video'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.')
  }

  const inputPath = req.file.path
  const baseName = path.basename(req.file.originalname, path.extname(req.file.originalname))
  
  // Use a temporary processed dir in the server folder (standard behavior)
  // We no longer support manualPath since we just download the files.
  // Although we could keep them for streaming during the session.
  const processedDir = path.join(path.dirname(inputPath), 'processed_temp')

  // Ensure processed directory exists
  if (!fs.existsSync(processedDir)) {
    try {
      fs.mkdirSync(processedDir, { recursive: true })
    } catch (e) {
      console.error(`Could not create directory ${processedDir}: ${e}`)
      return res.status(500).send(`Could not create output directory: ${e.message}`)
    }
  }

  const leftOutputName = `${baseName}_left.mp4`
  const rightOutputName = `${baseName}_right.mp4`
  const leftOutputPath = path.join(processedDir, leftOutputName)
  const rightOutputPath = path.join(processedDir, rightOutputName)

  // URLs for downloading/streaming
  // We need to serve this temp folder
  const leftUrl = `/vidat/video/processed_temp/${leftOutputName}`
  const rightUrl = `/vidat/video/processed_temp/${rightOutputName}`
  
  const leftDownloadUrl = `/download/processed/${leftOutputName}`
  const rightDownloadUrl = `/download/processed/${rightOutputName}`

  // Ensure we can serve from processed_temp - likely needs a static route if not inside 'vidat'
  // Actually inputPath is in 'vidat/video/' (from multer config)
  // So path.dirname(inputPath) is '.../backend/vidat/video'
  // So processedDir is '.../backend/vidat/video/processed_temp'
  // And express serves '/vidat' from 'vidat' folder.
  // So URL /vidat/video/processed_temp/... should work.

  // Use libx264 instead of h264_nvenc since hardware acceleration is not available
  const command = `ffmpeg -y -i "${inputPath}" -filter_complex "[0:v]yadif,split=2[left_in][right_in]; [left_in]crop=960:1080:0:0,scale=1280:720,setsar=1[left_out]; [right_in]crop=960:1080:960:0,scale=1280:720,setsar=1[right_out]" -map "[left_out]" -c:v libx264 -crf 19 -preset fast "${leftOutputPath}" -map "[right_out]" -c:v libx264 -crf 19 -preset fast "${rightOutputPath}"`

  console.log(`Executing: ${command}`)

  exec(command, (error, stdout, stderr) => {
    // Delete the original uploaded file
    fs.unlink(inputPath, (err) => {
      if (err) console.error(`Failed to delete original file: ${err}`)
    })

    if (error) {
      console.error(`exec error: ${error}`)
      return res.status(500).send(`Processing failed: ${error.message}`)
    }
    loaed
    // Check if output files were actually created
    if (!fs.existsSync(leftOutputPath) || !fs.existsSync(rightOutputPath)) {
       return res.status(500).send('Processing failed: Output files not found')
    }

    res.json({
      message: 'Processing complete',
      left: {
        name: leftOutputName,
        url: leftUrl,
        downloadUrl: leftDownloadUrl
      },
      right: {
        name: rightOutputName,
        url: rightUrl,
        downloadUrl: rightDownloadUrl
      }
    })
  })
})

// --- launch application ---------------------------------------------------------

// Clear temp files on startup
clearProcessedTemp()

console.log('Server listening on port ' + port)
const server = app.listen(port)

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nClosing server and cleaning up...')
  clearProcessedTemp()
  server.close(() => {
    console.log('Server closed')
    process.exit(0)
  })
})
