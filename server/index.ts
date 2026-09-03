import express from 'express'
import cors from 'cors'
import multer from 'multer'
import path from 'node:path'
import db from './db.ts'

import songRouter from './routes/song'
import { dataDir, uploadDir, PORT, ROOT, isResourceType } from './services/song.ts'

const app=express()

app.use(cors());
app.use(express.json());
app.use('/uploads',express.static(uploadDir))

const storage=multer.diskStorage({destination:(_r,_f,cb)=>cb(null,uploadDir),filename:(req,file,cb)=>cb(null,`${Date.now()}-${req.params.id}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g,'_')}`)})
const upload=multer({storage,fileFilter:(_r,file,cb)=>cb(null,file.mimetype==='application/pdf')})

// PARTS
app.get('/api/parts',(_r,res)=>res.json(db.prepare('SELECT * FROM parts ORDER BY position').all()))

// BLOCKS
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

app.use('/api/songs', songRouter)
// FRONTEND EN PRODUCTION
if (process.env.NODE_ENV === 'production') {
  const clientPath = path.join(ROOT, 'client', 'dist')

  app.use(express.static(clientPath))

  app.use((_req, res) => {
    res.sendFile(path.join(clientPath, 'index.html'))
  })
}

app.listen(PORT,()=>console.log(`API: http://localhost:${PORT}`))
