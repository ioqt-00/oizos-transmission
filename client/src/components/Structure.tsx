type GridBlock = { id:number; name:string; position:number; notes:string }
type Measure = { id:number; block_id:number; position:number; chord:string; beats:number; notes:string }
type StructureItem = { id:number; block_id:number; position:number; repeat_count:number; notes:string }

export function StructureEditor({song,add,update,deleteItem}:any){
  return <section className="card">
    <div className="section-head"><div><h3>🧭 Structure</h3><p className="muted">Arrange les blocs de grille. Le même bloc peut être utilisé plusieurs fois.</p></div><button className="primary" onClick={add}>+ Occurrence</button></div>
    {!song.structure.length&&<p className="empty">Aucune structure. Ajoute une occurrence d'un bloc.</p>}
    <div className="structure-list">{song.structure.map((item:StructureItem,i:number)=>{
      const block=song.blocks.find((b:GridBlock)=>b.id===item.block_id)
      return <div className="structure-row" key={item.id}><span className="structure-number">{i+1}</span>
        <select value={item.block_id} onChange={e=>update(item,{block_id:Number(e.target.value)})}>{song.blocks.map((b:GridBlock)=><option key={b.id} value={b.id}>{b.name}</option>)}</select>
        <div className="repeat"><span>×</span><input type="number" min="1" value={item.repeat_count} onChange={e=>update(item,{repeat_count:Number(e.target.value)||1})}/></div>
        <span className="structure-summary">{block?`${block.name} · ${song.measures.filter((m:Measure)=>m.block_id===block.id).length} mesure(s)`:''}</span>
        <input className="structure-note" placeholder="Note..." value={item.notes} onChange={e=>update(item,{notes:e.target.value})}/>
        <button className="danger ghost" onClick={()=>deleteItem(item)}>×</button>
      </div>
    })}</div>
  </section>
}

export function StructureRender({song}:any){
  return <section className="card"><h3>🧭 Structure</h3>{song.structure.length?<div className="render-structure">{song.structure.map((x:StructureItem,i:number)=>{const b=song.blocks.find((b:GridBlock)=>b.id===x.block_id);return <div className="render-structure-row" key={x.id}><span>{i+1}</span><strong>{b?.name||'Bloc supprimé'}</strong>{x.repeat_count>1?<em>x{x.repeat_count}</em>:<em></em>}<small>{x.notes}</small></div>})}</div>:<p className="muted">Structure non renseignée.</p>}</section>
}
