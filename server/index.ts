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

// RESOURCES
app.get('/api/songs/:id/resources', (req, res) => {
  const songId = Number(req.params.id)
  const song = db.prepare('SELECT id FROM songs WHERE id=?').get(songId)
  if (!song) {
    return res.status(404).send('Morceau introuvable')
  }
  const resources = db.prepare(`SELECT * FROM song_resources WHERE song_id=? ORDER BY position, id`).all(songId)
  res.json(resources)
})

app.post('/api/songs/:id/resources', (req, res) => {
  const songId = Number(req.params.id)
  const song = db.prepare('SELECT id FROM songs WHERE id=?').get(songId)
  if (!song) {
    return res.status(404).send('Morceau introuvable')
  }
  const {type, title, content = ''} = req.body

  if (!isResourceType(type)) {return res.status(400).send('Type de ressource invalide. Types autorisés : audio, video, note, link.')}
  if (!title?.trim()) {return res.status(400).send('Le titre de la ressource est obligatoire.')}

  const max = db.prepare(`SELECT COALESCE(MAX(position), -1) AS position FROM song_resources WHERE song_id=?`)
    .get(songId) as { position: number }

  const result = db
    .prepare(`
      INSERT INTO song_resources
        (song_id, type, title, content, position)
      VALUES
        (?, ?, ?, ?, ?)
    `)
    .run(
      songId,
      type,
      title.trim(),
      content ?? '',
      max.position + 1
    )

  res.json({id: Number(result.lastInsertRowid)})
})

app.put('/api/song-resources/:id', (req, res) => {
  const id = Number(req.params.id)

  const resource = db.prepare('SELECT * FROM song_resources WHERE id=?').get(id) as any

  if (!resource) {return res.status(404).send('Ressource introuvable')}

  const type = req.body.type ?? resource.type
  const title = req.body.title ?? resource.title
  const content = req.body.content ?? resource.content

  if (!isResourceType(type)) {
    return res.status(400).send('Type de ressource invalide. Types autorisés : audio, video, note, link.')
  }

  if (!title?.trim()) {
    return res.status(400).send('Le titre de la ressource est obligatoire.')
  }

  db.prepare(`
    UPDATE song_resources
    SET
      type=?,
      title=?,
      content=?
    WHERE id=?
  `).run(
    type,
    title.trim(),
    content ?? '',
    id
  )

  res.json({ ok: true })
})

app.delete('/api/song-resources/:id', (req, res) => {
  const id = Number(req.params.id)

  const result = db.prepare('DELETE FROM song_resources WHERE id=?').run(id)

  if (result.changes === 0) {
    return res.status(404).send('Ressource introuvable')
  }

  res.sendStatus(204)
})

// FRONTEND EN PRODUCTION
if (process.env.NODE_ENV === 'production') {
  const clientPath = path.join(ROOT, 'client', 'dist')

  app.use(express.static(clientPath))

  app.use((_req, res) => {
    res.sendFile(path.join(clientPath, 'index.html'))
  })
}

app.listen(PORT,()=>console.log(`API: http://localhost:${PORT}`))
