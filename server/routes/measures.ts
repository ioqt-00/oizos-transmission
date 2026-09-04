import { Router } from 'express'
import db from '../db'

const measuresRouter = Router()

measuresRouter.put('/:id',(req,res)=>{
 const id=Number(req.params.id),old=db.prepare('SELECT * FROM measures WHERE id=?').get(id) as any
 if(!old)return res.status(404).send('Mesure introuvable')
 db.prepare('UPDATE measures SET chord=?,beats=?,notes=? WHERE id=?').run(req.body.chord??old.chord,Number(req.body.beats)||4,req.body.notes??old.notes,id)
 res.json({ok:true})
})

measuresRouter.delete('/:id',(req,res)=>{
    db.prepare('DELETE FROM measures WHERE id=?').run(Number(req.params.id))
    res.sendStatus(204)
})

export default measuresRouter
