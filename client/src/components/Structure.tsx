import type {GridBlock, Measure, StructureItem} from '../types/song'
import './Structure.css'

export function StructureEditor({blocks, measures, structure, setStructure}:any){
  function updateStructureItem(structure_item:StructureItem, patch:Partial<StructureItem>){
    setStructure(current =>
      current.map(item =>
        item.id === structure_item.id
          ? { ...item, ...patch }
          : item
      )
    )
  }

  function addStructureItem(){
    setStructure(current => [
    ...current,
    {
      id: -Date.now(),
      song_id: -1,
      block_id: 1,
      position: current.length,
      repeat_count: 1,
      notes: ''
    }
    ])
  }

  function deleteStructureItem(structure_item: StructureItem){
    setStructure(current =>
          current.filter(item =>
            item.id !== structure_item.id
          )
        )
  }

  return <section className="card">
    <div className="section-head"><div><h3>🧭 Structure</h3><p className="muted">Arrange les blocs de grille. Le même bloc peut être utilisé plusieurs fois.</p></div><button className="primary" onClick={addStructureItem}>+ Occurrence</button></div>
    {!structure.length&&<p className="empty">Aucune structure. Ajoute une occurrence d'un bloc.</p>}
    <div className="structure-list">{structure.map((struct_item:StructureItem,i:number)=>{
      const block=blocks.find((b:GridBlock)=>b.id===struct_item.block_id)
      return <div className="structure-row" key={struct_item.id}><span className="structure-number">{i+1}</span>
        <select value={struct_item.block_id} onChange={e=>updateStructureItem(struct_item,{block_id:Number(e.target.value)})}>{blocks.map((b:GridBlock)=><option key={b.id} value={b.id}>{b.name}</option>)}</select>
        <div className="repeat">
          <span>×</span>
          <input type="number" min="1" value={struct_item.repeat_count} onChange={e=>updateStructureItem(struct_item,{repeat_count:Number(e.target.value)||1})}/>
        </div>
        <span className="structure-summary">{block?`${block.name} · ${measures.filter((m:Measure)=>m.block_id===block.id).length} mesure(s)`:''}</span>
        <input className="structure-note" placeholder="Note..." value={struct_item.notes} onChange={e=>updateStructureItem(struct_item,{notes:e.target.value})}/>
        <button className="danger ghost" onClick={()=>deleteStructureItem(struct_item)}>×</button>
      </div>
    })}</div>
  </section>
}

export function StructureRender({song}:any){
  return <section className="card"><h3>🧭 Structure</h3>{song.structure.length?<div className="render-structure">{song.structure.map((x:StructureItem,i:number)=>{const b=song.blocks.find((b:GridBlock)=>b.id===x.block_id);return <div className="render-structure-row" key={x.id}><span>{i+1}</span><strong>{b?.name||'Bloc supprimé'}</strong>{x.repeat_count>1?<em>x{x.repeat_count}</em>:<em></em>}<small>{x.notes}</small></div>})}</div>:<p className="muted">Structure non renseignée.</p>}</section>
}
