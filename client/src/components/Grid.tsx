import { useEffect, useMemo, useState } from 'react'

type GridBlock = { id:number; name:string; position:number; notes:string }
type Measure = { id:number; block_id:number; position:number; chord:string; beats:number; notes:string }

type GridEditorProps = {
  blocks: GridBlock[]
  measures: Measure[]
  setBlocks: React.Dispatch<
    React.SetStateAction<GridBlock[]>
  >
  setMeasures: React.Dispatch<
    React.SetStateAction<Measure[]>
  >
}

function MeasureEditor({m,index,update,deleteMeasure}:any){
  return <div className="measure"><span className="measure-number">{index+1}</span><input value={m.chord} placeholder="Accord" onChange={e=>update(m,{chord:e.target.value})}/>
    <select value={m.beats} onChange={e=>update(m,{beats:Number(e.target.value)})}>{[2,3,4,5,6,7,8].map(n=><option key={n} value={n}>{n}/4</option>)}</select>
    <button className="delete-measure" onClick={()=>deleteMeasure(m)}>×</button>
  </div>
}

export function GridEditor({blocks, measures, setBlocks, setMeasures}:GridEditorProps){
  function addMeasure(blockId:number){
    setMeasures(current => [
    ...current,
    {
      id: -Date.now(),
      block_id: blockId,
      position: current.filter(
        m => m.block_id === blockId
      ).length,
      chord: '',
      beats: 4,
      notes: ''
    }
  ])
  }

  function updateMeasure(m:Measure,patch:Partial<Measure>){
    setMeasures(current =>
      current.map(item =>
        item.id === m.id
          ? { ...item, ...patch }
          : item
      )
    )
  }

  function deleteMeasure(m:Measure){
    setMeasures(current =>
      current.filter(item =>
        item.id !== m.id
      )
    )
  }

  function addBlock(){
    setBlocks(current => [
    ...current,
    {
      id: -Date.now(),
      name: '',
      position: 0,
      notes: ''
    }
  ])
  }

  function updateBlock(b:GridBlock,patch:Partial<GridBlock>){
    setBlocks(current =>
      current.map(item =>
        item.id === b.id
          ? { ...item, ...patch }
          : item
      )
    )
  }

  function deleteBlock(b:GridBlock){
    setBlocks(current =>
      current.filter(item =>
        item.id !== b.id
      )
    )
  }

  return <section className="card">
    <div className="section-head"><div><h3>🎹 Grille</h3><p className="muted">Crée ici les blocs de grille. Un bloc est un enchaînement de mesures réutilisable.</p></div><button className="primary" onClick={addBlock}>+ Bloc</button></div>
      {!blocks.length&&<p className="empty">Aucun bloc. Commence par créer un bloc, puis ajoute ses mesures.</p>}
      {blocks.map((b:GridBlock)=>
        <div className="block-editor" key={b.id}>
          <div className="block-head">
            <input className="block-name" value={b.name} onChange={e=>updateBlock(b,{name:e.target.value})}/>
            <input className="block-note" placeholder="Description / notes..." value={b.notes} onChange={e=>updateBlock(b,{notes:e.target.value})}/>
            <button className="danger ghost" onClick={()=>deleteBlock(b)}>Supprimer</button>
          </div>
          <div className="measure-grid">
            {measures.filter((m:Measure)=>m.block_id===b.id).map((m:Measure,i:number)=><MeasureEditor key={m.id} m={m} index={i} update={updateMeasure} deleteMeasure={deleteMeasure}/>)}
          </div>
          <button className="add-measure" onClick={()=>addMeasure(b.id)}>+ Mesure</button>
        </div>
      )}
  </section>
}

export function GridRender({song}:any){
  return <section className="card">
      <h3>🎹 Grille</h3>
      {song.blocks.map((b:GridBlock)=>
          <div className="render-block" key={b.id}>
              <div className="render-block-title">{b.name}{b.notes&&<small>{b.notes}</small>}</div>
              <div className="render-measures">{song.measures.filter((m:Measure)=>m.block_id===b.id).map((m:Measure,i:number)=><div className="render-measure" key={m.id}><small>{i+1}</small><strong>{m.chord||'—'}</strong><span>{m.beats}/4</span></div>)}</div>
          </div>
      )}
  </section>
}
