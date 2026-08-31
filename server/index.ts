import express from 'express'
import cors from 'cors'
import multer from 'multer'
import Database from 'better-sqlite3'
import path from 'node:path'
import fs from 'node:fs'

const app=express(),PORT=3001,ROOT=process.cwd()
const dataDir=path.join(ROOT,'server','data'),uploadDir=path.join(ROOT,'server','uploads')
fs.mkdirSync(dataDir,{recursive:true});fs.mkdirSync(uploadDir,{recursive:true})
const db=new Database(path.join(dataDir,'orchestra.db'));db.pragma('foreign_keys = ON')

db.exec(`
CREATE TABLE IF NOT EXISTS parts(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL UNIQUE,position INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS songs(id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL UNIQUE,artist TEXT DEFAULT '',composer TEXT DEFAULT '',arranger TEXT DEFAULT '',duration TEXT DEFAULT '',tempo TEXT DEFAULT '',key_signature TEXT DEFAULT '',style TEXT DEFAULT '',notes TEXT DEFAULT '',lyrics TEXT DEFAULT '',created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS scores(id INTEGER PRIMARY KEY AUTOINCREMENT,song_id INTEGER NOT NULL REFERENCES songs(id) ON DELETE CASCADE,part_id INTEGER NOT NULL REFERENCES parts(id) ON DELETE CASCADE,file_name TEXT NOT NULL,file_path TEXT NOT NULL,UNIQUE(song_id,part_id));
CREATE TABLE IF NOT EXISTS grid_blocks(id INTEGER PRIMARY KEY AUTOINCREMENT,song_id INTEGER NOT NULL REFERENCES songs(id) ON DELETE CASCADE,name TEXT NOT NULL,position INTEGER NOT NULL,notes TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS measures(id INTEGER PRIMARY KEY AUTOINCREMENT,block_id INTEGER NOT NULL REFERENCES grid_blocks(id) ON DELETE CASCADE,position INTEGER NOT NULL,chord TEXT DEFAULT '',beats INTEGER NOT NULL DEFAULT 4,notes TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS structure_items(id INTEGER PRIMARY KEY AUTOINCREMENT,song_id INTEGER NOT NULL REFERENCES songs(id) ON DELETE CASCADE,block_id INTEGER NOT NULL REFERENCES grid_blocks(id) ON DELETE CASCADE,position INTEGER NOT NULL,repeat_count INTEGER NOT NULL DEFAULT 1,notes TEXT DEFAULT '');
`)

const defaultParts = ['Accordéon', 'Basse', 'Clarinette', 'Cordes Frottées', 'Flûte', 'Médium', 'Percus', 'Saxophone Alto', 'Trompette', 'Chant', 'Chant 2', 'Chant 3']
const ins=db.prepare('INSERT OR IGNORE INTO parts(name,position) VALUES(?,?)');defaultParts.forEach((x,i)=>ins.run(x,i))
app.use(cors());app.use(express.json());app.use('/uploads',express.static(uploadDir))

const storage=multer.diskStorage({destination:(_r,_f,cb)=>cb(null,uploadDir),filename:(req,file,cb)=>cb(null,`${Date.now()}-${req.params.id}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g,'_')}`)})
const upload=multer({storage,fileFilter:(_r,file,cb)=>cb(null,file.mimetype==='application/pdf')})

function songWithData(id:number){
 const song=db.prepare('SELECT * FROM songs WHERE id=?').get(id) as any;if(!song)return null
 return {
  ...song,
  scores:db.prepare('SELECT * FROM scores WHERE song_id=? ORDER BY part_id').all(id),
  blocks:db.prepare('SELECT * FROM grid_blocks WHERE song_id=? ORDER BY position,id').all(id),
  measures:db.prepare(`SELECT m.* FROM measures m JOIN grid_blocks b ON b.id=m.block_id WHERE b.song_id=? ORDER BY b.position,m.position,m.id`).all(id),
  structure:db.prepare('SELECT * FROM structure_items WHERE song_id=? ORDER BY position,id').all(id)
 }
}
app.get('/api/parts',(_r,res)=>res.json(db.prepare('SELECT * FROM parts ORDER BY position').all()))
app.get('/api/songs',(_r,res)=>res.json(db.prepare('SELECT * FROM songs ORDER BY title COLLATE NOCASE').all()))
app.get('/api/songs/:id',(req,res)=>{const x=songWithData(Number(req.params.id));if(!x)return res.status(404).send('Morceau introuvable');res.json(x)})

app.post('/api/songs',(req,res)=>{
 try{const {title,...f}=req.body;if(!title?.trim())return res.status(400).send('Le titre est obligatoire.')
 const r=db.prepare(`INSERT INTO songs(title,artist,composer,arranger,duration,tempo,key_signature,style,notes,lyrics) VALUES(@title,@artist,@composer,@arranger,@duration,@tempo,@key_signature,@style,@notes,@lyrics)`).run({title:title.trim(),artist:f.artist||'',composer:f.composer||'',arranger:f.arranger||'',duration:f.duration||'',tempo:f.tempo||'',key_signature:f.key_signature||'',style:f.style||'',notes:f.notes||'',lyrics:f.lyrics||''})
 res.json({id:Number(r.lastInsertRowid)})}catch{res.status(400).send('Un morceau portant ce titre existe déjà.')}
})
app.put('/api/songs/:id',(req,res)=>{
 try{db.prepare(`UPDATE songs SET title=@title,artist=@artist,composer=@composer,arranger=@arranger,duration=@duration,tempo=@tempo,key_signature=@key_signature,style=@style,notes=@notes,lyrics=@lyrics,updated_at=CURRENT_TIMESTAMP WHERE id=@id`).run({id:Number(req.params.id),...req.body});res.json({id:Number(req.params.id)})}catch{res.status(400).send('Impossible de modifier ce morceau.')}
})
app.delete('/api/songs/:id',(req,res)=>{db.prepare('DELETE FROM songs WHERE id=?').run(Number(req.params.id));res.sendStatus(204)})

app.post('/api/songs/:id/scores',upload.single('file'),(req,res)=>{
 if(!req.file)return res.status(400).send('Veuillez sélectionner un PDF.')
 const songId=Number(req.params.id),partId=Number(req.body.partId),old=db.prepare('SELECT * FROM scores WHERE song_id=? AND part_id=?').get(songId,partId) as any
 if(old){const p=path.join(uploadDir,old.file_path);if(fs.existsSync(p))fs.unlinkSync(p);db.prepare('UPDATE scores SET file_name=?,file_path=? WHERE id=?').run(req.file.originalname,req.file.filename,old.id)}
 else db.prepare('INSERT INTO scores(song_id,part_id,file_name,file_path) VALUES(?,?,?,?)').run(songId,partId,req.file.originalname,req.file.filename)
 res.json({ok:true})
})

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
app.put('/api/measures/:id',(req,res)=>{
 const id=Number(req.params.id),old=db.prepare('SELECT * FROM measures WHERE id=?').get(id) as any;if(!old)return res.status(404).send('Mesure introuvable')
 db.prepare('UPDATE measures SET chord=?,beats=?,notes=? WHERE id=?').run(req.body.chord??old.chord,Number(req.body.beats)||4,req.body.notes??old.notes,id);res.json({ok:true})
})
app.delete('/api/measures/:id',(req,res)=>{db.prepare('DELETE FROM measures WHERE id=?').run(Number(req.params.id));res.sendStatus(204)})

app.post('/api/songs/:id/structure',(req,res)=>{
 const songId=Number(req.params.id),block=db.prepare('SELECT id FROM grid_blocks WHERE id=? AND song_id=?').get(Number(req.body.block_id),songId) as any
 if(!block)return res.status(400).send('Bloc invalide.')
 const max=db.prepare('SELECT COALESCE(MAX(position),-1) p FROM structure_items WHERE song_id=?').get(songId) as any
 const r=db.prepare('INSERT INTO structure_items(song_id,block_id,position,repeat_count,notes) VALUES(?,?,?,?,?)').run(songId,block.id,max.p+1,Number(req.body.repeat_count)||1,req.body.notes||'');res.json({id:Number(r.lastInsertRowid)})
})
app.put('/api/structure/:id',(req,res)=>{
 const id=Number(req.params.id),old=db.prepare('SELECT * FROM structure_items WHERE id=?').get(id) as any;if(!old)return res.status(404).send('Occurrence introuvable')
 if(req.body.block_id!==undefined){const ok=db.prepare('SELECT id FROM grid_blocks WHERE id=? AND song_id=?').get(Number(req.body.block_id),old.song_id);if(!ok)return res.status(400).send('Bloc invalide.')}
 db.prepare('UPDATE structure_items SET block_id=?,repeat_count=?,notes=? WHERE id=?').run(Number(req.body.block_id)||old.block_id,Number(req.body.repeat_count)||1,req.body.notes??old.notes,id);res.json({ok:true})
})
app.delete('/api/structure/:id',(req,res)=>{db.prepare('DELETE FROM structure_items WHERE id=?').run(Number(req.params.id));res.sendStatus(204)})

app.listen(PORT,()=>console.log(`API: http://localhost:${PORT}`))
