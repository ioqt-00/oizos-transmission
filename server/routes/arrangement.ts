import { Router } from 'express'
import db from '../db'

const arrangementRouter = Router()

arrangementRouter.put('/:id', (req,res)=>{
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

arrangementRouter.delete('/:id',(req,res)=>{
  db.prepare('DELETE FROM arrangement_items WHERE id=?').run(Number(req.params.id))
  res.sendStatus(204)
})

export default arrangementRouter
