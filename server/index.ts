import express from 'express'
import cors from 'cors'
import multer from 'multer'
import Database from 'better-sqlite3'
import path from 'node:path'
import fs from 'node:fs'
import { createSaveSong } from './saveSong'

const app=express(),PORT=3001,ROOT=process.cwd()
const dataDir=path.join(ROOT,'server','data'),uploadDir=path.join(ROOT,'server','uploads')
fs.mkdirSync(dataDir,{recursive:true});fs.mkdirSync(uploadDir,{recursive:true})
const db=new Database(path.join(dataDir,'orchestra.db'));db.pragma('foreign_keys = ON')

const saveSong = createSaveSong(db)

db.exec(`
CREATE TABLE IF NOT EXISTS parts(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL UNIQUE,position INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS songs(id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL UNIQUE,artist TEXT DEFAULT '',composer TEXT DEFAULT '',arranger TEXT DEFAULT '',duration TEXT DEFAULT '',tempo TEXT DEFAULT '',key_signature TEXT DEFAULT '',notes TEXT DEFAULT '',lyrics TEXT DEFAULT '',url_drive TEXT DEFAULT '',created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS scores(id INTEGER PRIMARY KEY AUTOINCREMENT,song_id INTEGER NOT NULL REFERENCES songs(id) ON DELETE CASCADE,part_id INTEGER NOT NULL REFERENCES parts(id) ON DELETE CASCADE,file_name TEXT NOT NULL,file_path TEXT NOT NULL,UNIQUE(song_id,part_id));
CREATE TABLE IF NOT EXISTS grid_blocks(id INTEGER PRIMARY KEY AUTOINCREMENT,song_id INTEGER NOT NULL REFERENCES songs(id) ON DELETE CASCADE,name TEXT NOT NULL,position INTEGER NOT NULL,notes TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS measures(id INTEGER PRIMARY KEY AUTOINCREMENT,block_id INTEGER NOT NULL REFERENCES grid_blocks(id) ON DELETE CASCADE,position INTEGER NOT NULL,chord TEXT DEFAULT '',beats INTEGER NOT NULL DEFAULT 4,notes TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS structure_items(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  song_id INTEGER NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  block_id INTEGER NOT NULL REFERENCES grid_blocks(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  repeat_count INTEGER NOT NULL DEFAULT 1,
  notes TEXT DEFAULT ''
  );
CREATE TABLE IF NOT EXISTS arrangement_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  song_id INTEGER NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  part_id INTEGER NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
  start_halfbeat INTEGER NOT NULL,
  end_halfbeat INTEGER NOT NULL,
  label TEXT DEFAULT '',
  notes TEXT DEFAULT ''
  );
`)

const defaultParts = ['Accordéon', 'Basse', 'Clarinette', 'Cordes Frottées', 'Flûte', 'Médium', 'Percus', 'Saxophone Alto', 'Trompette', 'Chant', 'Chant 2', 'Chant 3']
const ins=db.prepare('INSERT OR IGNORE INTO parts(name,position) VALUES(?,?)');
defaultParts.forEach((x,i)=>ins.run(x,i))
app.use(cors());
app.use(express.json());
app.use('/uploads',express.static(uploadDir))

const storage=multer.diskStorage({destination:(_r,_f,cb)=>cb(null,uploadDir),filename:(req,file,cb)=>cb(null,`${Date.now()}-${req.params.id}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g,'_')}`)})
const upload=multer({storage,fileFilter:(_r,file,cb)=>cb(null,file.mimetype==='application/pdf')})

function songWithData(id:number){
 const song=db.prepare('SELECT * FROM songs WHERE id=?').get(id) as any;if(!song)return null
 return {
  ...song,
  scores:db.prepare('SELECT * FROM scores WHERE song_id=? ORDER BY part_id').all(id),
  blocks:db.prepare('SELECT * FROM grid_blocks WHERE song_id=? ORDER BY position,id').all(id),
  measures:db.prepare(`SELECT m.* FROM measures m JOIN grid_blocks b ON b.id=m.block_id WHERE b.song_id=? ORDER BY b.position,m.position,m.id`).all(id),
  structure:db.prepare('SELECT * FROM structure_items WHERE song_id=? ORDER BY position,id').all(id),
  arrangement:db.prepare('SELECT * FROM arrangement_items WHERE song_id=? ORDER BY part_id').all(id)
 }
}

// PARTS
app.get('/api/parts',(_r,res)=>res.json(db.prepare('SELECT * FROM parts ORDER BY position').all()))

// SONGS
app.get('/api/songs',(_r,res)=>res.json(db.prepare('SELECT * FROM songs ORDER BY title COLLATE NOCASE').all()))
app.get('/api/songs/:id',(req,res)=>{
  const x=songWithData(Number(req.params.id));
  if(!x)return res.status(404).send('Morceau introuvable');
  res.json(x)
})
app.post('/api/songs',(req,res)=>{
 try{const {title,...f}=req.body;if(!title?.trim())return res.status(400).send('Le titre est obligatoire.')
 const r=db.prepare(`INSERT INTO songs(title,artist,composer,arranger,duration,tempo,key_signature,notes,lyrics,url_drive) VALUES(@title,@artist,@composer,@arranger,@duration,@tempo,@key_signature,@notes,@lyrics,@url_drive)`).run({title:title.trim(),artist:f.artist||'',composer:f.composer||'',arranger:f.arranger||'',duration:f.duration||'',tempo:f.tempo||'',key_signature:f.key_signature||'',notes:f.notes||'',lyrics:f.lyrics||'',url_drive:f.url_drive||''})
 res.json({id:Number(r.lastInsertRowid)})}catch{res.status(400).send('Un morceau portant ce titre existe déjà.')}
})
app.put('/api/songs/:id', (req, res) => {
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
app.delete('/api/songs/:id',(req,res)=>{db.prepare('DELETE FROM songs WHERE id=?').run(Number(req.params.id));res.sendStatus(204)})
app.post('/api/songs/:id/scores',(req,res)=>{ // upload.single('file')
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

// BLOCKS
app.post('/api/songs/:id/blocks',(req,res)=>{
 const songId=Number(req.params.id),max=db.prepare('SELECT COALESCE(MAX(position),-1) p FROM grid_blocks WHERE song_id=?').get(songId) as any
 const r=db.prepare('INSERT INTO grid_blocks(song_id,name,position,notes) VALUES(?,?,?,?)').run(songId,req.body.name||'Bloc',max.p+1,req.body.notes||'')
 res.json({id:Number(r.lastInsertRowid)})
})
app.put('/api/blocks/:id',(req,res)=>{
 const id=Number(req.params.id),old=db.prepare('SELECT * FROM grid_blocks WHERE id=?').get(id) as any;if(!old)return res.status(404).send('Bloc introuvable')
 db.prepare('UPDATE grid_blocks SET name=?,notes=? WHERE id=?').run(req.body.name??old.name,req.body.notes??old.notes,id);res.json({ok:true})
})
app.delete('/api/blocks/:id',(req,res)=>{db.prepare('DELETE FROM grid_blocks WHERE id=?').run(Number(req.params.id));res.sendStatus(204)})
app.post('/api/blocks/:id/measures',(req,res)=>{
 const blockId=Number(req.params.id),max=db.prepare('SELECT COALESCE(MAX(position),-1) p FROM measures WHERE block_id=?').get(blockId) as any
 const r=db.prepare('INSERT INTO measures(block_id,position,chord,beats,notes) VALUES(?,?,?,?,?)').run(blockId,max.p+1,req.body.chord||'',Number(req.body.beats)||4,req.body.notes||'');res.json({id:Number(r.lastInsertRowid)})
})

// MEASURES
app.put('/api/measures/:id',(req,res)=>{
 const id=Number(req.params.id),old=db.prepare('SELECT * FROM measures WHERE id=?').get(id) as any;if(!old)return res.status(404).send('Mesure introuvable')
 db.prepare('UPDATE measures SET chord=?,beats=?,notes=? WHERE id=?').run(req.body.chord??old.chord,Number(req.body.beats)||4,req.body.notes??old.notes,id);res.json({ok:true})
})
app.delete('/api/measures/:id',(req,res)=>{db.prepare('DELETE FROM measures WHERE id=?').run(Number(req.params.id));res.sendStatus(204)})

// STRUCTURE
app.post('/api/songs/:id/structure',(req,res)=>{
 const songId=Number(req.params.id),block=db.prepare('SELECT id FROM grid_blocks WHERE id=? AND song_id=?').get(Number(req.body.block_id),songId) as any
 if(!block)return res.status(400).send('Bloc invalide.')
 const max=db.prepare('SELECT COALESCE(MAX(position),-1) p FROM structure_items WHERE song_id=?').get(songId) as any
 const r=db.prepare('INSERT INTO structure_items(song_id,block_id,position,repeat_count,notes) VALUES(?,?,?,?,?)').run(songId,block.id,max.p+1,Number(req.body.repeat_count)||1,req.body.notes||'');res.json({id:Number(r.lastInsertRowid)})
})
app.put('/api/structure/:id',(req,res)=>{
 const id=Number(req.params.id),old=db.prepare('SELECT * FROM structure_items WHERE id=?').get(id) as any;
 if(!old)return res.status(404).send('Occurrence introuvable')
 if(req.body.block_id!==undefined){
  const ok=db.prepare('SELECT id FROM grid_blocks WHERE id=? AND song_id=?').get(Number(req.body.block_id),old.song_id);
  if(!ok)return res.status(400).send('Bloc invalide.')
  }
 db.prepare('UPDATE structure_items SET block_id=?,repeat_count=?,notes=? WHERE id=?').run(Number(req.body.block_id)||old.block_id,Number(req.body.repeat_count)||1,req.body.notes??old.notes,id);
 res.json({ok:true})
})
app.delete('/api/structure/:id',(req,res)=>{db.prepare('DELETE FROM structure_items WHERE id=?').run(Number(req.params.id));res.sendStatus(204)})

// ARRANGEMENT
app.post('/api/songs/:id/arrangement', (req,res)=>{
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
app.put('/api/arrangement/:id', (req,res)=>{
  try {
    const id = Number(req.params.id)
    const old = db
      .prepare('SELECT * FROM arrangement_items WHERE id=?')
      .get(id) as any

    if (!old) {
      return res.status(404).send('Élément introuvable.')
    }
    db.prepare(`
      UPDATE arrangement_items
      SET
        start_halfbeat=?,
        end_halfbeat=?,
        label=?,
        notes=?
      WHERE id=?
    `).run(
      Math.max(
        0,
        Number(req.body.start_halfbeat ?? old.start_halfbeat)
      ),
      Math.max(
        1,
        Number(
          req.body.end_halfbeat ??
          old.end_halfbeat
        )
      ),
      req.body.label ?? old.label,
      req.body.notes ?? old.notes,
      id
    )
    res.json({ ok:true })
  } catch {
    res.status(400).send('Impossible de modifier cet élément.')
  }
})
app.delete('/api/arrangement/:id',(req,res)=>{
  db
    .prepare('DELETE FROM arrangement_items WHERE id=?')
    .run(Number(req.params.id))
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
