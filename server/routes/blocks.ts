import { Router } from 'express'
import db from '../db'

const blocksRouter = Router()

// BLOCKS
blocksRouter.put('/:id',(req,res)=>{
  const id=Number(req.params.id)
  const old=db.prepare('SELECT * FROM grid_blocks WHERE id=?').get(id) as any
  if(!old)return res.status(404).send('Bloc introuvable')
  db.prepare('UPDATE grid_blocks SET name=?,notes=? WHERE id=?').run(req.body.name??old.name,req.body.notes??old.notes,id)
  res.json({ok:true})
})

blocksRouter.delete('/:id',(req,res)=>{
    db.prepare('DELETE FROM grid_blocks WHERE id=?').run(Number(req.params.id))
    res.sendStatus(204)
})

blocksRouter.post('/:id/measures',(req,res)=>{
 const blockId=Number(req.params.id)
 const max=db.prepare('SELECT COALESCE(MAX(position),-1) p FROM measures WHERE block_id=?').get(blockId) as any
 const r=db.prepare('INSERT INTO measures(block_id,position,chord,beats,notes) VALUES(?,?,?,?,?)').run(blockId,max.p+1,req.body.chord||'',Number(req.body.beats)||4,req.body.notes||'')
 res.json({id:Number(r.lastInsertRowid)})
})

export default blocksRouter
