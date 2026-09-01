import { useEffect, useMemo, useState } from 'react'

type Part = { id:number; name:string; position:number }
type Score = { id:number; part_id:number; file_name:string; file_path:string }
type GridBlock = { id:number; name:string; position:number; notes:string }
type Measure = { id:number; block_id:number; position:number; chord:string; beats:number; notes:string }
type StructureItem = { id:number; block_id:number; position:number; repeat_count:number; notes:string }
type Song = {
  id:number; title:string; artist:string; composer:string; arranger:string
  duration:string; tempo:string; key_signature:string; notes:string; lyrics:string; url_drive:string
  scores:Score[]; blocks:GridBlock[]; measures:Measure[]; structure:StructureItem[]
}

const emptySong = {
  title:'', artist:'', composer:'', arranger:'', duration:'', tempo:'',
  key_signature:'', notes:'', lyrics:'', url_drive:''
}

function App() {
  const [songs, setSongs] = useState<Song[]>([])
  const [parts, setParts] = useState<Part[]>([])
  const [selected, setSelected] = useState<Song|null>(null)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState(emptySong)
  const [viewTab, setViewTab] = useState<'partitions'|'grille'|'structure'|'paroles'>('partitions')
  const [editTab, setEditTab] = useState<'metadata'|'partitions'|'grille'|'structure'|'paroles'>('metadata')

  async function loadSongs(){ setSongs(await (await fetch('/api/songs')).json()) }
  async function loadParts(){ setParts(await (await fetch('/api/parts')).json()) }
  useEffect(()=>{loadSongs();loadParts()},[])

  async function fetchSong(id:number){
    const r=await fetch(`/api/songs/${id}`)
    if(!r.ok) throw new Error(await r.text())
    return await r.json() as Song
  }
  async function openSong(id:number,tab=viewTab){
    setSelected(await fetchSong(id)); setEditing(false); setViewTab(tab)
  }
  function startNew(){setSelected(null);setForm(emptySong);setCreating(true)}
  function startEdit(song:Song){
    setForm({
      title:song.title,artist:song.artist,composer:song.composer,arranger:song.arranger,
      duration:song.duration,tempo:song.tempo,key_signature:song.key_signature,
      notes:song.notes,lyrics:song.lyrics,url_drive:song.url_drive
    }); setEditing(true); setEditTab('metadata')
  }
  async function saveSong(e:React.FormEvent){
    e.preventDefault()
    const r=await fetch(selected?`/api/songs/${selected.id}`:'/api/songs',{
      method:selected?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)
    })
    if(!r.ok)return alert(await r.text())
    const result=await r.json(); await loadSongs(); setSelected(await fetchSong(result.id)); setEditing(false); if(creating){setCreating(false); setEditing(true)};
  }
  async function deleteSong(){
    if(!selected||!confirm(`Supprimer « ${selected.title} » ?`))return
    await fetch(`/api/songs/${selected.id}`,{method:'DELETE'})
    setSelected(null);setEditing(false);await loadSongs()
  }
  async function uploadScore(partId:number,file:File){
    if(!selected)return
    const d=new FormData();d.append('file',file);d.append('partId',String(partId))
    const r=await fetch(`/api/songs/${selected.id}/scores`,{method:'POST',body:d})
    if(!r.ok)return alert(await r.text())
    setSelected(await fetchSong(selected.id))
  }

  async function addBlock(){
    if(!selected)return
    const r=await fetch(`/api/songs/${selected.id}/blocks`,{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({name:`Bloc ${selected.blocks.length+1}`,notes:''})
    })
    if(!r.ok)return alert(await r.text())
    setSelected(await fetchSong(selected.id))
  }
  async function updateBlock(b:GridBlock,patch:Partial<GridBlock>){
    if(!selected)return
    await fetch(`/api/blocks/${b.id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(patch)})
    setSelected(await fetchSong(selected.id))
  }
  async function deleteBlock(b:GridBlock){
    if(!selected)return
    if(!confirm(`Supprimer le bloc « ${b.name} » et ses mesures ?`))return
    await fetch(`/api/blocks/${b.id}`,{method:'DELETE'})
    setSelected(await fetchSong(selected.id))
  }
  async function addMeasure(blockId:number){
    if(!selected)return
    await fetch(`/api/blocks/${blockId}/measures`,{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chord:'',beats:4,notes:''})
    })
    setSelected(await fetchSong(selected.id))
  }
  async function updateMeasure(m:Measure,patch:Partial<Measure>){
    if(!selected)return
    await fetch(`/api/measures/${m.id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(patch)})
    setSelected(await fetchSong(selected.id))
  }
  async function deleteMeasure(m:Measure){
    if(!selected)return
    await fetch(`/api/measures/${m.id}`,{method:'DELETE'});setSelected(await fetchSong(selected.id))
  }
  async function addStructureItem(){
    if(!selected)return
    if(!selected.blocks.length)return alert('Crée d’abord un bloc dans Grille.')
    await fetch(`/api/songs/${selected.id}/structure`,{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({block_id:selected.blocks[0].id,repeat_count:1,notes:''})
    })
    setSelected(await fetchSong(selected.id))
  }
  async function updateStructureItem(item:StructureItem,patch:Partial<StructureItem>){
    if(!selected)return
    await fetch(`/api/structure/${item.id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(patch)})
    setSelected(await fetchSong(selected.id))
  }
  async function deleteStructureItem(item:StructureItem){
    if(!selected)return
    await fetch(`/api/structure/${item.id}`,{method:'DELETE'});setSelected(await fetchSong(selected.id))
  }

  const filtered=useMemo(()=>songs.filter(s=>`${s.title} ${s.artist} ${s.composer}`.toLowerCase().includes(search.toLowerCase())),[songs,search])

  return <div className="app">
    <header className="topbar">
      <div><h1>Oizos Tansmission</h1><span>V0.3</span></div>
      <button className="primary" onClick={startNew}>+ Nouveau morceau</button>
    </header>
    <main className="layout">
      <aside className="sidebar">
        <input className="search" placeholder="Rechercher..." value={search} onChange={e=>setSearch(e.target.value)}/>
        <div className="song-count">{filtered.length} morceau{filtered.length>1?'x':''}</div>
        {filtered.map(song=><button className={`song-item ${selected?.id===song.id?'active':''}`} key={song.id} onClick={()=>openSong(song.id)}>
          <strong>{song.title}</strong><small>{song.artist||song.composer||'Informations à compléter'}</small>
        </button>)}
      </aside>
      <section className="content">
        {!selected&&!editing&&!creating&&<div className="welcome"><div className="big-icon">🎼</div><h2>Le répertoire de l'orchestre</h2><p>Sélectionne un morceau ou crée le premier.</p><button className="primary" onClick={startNew}>Créer un morceau</button></div>}

        {creating&&<Creator form={form} setForm={setForm} onSave={saveSong} onCancel={()=>setCreating(false)}/>}

        {editing&&<Editor song={selected} form={form} setForm={setForm} tab={editTab} setTab={setEditTab} onSave={saveSong} onCancel={()=>selected?openSong(selected.id):setEditing(false)} parts={parts} onUpload={uploadScore} addBlock={addBlock} updateBlock={updateBlock} deleteBlock={deleteBlock} addMeasure={addMeasure} updateMeasure={updateMeasure} deleteMeasure={deleteMeasure} addStructureItem={addStructureItem} updateStructureItem={updateStructureItem} deleteStructureItem={deleteStructureItem}/>}

        {selected&&!editing&&<RenderSong song={selected} tab={viewTab} setTab={setViewTab} onEdit={()=>startEdit(selected)} onDelete={deleteSong} parts={parts}/>}
      </section>
    </main>
  </div>
}

function Creator({form, setForm, onCancel, onSave}:any){
  return <div className="creator-shell">
    <div className="page-head">
      <div><span className="eyebrow">CRÉATION</span><h2>Nouveau morceau</h2></div>
      <div className="actions"><button type="button" onClick={onCancel}>Annuler</button><button className="actions" onClick={onSave}>Enregistrer</button></div>
    </div>
    <MetadataEditor form={form} setForm={setForm}/>
  </div>
}

function Editor({song,form,setForm,tab,setTab,onSave,onCancel,parts,onUpload,addBlock,updateBlock,deleteBlock,addMeasure,updateMeasure,deleteMeasure,addStructureItem,updateStructureItem,deleteStructureItem}:any){
  return <div className="editor-shell">
    <div className="page-head">
      <div><span className="eyebrow">ÉDITION</span><h2>{song.title}</h2></div>
      <div className="actions"><button type="button" onClick={onCancel}>Annuler</button><button className="actions" onClick={onSave}>Enregistrer</button></div>
    </div>
    <nav className="tabs">
      {([['metadata','⚙️ Metadata'],['partitions','🎼 Partitions'],['grille','🎹 Grille'],['structure','🧭 Structure'],['paroles','📝 Paroles']] as const).map(([k,l])=><button key={k} className={tab===k?'active':''} onClick={()=>setTab(k)}>{l}</button>)}
    </nav>
    {tab==='metadata'&&<MetadataEditor form={form} setForm={setForm}/>}
    {tab==='partitions'&&song&&<PartitionsEditor song={song} parts={parts} onUpload={onUpload}/>}
    {tab==='grille'&&song&&<GridEditor song={song} addBlock={addBlock} updateBlock={updateBlock} deleteBlock={deleteBlock} addMeasure={addMeasure} updateMeasure={updateMeasure} deleteMeasure={deleteMeasure}/>}
    {tab==='structure'&&song&&<StructureEditor song={song} add={addStructureItem} update={updateStructureItem} deleteItem={deleteStructureItem}/>}
    {tab==='paroles'&&<label>📝 Paroles<textarea className="lyrics-editor tall" value={form.lyrics} onChange={(e)=>setForm({...form,lyrics:e.target.value})}/></label>}
  </div>
}

function MetadataEditor({form,setForm}:any){
  return <div className="editor card">
    <div className="form-grid">{[['title','Titre'],['artist','Artiste / groupe'],['composer','Compositeur'],['arranger','Arrangeur'],['duration','Durée'],['tempo','Tempo'],['key_signature','Tonalité'],['url_drive','URL Drive']].map(([k,l])=><label key={k}>{l}<input value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})}/></label>)}</div>
    <label>Notes<textarea rows={5} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></label>
  </div>
}

function PartitionsEditor({song,parts,onUpload}:any){
  return <section className="card"><h3>🎼 Partitions</h3><div className="parts-grid">{parts.map((p:Part)=>{
    const score=song.scores.find((s:Score)=>s.part_id===p.id)
    return <div className="part-card" key={p.id}><strong>{p.name}</strong>
      {score?<div className="score-actions"><a href={`/uploads/${score.file_path}`} target="_blank">📄 Ouvrir</a><label className="replace">Remplacer<input type="file" accept="application/pdf" onChange={e=>e.target.files?.[0]&&onUpload(p.id,e.target.files[0])}/></label></div>
      :<label className="upload">+ Ajouter un PDF<input type="file" accept="application/pdf" onChange={e=>e.target.files?.[0]&&onUpload(p.id,e.target.files[0])}/></label>}
    </div>
  })}</div></section>
}

function GridEditor({song,addBlock,updateBlock,deleteBlock,addMeasure,updateMeasure,deleteMeasure}:any){
  return <section className="card">
    <div className="section-head"><div><h3>🎹 Grille</h3><p className="muted">Crée ici les blocs de grille. Un bloc est un enchaînement de mesures réutilisable.</p></div><button className="primary" onClick={addBlock}>+ Bloc</button></div>
    {!song.blocks.length&&<p className="empty">Aucun bloc. Commence par créer un bloc, puis ajoute ses mesures.</p>}
    {song.blocks.map((b:GridBlock)=><div className="block-editor" key={b.id}>
      <div className="block-head"><input className="block-name" value={b.name} onChange={e=>updateBlock(b,{name:e.target.value})}/><input className="block-note" placeholder="Description / notes..." value={b.notes} onChange={e=>updateBlock(b,{notes:e.target.value})}/><button className="danger ghost" onClick={()=>deleteBlock(b)}>Supprimer</button></div>
      <div className="measure-grid">{song.measures.filter((m:Measure)=>m.block_id===b.id).map((m:Measure,i:number)=><MeasureEditor key={m.id} m={m} index={i} update={updateMeasure} deleteMeasure={deleteMeasure}/>)}</div>
      <button className="add-measure" onClick={()=>addMeasure(b.id)}>+ Mesure</button>
    </div>)}
  </section>
}

function MeasureEditor({m,index,update,deleteMeasure}:any){
  return <div className="measure"><span className="measure-number">{index+1}</span><input value={m.chord} placeholder="Accord" onChange={e=>update(m,{chord:e.target.value})}/>
    <select value={m.beats} onChange={e=>update(m,{beats:Number(e.target.value)})}>{[2,3,4,5,6,7,8].map(n=><option key={n} value={n}>{n}/4</option>)}</select>
    <button className="delete-measure" onClick={()=>deleteMeasure(m)}>×</button>
  </div>
}

function StructureEditor({song,add,update,deleteItem}:any){
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

function RenderSong({song,tab,setTab,onEdit,onDelete,parts}:any){
  return <div className="song-page">
    <div className="page-head">
      <div>
        <span className="eyebrow">MORCEAU</span><h2>{song.title}</h2>
        <p className="subtitle">{song.composer||''}</p>
        {song.url_drive && (<a href={song.url_drive} target="_blank" rel="noopener noreferrer">🔗 Drive</a>)}
      </div>
      <div className="actions"><button onClick={onEdit}>Modifier</button><button className="danger" onClick={onDelete}>Supprimer</button></div>
    </div>
    <div className="meta-grid"><Meta label="Compositeur" value={song.composer}/><Meta label="Arrangeur" value={song.arranger}/><Meta label="Tonalité" value={song.key_signature}/><Meta label="Tempo" value={song.tempo}/><Meta label="Durée" value={song.duration}/><Meta label="Style" value={song.style}/></div>
    <nav className="tabs">{([['partitions','🎼 Partitions'],['grille','🎹 Grille'],['structure','🧭 Structure'],['paroles','📝 Paroles']] as const).map(([k,l])=><button key={k} className={tab===k?'active':''} onClick={()=>setTab(k)}>{l}</button>)}</nav>
    {tab==='partitions' && 
      <section className="card"><h3>🎼 Partitions</h3>
        <div className="parts-grid">
          {parts.map(
            (p:Part)=>{
              const s=song.scores.find((x:Score)=>x.part_id===p.id);
              return <div className="part-card" key={p.id}><strong>{p.name}</strong>{s?<div className="score-actions"><a href={`/uploads/${s.file_path}`} target="_blank">📄 Ouvrir</a></div>:<div className="muted"> Aucune partition</div>}</div>
            }
          )}
        </div>
      </section>
    }
    {tab==='grille'&& <GridRender song={song}/>}
    {tab==='structure'&&<StructureRender song={song}/>}
    {tab==='paroles'&&<section className="card"><h3>📝 Paroles</h3>{song.lyrics?<pre className="lyrics">{song.lyrics}</pre>:<p className="muted">Aucune parole renseignée.</p>}</section>}
  </div>
}
function GridRender({song}:any){return <section className="card"><h3>🎹 Grille</h3>{song.blocks.map((b:GridBlock)=><div className="render-block" key={b.id}><div className="render-block-title">{b.name}{b.notes&&<small>{b.notes}</small>}</div><div className="render-measures">{song.measures.filter((m:Measure)=>m.block_id===b.id).map((m:Measure,i:number)=><div className="render-measure" key={m.id}><small>{i+1}</small><strong>{m.chord||'—'}</strong><span>{m.beats}/4</span></div>)}</div></div>)}</section>}
function StructureRender({song}:any){
  return <section className="card"><h3>🧭 Structure</h3>{song.structure.length?<div className="render-structure">{song.structure.map((x:StructureItem,i:number)=>{const b=song.blocks.find((b:GridBlock)=>b.id===x.block_id);return <div className="render-structure-row" key={x.id}><span>{i+1}</span><strong>{b?.name||'Bloc supprimé'}</strong>{x.repeat_count>1?<em>x{x.repeat_count}</em>:<em></em>}<small>{x.notes}</small></div>})}</div>:<p className="muted">Structure non renseignée.</p>}</section>}
function Meta({label,value}:{label:string,value:string}){return <div><span>{label}</span><strong>{value||'—'}</strong></div>}
export default App
