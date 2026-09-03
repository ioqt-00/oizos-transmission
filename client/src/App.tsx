import { useEffect, useMemo, useState } from 'react'
import { GridEditor, GridRender } from './components/Grid';
import { StructureEditor, StructureRender } from './components/Structure';

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
  const [tab, setTab] = useState<'metadata'|'partitions'|'grille'|'structure'|'paroles'|'arrangement'>('metadata')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  async function loadSongs(){ setSongs(await (await fetch('/api/songs')).json()) }
  async function loadParts(){ setParts(await (await fetch('/api/parts')).json()) }
  useEffect(()=>{loadSongs();loadParts()},[])

  async function fetchSong(id:number){
    const r=await fetch(`/api/songs/${id}`)
    if(!r.ok) throw new Error(await r.text())
    const song = await r.json() as Song
    return song
  }

  async function openSong(id:number,t=tab){
    setSelected(await fetchSong(id));
    setEditing(false);
    setCreating(false);
    setTab(t);
    setSidebarOpen(false);
  }
  function startNew(){setSelected(null);setForm(emptySong);setCreating(true)}
  function startEdit(song:Song){
    setForm({
      title:song.title,artist:song.artist,composer:song.composer,arranger:song.arranger,
      duration:song.duration,tempo:song.tempo,key_signature:song.key_signature,
      notes:song.notes,lyrics:song.lyrics,url_drive:song.url_drive
    })
    setEditing(true)
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

  async function handleSongSaved(song_id:number){
    await loadSongs();
    setSelected(await fetchSong(song_id));
    setEditing(false);
    if(creating){setCreating(false); setEditing(true)}
  }

  function toggleSidebar() {
    setSidebarOpen(prev => !prev)
  }

  const filtered=useMemo(()=>songs.filter(s=>`${s.title} ${s.artist} ${s.composer}`.toLowerCase().includes(search.toLowerCase())),[songs,search])

  return <div className="app">
    <header className="topbar">
      <div className='topbar-title'><h1>Oizos Transmission</h1><span>V0.4</span></div>
      <a
        href="https://github.com/ioqt-00/oizos-transmission/issues/new"
        target="_blank"
        rel="noopener noreferrer"
        className="topbar-bug-button"
      >
        <span className='topbar-desktop'>🐛 Bug & suggestion</span>
        <span className='topbar-mobile'>🐛 Bug</span>
      </a>
      <button className="primary topbar-new-button" onClick={startNew}>+ Nouveau morceau</button>
    </header>
    <main className="layout">
      <div className='sidebar-container'>
        <button className='mobile-sidebar-button' onClick={toggleSidebar}>
          🎵 {selected?.title || 'Morceaux'} {sidebarOpen ? '▲' : '▼'}
        </button>
        <aside className={`sidebar ${sidebarOpen ? 'mobile-open' : ''}`}>
          <input className="search" placeholder="Rechercher..." value={search} onChange={e=>setSearch(e.target.value)}/>
          <div className="song-count">{filtered.length} morceau{filtered.length>1?'x':''}</div>
          {filtered.map(song=><button className={`song-item ${selected?.id===song.id?'active':''}`} key={song.id} onClick={()=>openSong(song.id)}>
            <strong>{song.title}</strong><small>{song.artist||song.composer||'Informations à compléter'}</small>
          </button>)}
        </aside>
      </div>
      <section className="content">
        {!selected&&!editing&&!creating&&<div className="welcome"><div className="big-icon">🎼</div><h2>Le répertoire de l'orchestre</h2><p>Sélectionne un morceau ou crée le premier.</p><button className="primary" onClick={startNew}>Créer un morceau</button></div>}

        {creating&&<Creator form={form} setForm={setForm} onSaved={handleSongSaved} onCancel={()=>setCreating(false)}/>}

        {editing&&<Editor song={selected} form={form} setForm={setForm} tab={tab} setTab={setTab} onSaved={handleSongSaved} onCancel={()=>selected?openSong(selected.id):setEditing(false)} parts={parts} onUpload={uploadScore}/>}

        {selected&&!editing&&<RenderSong song={selected} tab={tab} setTab={setTab} onEdit={()=>startEdit(selected)} onDelete={deleteSong} parts={parts}/>}
      </section>
    </main>
  </div>
}

function Creator({form, setForm, onCancel, onSaved}:any){
  async function saveSong(e:React.FormEvent){
    e.preventDefault()
    const r=await fetch(`/api/songs/`,{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)
    })
    if(!r.ok)return alert(await r.text())
    const song = await r.json()
    onSaved(song.id)
  }

  return <div className="creator-shell">
    <div className="page-head">
      <div><span className="eyebrow">CRÉATION</span><h2>Nouveau morceau</h2></div>
      <div className="actions"><button type="button" onClick={onCancel}>Annuler</button><button className="actions" onClick={saveSong}>Enregistrer</button></div>
    </div>
    <MetadataEditor form={form} setForm={setForm}/>
  </div>
}

function Editor({song, form, setForm, tab, setTab, onSaved, onCancel, parts, onUpload}:any){
  const [blocks, setBlocks] = useState<GridBlock[]>(song.blocks)
  const [measures, setMeasures] = useState<Measure[]>(song.measures)
  const [structure, setStructure] = useState<StructureItem[]>(song.structure)
  
  async function saveSong(e:React.FormEvent){
    e.preventDefault()
    const r=await fetch(`/api/songs/${song.id}`,{
      method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({...form, blocks, measures, structure})
    })
    if(!r.ok)return alert(await r.text())
    await onSaved(song.id)
  }

  return <div className="editor-shell">
    <div className="page-head">
      <div><span className="eyebrow">ÉDITION</span><h2>{song.title}</h2></div>
      <div className="actions"><button type="button" onClick={onCancel}>Annuler</button><button className="actions" onClick={saveSong}>Enregistrer</button></div>
    </div>
    <Nav tab={tab} setTab={setTab}/>
    {tab==='metadata'&&<MetadataEditor form={form} setForm={setForm}/>}
    {tab==='partitions'&&<PartitionsEditor song={song} parts={parts} onUpload={onUpload}/>}
    {tab==='grille'&&<GridEditor blocks={blocks} measures={measures} setBlocks={setBlocks} setMeasures={setMeasures}/>}
    {tab==='structure'&&<StructureEditor song={song} blocks={blocks} measures={measures} structure={structure} setStructure={setStructure}/>}
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

function RenderSong({song,tab,setTab,onEdit,onDelete,parts}:any){
  return <div className="song-page">
    <div className="page-head">
      <div>
        <span className="eyebrow">LECTURE</span><h2>{song.title}</h2>
        <p className="subtitle">{song.composer||''}</p>
        {song.url_drive && (<a href={song.url_drive} target="_blank" rel="noopener noreferrer">🔗 Drive</a>)}
      </div>
      <div className="actions"><button onClick={onEdit}>Modifier</button><button className="danger" onClick={onDelete}>Supprimer</button></div>
    </div>
    <Nav tab={tab} setTab={setTab}/>

    {tab==='metadata' && 
      <div className="meta-grid">
        <Meta label="Compositeur" value={song.composer}/><Meta label="Arrangeur" value={song.arranger}/><Meta label="Tonalité" value={song.key_signature}/><Meta label="Tempo" value={song.tempo}/><Meta label="Durée" value={song.duration}/>
      </div>
    }
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

function Meta({label,value}:{label:string,value:string}){return <div><span>{label}</span><strong>{value||'—'}</strong></div>}

function Nav({tab, setTab}:any){
  return (
    <div className='navigation-container'>
      <select value={tab} onChange={e => setTab(e.target.value)} className='mobile-song-nav'>
        <option value="metadata">⚙️ Metadata</option>
        <option value="partitions">🎼 Partitions</option>
        <option value="grille">🎹 Grille</option>
        <option value="structure">🧭 Structure</option>
        <option value="paroles">📝 Paroles</option>
      </select> 
      <nav className="desktop-song-nav">
        {([['metadata','⚙️ Metadata'],['partitions','🎼 Partitions'],['grille','🎹 Grille'],['structure','🧭 Structure'],['paroles','📝 Paroles']] as const).map(([k,l])=><button key={k} className={tab===k?'active':''} onClick={()=>setTab(k)}>{l}</button>)}
      </nav>
    </div>
  )
}

export default App
