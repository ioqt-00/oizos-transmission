import express from 'express'
import cors from 'cors'
import path from 'node:path'
import db from './db.ts'

import songsRouter from './routes/songs.ts'
import arrangementRouter from './routes/arrangement.ts'
import blocksRouter from './routes/blocks.ts'
import structureRouter from './routes/structure.ts'
import measuresRouter from './routes/measures.ts'

import { uploadDir, PORT, ROOT } from './services/song.ts'

const app=express()

app.use(cors());
app.use(express.json());
app.use('/uploads',express.static(uploadDir))

app.get('/api/parts',(_r,res)=>res.json(db.prepare('SELECT * FROM parts ORDER BY position').all()))
app.use('/api/songs', songsRouter)
app.use('/api/arrangement', arrangementRouter)
app.use('/api/blocks', blocksRouter)
app.use('/api/structure', structureRouter)
app.use('/api/measures', measuresRouter)

// FRONTEND EN PRODUCTION
if (process.env.NODE_ENV === 'production') {
  const clientPath = path.join(ROOT, 'client', 'dist')

  app.use(express.static(clientPath))

  app.use((_req, res) => {
    res.sendFile(path.join(clientPath, 'index.html'))
  })
}

app.listen(PORT,()=>console.log(`API: http://localhost:${PORT}`))
