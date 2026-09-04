import { Router } from 'express'
import db from '../db'
import path from 'node:path'
import fs from 'node:fs'
import { createSaveSong } from '../saveSong'
import { isResourceType } from '../services/song'

const songRouter = Router()

function songWithData(id:number){
 const song=db.prepare('SELECT * FROM songs WHERE id=?').get(id) as any;if(!song)return null
 return {
  ...song,
  scores:db.prepare('SELECT * FROM scores WHERE song_id=? ORDER BY part_id').all(id),
  blocks:db.prepare('SELECT * FROM grid_blocks WHERE song_id=? ORDER BY position,id').all(id),
  measures:db.prepare(`SELECT m.* FROM measures m JOIN grid_blocks b ON b.id=m.block_id WHERE b.song_id=? ORDER BY b.position,m.position,m.id`).all(id),
  structure:db.prepare('SELECT * FROM structure_items WHERE song_id=? ORDER BY position,id').all(id),
  arrangement:db.prepare('SELECT * FROM arrangement_items WHERE song_id=? ORDER BY part_id').all(id),
  resources:db.prepare('SELECT * FROM song_resources WHERE song_id=? ORDER BY position, id').all(id),
  transmission_resources:db.prepare('SELECT * FROM transmission_resources WHERE song_id=? ORDER BY position, id').all(id)
 }
}

const saveSong = createSaveSong(db)

songRouter.get('/',(_r,res)=>res.json(db.prepare('SELECT * FROM songs ORDER BY title COLLATE NOCASE').all()))
songRouter.get('/:id',(req,res)=>{
  const x=songWithData(Number(req.params.id));
  if(!x)return res.status(404).send('Morceau introuvable');
  res.json(x)
})
songRouter.post('/',(req,res)=>{
 try{const {title,...f}=req.body;if(!title?.trim())return res.status(400).send('Le titre est obligatoire.')
 const r=db.prepare(`INSERT INTO songs(title,artist,composer,arranger,duration,tempo,key_signature,notes,lyrics,url_drive) VALUES(@title,@artist,@composer,@arranger,@duration,@tempo,@key_signature,@notes,@lyrics,@url_drive)`).run({title:title.trim(),artist:f.artist||'',composer:f.composer||'',arranger:f.arranger||'',duration:f.duration||'',tempo:f.tempo||'',key_signature:f.key_signature||'',notes:f.notes||'',lyrics:f.lyrics||'',url_drive:f.url_drive||''})
 res.json({id:Number(r.lastInsertRowid)})}catch{res.status(400).send('Un morceau portant ce titre existe déjà.')}
})
songRouter.put('/:id', (req, res) => {
  try {
    saveSong(
      Number(req.params.id),
      req.body
    )
    res.json({
      ok: true
    })
  } catch (error) {
    console.error(error)
    res.status(400).send(
      'Impossible d’enregistrer le morceau.'
    )
  }
})
songRouter.delete('/:id',(req,res)=>{db.prepare('DELETE FROM songs WHERE id=?').run(Number(req.params.id));res.sendStatus(204)})
songRouter.post('/:id/scores',(req,res)=>{ // upload.single('file')
  return res.status(400).send("Pour des raisons de sécurité, le upload est désactivé pour le moment")
  if(!req.file)
    return res.status(400).send('Veuillez sélectionner un PDF.')
  const songId=Number(req.params.id)
  const partId=Number(req.body.partId)
  const old=db.prepare('SELECT * FROM scores WHERE song_id=? AND part_id=?').get(songId,partId) as any
  if(old){
    const p=path.join(uploadDir,old.file_path)
    if(fs.existsSync(p)){
      fs.unlinkSync(p)
      db.prepare('UPDATE scores SET file_name=?,file_path=? WHERE id=?').run(req.file.originalname,req.file.filename,old.id)
    }
  }
 else 
  db.prepare('INSERT INTO scores(song_id,part_id,file_name,file_path) VALUES(?,?,?,?)').run(songId,partId,req.file.originalname,req.file.filename)
 res.json({ok:true})
})

songRouter.post('/:id/blocks',(req,res)=>{
  const songId=Number(req.params.id)
  const max=db.prepare('SELECT COALESCE(MAX(position),-1) p FROM grid_blocks WHERE song_id=?').get(songId) as any
  const r=db.prepare('INSERT INTO grid_blocks(song_id,name,position,notes) VALUES(?,?,?,?)').run(songId,req.body.name||'Bloc',max.p+1,req.body.notes||'')
  res.json({id:Number(r.lastInsertRowid)})
})

songRouter.post('/:id/structure',(req,res)=>{
  const songId=Number(req.params.id)
  const block=db.prepare('SELECT id FROM grid_blocks WHERE id=? AND song_id=?').get(Number(req.body.block_id),songId) as any
  if(!block)return res.status(400).send('Bloc invalide.')
  const max=db.prepare('SELECT COALESCE(MAX(position),-1) p FROM structure_items WHERE song_id=?').get(songId) as any
  const r=db.prepare('INSERT INTO structure_items(song_id,block_id,position,repeat_count,notes) VALUES(?,?,?,?,?)').run(songId,block.id,max.p+1,Number(req.body.repeat_count)||1,req.body.notes||'');res.json({id:Number(r.lastInsertRowid)})
})

songRouter.post('/:id/arrangement', (req,res)=>{
  try {
    const songId = Number(req.params.id)
    const song = db
      .prepare('SELECT id FROM songs WHERE id=?')
      .get(songId)
    if (!song) {
      return res.status(404).send('Morceau introuvable.')
    }
    const structureItem = db
      .prepare(`
        SELECT id
        FROM structure_items
        WHERE id=? AND song_id=?
      `)
      .get(
        Number(req.body.structure_item_id),
        songId
      )
    if (!structureItem) {
      return res.status(400).send('Occurrence de structure invalide.')
    }
    const part = db
      .prepare('SELECT id FROM parts WHERE id=?')
      .get(Number(req.body.part_id))
    if (!part) {
      return res.status(400).send('Pupitre invalide.')
    }
    const startHalfbeat = Math.max(
      0,
      Number(req.body.start_halfbeat) || 0
    )
    const endHalfbeats = Math.max(
      1,
      Number(req.body.end_halfbeat) || startHalfbeat+1
    )
    const r = db.prepare(`
      INSERT INTO arrangement_items(
        song_id,
        part_id,
        start_halfbeat,
        end_halfbeat,
        label,
        notes
      )
      VALUES(?,?,?,?,?,?,?)
    `).run(
      songId,
      Number(req.body.part_id),
      startHalfbeat,
      endHalfbeats,
      req.body.label || '',
      req.body.notes || ''
    )
    res.json({
      id: Number(r.lastInsertRowid)
    })
  } catch {
    res.status(400).send("Impossible de créer l'élément d'arrangement.")
  }
})

songRouter.get('/:id/song-resources', (req, res) => {
  const songId = Number(req.params.id)
  const song = db.prepare('SELECT id FROM songs WHERE id=?').get(songId)
  if (!song) {
    return res.status(404).send('Morceau introuvable')
  }
  const resources = db.prepare(`SELECT * FROM song_resources WHERE song_id=? ORDER BY position, id`).all(songId)
  res.json(resources)
})

songRouter.post('/:id/song-resources', (req, res) => {
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

songRouter.get('/:id/transmission-resources', (req, res) => {
  const songId = Number(req.params.id)
  const song = db.prepare('SELECT id FROM songs WHERE id=?').get(songId)
  if (!song) {
    return res.status(404).send('Morceau introuvable')
  }
  const resources = db.prepare(`SELECT * FROM transmission_resources WHERE song_id=? ORDER BY position, id`).all(songId)
  res.json(resources)
})

songRouter.post('/:id/transmission-resources', (req, res) => {
  const songId = Number(req.params.id)
  const song = db.prepare('SELECT id FROM songs WHERE id=?').get(songId)
  if (!song) {
    return res.status(404).send('Morceau introuvable')
  }
  const {arrangementItemId, type, title, content = ''} = req.body

  if (!isResourceType(type)) {return res.status(400).send('Type de ressource invalide. Types autorisés : audio, video, note, link.')}
  if (!title?.trim()) {return res.status(400).send('Le titre de la ressource est obligatoire.')}

  const max = db.prepare(`SELECT COALESCE(MAX(position), -1) AS position FROM transmission_resources WHERE song_id=?`)
    .get(songId) as { position: number }

  const result = db
    .prepare(`
      INSERT INTO transmission_resources
        (song_id, arrangement_item_id, type, title, content, position)
      VALUES
        (?, ?, ?, ?, ?, ?)
    `)
    .run(
      songId,
      arrangementItemId,
      type,
      title.trim(),
      content ?? '',
      max.position + 1
    )

  res.json({id: Number(result.lastInsertRowid)})
})

export default songRouter
