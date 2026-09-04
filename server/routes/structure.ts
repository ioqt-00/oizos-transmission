import { Router } from 'express'
import db from '../db'

const structureRouter = Router()

structureRouter.put('/:id',(req,res)=>{
 const id=Number(req.params.id),old=db.prepare('SELECT * FROM structure_items WHERE id=?').get(id) as any;
 if(!old)return res.status(404).send('Occurrence introuvable')
 if(req.body.block_id!==undefined){
  const ok=db.prepare('SELECT id FROM grid_blocks WHERE id=? AND song_id=?').get(Number(req.body.block_id),old.song_id);
  if(!ok)return res.status(400).send('Bloc invalide.')
  }
 db.prepare('UPDATE structure_items SET block_id=?,repeat_count=?,notes=? WHERE id=?').run(Number(req.body.block_id)||old.block_id,Number(req.body.repeat_count)||1,req.body.notes??old.notes,id);
 res.json({ok:true})
})

structureRouter.delete('/:id',(req,res)=>{
    db.prepare('DELETE FROM structure_items WHERE id=?').run(Number(req.params.id))
    res.sendStatus(204)
})

export default structureRouter
