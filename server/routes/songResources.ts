import { Router } from 'express'
import db from '../db'

import { isResourceType } from '../services/song'

const songResourcesRouter = Router()

// RESOURCES
songResourcesRouter.put('/:id', (req, res) => {
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

songResourcesRouter.delete('/:id', (req, res) => {
  const id = Number(req.params.id)

  const result = db.prepare('DELETE FROM song_resources WHERE id=?').run(id)

  if (result.changes === 0) {
    return res.status(404).send('Ressource introuvable')
  }

  res.sendStatus(204)
})

export default songResourcesRouter
