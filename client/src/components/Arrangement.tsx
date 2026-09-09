import { useMemo, useState } from 'react'
import './Arrangement.css'
import type { Part, StructureItem, ArrangementItem, Song, TransmissionResource, SongResource } from '../types/song'

type EditorProps = {
  song: Song
  parts: Part[]
  arrangement: ArrangementItem[]
  setArrangement: React.Dispatch<React.SetStateAction<ArrangementItem[]>>
  setSong: React.Dispatch<React.SetStateAction<Song>>
}

type ViewerProps = {
  song: Song
  parts: Part[]
}

type ArrangementResourcePanelProps = {
  arrangementItemId: number,
  song: Song,
  parts: Part[],
  editor: boolean,
  onClose,
  setSong: React.Dispatch<React.SetStateAction<Song>>
}

const PX_PER_HALFBEAT = 2
const ITEM_MINIMUM_SIZE = 20

function getBlock(song: Song, structureItem: StructureItem) {
  return song.blocks.find(
    b => b.id === structureItem.block_id
  )
}

function getMeasures(song: Song, blockId: number, repeatCount: number) {
  const measures = song.measures
    .filter(m => m.block_id === blockId)
    .sort((a,b) => a.position - b.position)
  return Array.from({ length:repeatCount }, () => measures).flat()
}

function getBlockDuration(song: Song, blockId: number) {
  return getMeasures(song, blockId, 1)
    .reduce(
      (total, measure) =>
        total + measure.beats * 2,
      0
    )
}

function buildTimeline(song: Song) {
  let cursor = 0

  return song.structure.map(structureItem => {
    const blockDuration =
      getBlockDuration(
        song,
        structureItem.block_id
      )

    const duration =
      blockDuration *
      Math.max(1, structureItem.repeat_count)

    const result = {
      structureItem,
      start: cursor,
      duration,
      end: cursor + duration
    }

    cursor += duration

    return result
  })
}

function roundToHalfbeat(value: number) {
  return Math.max(
    0,
    Math.round(value / PX_PER_HALFBEAT)
  )
}

const resourceIcons: Record<SongResource['type'], string> = {
  audio: '🎧',
  video: '🎥',
  note: '📝',
  link: '🔗'
}

const resourceLabels: Record<SongResource['type'], string> = {
  audio: 'Audio',
  video: 'Vidéo',
  note: 'Note',
  link: 'Lien'
}

/* ============================================================
   RENDU
   ============================================================ */

export function ArrangementTab({
  song,
  parts
}: ViewerProps) {
  const [selectedItem, setSelectedItem] = useState<number|null>(null)
  const arrangementItems = song.arrangement
  const timeline = useMemo(
    () => buildTimeline(song),
    [song]
  )
  const totalHalfbeats = timeline.length? timeline[timeline.length - 1].end : 0

  return (
    <section className="card arrangement-card">
      <div className="arrangement-title">
        <div><h3>🧩 Arrangement</h3><p>Vue d'ensemble des pupitres</p></div>
      </div>
      {!song.structure.length ? (
        <p className="muted">Structure non renseignée.</p>
      ) : (
        <div className="arrangement-scroll">
          <div className="arrangement-grid" style={{
              '--timeline-width':
                `${Math.max(
                  900,
                  totalHalfbeats *
                  PX_PER_HALFBEAT
                )}px`
            } as React.CSSProperties}
          >
            <div className="arrangement-part-header">Pupitre</div>
            <div className="arrangement-header-track">
              {timeline.map((entry, index) => {
                const block =
                  getBlock(
                    song,
                    entry.structureItem
                  )
                return (
                  <div
                    key={entry.structureItem.id}
                    className="arrangement-section"
                    style={{
                      width:
                        entry.duration *
                        PX_PER_HALFBEAT
                    }}
                  >
                    <strong>{block?.name ||'Bloc supprimé'}</strong>
                    {entry.structureItem
                      .repeat_count > 1 && (
                      <span>
                        ×
                        {entry.structureItem
                          .repeat_count}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
            {parts.map(part => {
              const partArrangementItems = arrangementItems.filter(item => item.part_id === part.id)
              return (
                <div className="arrangement-part-row" key={part.id}>
                  <div className="arrangement-part-name">{part.name}</div>
                  <div className="arrangement-track">
                    {timeline.map(entry => {
                      const block = getBlock(song, entry.structureItem)
                      const repeat_count = entry.structureItem.repeat_count
                      const measures = block ? getMeasures(song, block.id, repeat_count) : []
                      let measureCursor = 0
                      return (
                        <div key={entry.structureItem.id} className="arrangement-structure-cell"
                          style={{width:entry.duration * PX_PER_HALFBEAT}}>
                          {measures.map(measure => {

                            const width = measure.beats * 2 * PX_PER_HALFBEAT
                            const left = measureCursor
                            measureCursor += width
                            return (
                              <div className="arrangement-measure" style={{left, width}}></div>
                            )
                          })}
                        </div>
                      )
                    })}
                    {partArrangementItems.map(item => (
                      <div
                        key={item.id} className="arrangement-item editor-item"
                        style={{left:item.start_halfbeat*PX_PER_HALFBEAT, width:(item.end_halfbeat - item.start_halfbeat)*PX_PER_HALFBEAT}}
                        onClick={()=>setSelectedItem(item.id)}
                      >{item.label}</div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
      {selectedItem &&
        <ArrangementResourcePanel 
          arrangementItemId={selectedItem} song={song} parts={parts} editor={false} 
          onClose={() => setSelectedItem(null)}
          onAddResource={()=>{}} onUpdateResource={()=>{}} onDeleteResource={()=>{}}
        /> 
      }
      </section>
  )
}

/* ============================================================
   EDITEUR
   ============================================================ */

export function ArrangementEditor({
  song,
  arrangement,
  setArrangement,
  setSong,
  parts
}: EditorProps) {
  const [selectedItem, setSelectedItem] = useState<number|null>(null)
  const [resizing, setResizing] = useState<{
      id: number
      initialX: number
      initialStart: number
      initialEnd: number
      previousEnd: number
      nextStart: number
    } | null>(null)

  const timeline = useMemo(() => buildTimeline(song), [song])

  const totalHalfbeats = timeline.length? timeline[timeline.length - 1].end : 0

  function addItem(arr: ArrangementItem){
    setArrangement(current => [
        ...current, arr
      ])
    }

  function deleteItem(arr: ArrangementItem){
    setArrangement(current =>
          current.filter(item =>
            item.id !== arr.id
          )
        )
  }

  function updateItem(arr: ArrangementItem, patch:Partial<ArrangementItem>){
    setArrangement(current =>
      current.map(item =>
        item.id === arr.id
          ? { ...item, ...patch }
          : item
      )
    )
  }

  async function createItem(
    partId: number,
    startHalfbeat: number
  ) {
    const endHalfbeat = startHalfbeat + ITEM_MINIMUM_SIZE

    const others = arrangement.filter(x => x.part_id === partId)
    const next_others = others.filter(x => x.start_halfbeat >= startHalfbeat)
    const next_start = Math.min(...next_others.map(x => x.start_halfbeat), totalHalfbeats)

    if (endHalfbeat > next_start){return}

    const item: ArrangementItem = {
      id: -Date.now(),
      song_id: song.id,
      part_id: partId,
      start_halfbeat: startHalfbeat,
      end_halfbeat: endHalfbeat,
      label: 'Label',
      notes: ''
    }

    addItem(item)
  }

  function handleTrackClick(
    event: React.MouseEvent<HTMLDivElement>,
    partId: number,
    block_start_halfbeat: number
  ) {

    /*
     * On ne crée que si le clic n'a pas
     * été intercepté par un événement existant.
     */

    const rect=event.currentTarget.getBoundingClientRect()
    const x = event.clientX - rect.left
    const startHalfbeat = roundToHalfbeat(x) + block_start_halfbeat
    createItem(partId, startHalfbeat)
  }

  function startResize(
    event: React.PointerEvent,
    item: ArrangementItem
  ) {
    event.stopPropagation()

    const others = arrangement.filter(x => x.id !== item.id).filter(x => x.part_id === item.part_id)
    const previous_others = others.filter(x => x.end_halfbeat <= item.start_halfbeat)
    const next_others = others.filter(x => x.start_halfbeat >= item.end_halfbeat)
    const previous_end =  Math.max(...previous_others.map(x => x.end_halfbeat), 0)
    const next_start = Math.min(...next_others.map(x => x.start_halfbeat), totalHalfbeats)

    setResizing({
      id: item.id,
      initialX: event.clientX,
      initialStart: item.start_halfbeat,
      initialEnd: item.end_halfbeat,
      previousEnd: previous_end,
      nextStart: next_start
    })
    ;(
      event.currentTarget as HTMLElement
    ).setPointerCapture(event.pointerId)
  }

  function handleResizeMove(
    event: React.PointerEvent,
    item: ArrangementItem,
    type: string
  ) {
    if (!resizing) return
    // min for start is end of previous
    // max for start is end of this - MIN_SIZE
    // min for end is start of this + MIN_SIZE
    // max for end is start of next

    const delta = event.clientX - resizing.initialX
    const deltaHalfbeats = Math.round(delta / PX_PER_HALFBEAT)

    if (type === 'left') {
      const start = Math.max(resizing.previousEnd, Math.min(resizing.initialStart+deltaHalfbeats, resizing.initialEnd-ITEM_MINIMUM_SIZE))
      updateItem(item, {start_halfbeat: start})
    } else {
      const end = Math.min(resizing.nextStart, Math.max(resizing.initialStart+ITEM_MINIMUM_SIZE, resizing.initialEnd + deltaHalfbeats))
      updateItem(item, {end_halfbeat: end})
    }
  }

  async function finishResize() {
    if (!resizing) return
    setResizing(null)
  }

  return (
    <section className="card arrangement-card">

      <div className="arrangement-title">
        <div><h3>🧩 Arrangement</h3><p>Cliquez dans une ligne pour créer un événement.</p></div>
      </div>

      <div className="arrangement-scroll">
        <div className="arrangement-grid">
          <div className="arrangement-part-header">Pupitre</div>
          <div className="arrangement-header-track">
            {timeline.map(
              (entry, index) => {
                const block = getBlock(song, entry.structureItem)
                return (
                  <div key={entry.structureItem.id} className="arrangement-section" style={{width:entry.duration*PX_PER_HALFBEAT}}                  >
                    <strong>{block?.name || 'Bloc supprimé'}</strong>
                    {entry.structureItem.repeat_count > 1 && (<span>×{entry.structureItem.repeat_count}</span>)}
                  </div>
                )
              }
            )}
          </div>

          {parts.map(part => {
            const partItems = arrangement.filter(item => item.part_id === part.id)

            return (
              <div className="arrangement-part-row" key={part.id}>
                <div className="arrangement-part-name">{part.name}</div>
                <div className="arrangement-track">
                  {timeline.map(entry => {
                    const block = getBlock(song, entry.structureItem)
                    const repeat_count = entry.structureItem.repeat_count
                    const measures = block? getMeasures(song, block.id, repeat_count) : []
                    let measureCursor = 0

                    return (
                      <div key={entry.structureItem.id} className="arrangement-structure-cell editor-cell"
                        style={{width:entry.duration * PX_PER_HALFBEAT, backgroundSize: PX_PER_HALFBEAT * 4}}
                        onClick={event => handleTrackClick(event, part.id, entry.start)}
                      >
                        {measures.map(measure => {
                          const width = measure.beats * 2 * PX_PER_HALFBEAT
                          const left = measureCursor
                          measureCursor += width
                          return (
                            <div className="arrangement-measure" style={{left, width}}></div>
                          )
                        })}
                      </div>
                    )
                  })}
                  {partItems.map(item => (
                          <div
                            key={item.id} className="arrangement-item editor-item"
                            style={{left:item.start_halfbeat*PX_PER_HALFBEAT, width:(item.end_halfbeat - item.start_halfbeat)*PX_PER_HALFBEAT}}
                            onClick={() => setSelectedItem(item.id)}
                          >
                            <div className="arrangement-resize-left" onPointerDown={e => startResize(e, item)} onPointerMove={e => handleResizeMove(e, item, 'left')} onPointerUp={finishResize}/>
                            <input value={item.label} onChange={e => {updateItem(item,{label:e.target.value})}}/>
                            <button type="button" className="arrangement-delete" onClick={() => deleteItem(item)}>×</button>
                            <div className="arrangement-resize" onPointerDown={e => startResize(e, item)} onPointerMove={e => handleResizeMove(e, item, 'right')} onPointerUp={finishResize}/>
                          </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {selectedItem &&
        <ArrangementResourcePanel 
          arrangementItemId={selectedItem} song={song} parts={parts} editor={true} 
          onClose={() => setSelectedItem(null)}
          setSong={setSong}
        /> 
      }
    </section>
  )
}

export default function ArrangementResourcePanel({
  arrangementItemId,
  song,
  parts,
  editor = false,
  onClose,
  setSong
}: ArrangementResourcePanelProps) {
  function onAddResource(item: TransmissionResource) {
    setSong(prev => {
      if (!prev) return prev

      return {
        ...prev,
        transmission_resources:
          [...prev.transmission_resources, item]
      }
    })
  }

  function onUpdateResource(item: TransmissionResource, patch: Partial<TransmissionResource>) {
    setSong(prev => {
      if (!prev) return prev

      return {
        ...prev,
        transmission_resources:
          prev.transmission_resources.map(resource =>
            resource.id === item.id ? { ...resource, ...patch } 
                                    : resource
        )
      }
    })
  }

  function onDeleteResource(item: TransmissionResource) {
    setSong(prev => {
      if (!prev) return prev

      return {
        ...prev,
        transmission_resources:
          prev.transmission_resources.filter(prev => prev.id != item.id)
      }
    })
  }

  const resources = song.transmission_resources
  
  const arrangementItem = song.arrangement.find(
    item => item.id === arrangementItemId
  )
  if(!arrangementItem) return

  const part = parts.find(
    item => item.id === arrangementItem.part_id
  )
  if(!part) return

  const itemResources = resources
    .filter(
      resource =>
        Number(resource.arrangement_item_id) === Number(arrangementItem.id)
    )
    .sort((a, b) => a.position - b.position)

  const formatHalfbeat = (value: number) => {
    const beat = Math.floor(value / 2) + 1
    const half = value % 2 === 0 ? '' : ' +'
    return `${beat}${half}`
  }

  const addResource = () => {
    if (!onAddResource) return

    const newResource: TransmissionResource = {
      id: -Date.now(),
      song_id: arrangementItem.song_id,
      arrangement_item_id: arrangementItem.id,
      type: 'note',
      title: 'Nouvelle Ressource',
      content: '',
      position: itemResources.length
    }

    onAddResource(newResource)
  }

  return (
    <>
      <div className="arrangement-resource-backdrop" onClick={onClose}/>
      <aside className="arrangement-resource-panel" onClick={event => event.stopPropagation()}>
        {/* HEADER */}
        <div className="arrangement-resource-panel-header">
          <div>
            <div className="arrangement-resource-panel-eyebrow">
              Transmission
            </div>

            <h2>
              {part.name}
            </h2>

            {arrangementItem.label && (
              <div className="arrangement-resource-panel-label">
                {arrangementItem.label}
              </div>
            )}
          </div>

          <button
            type="button"
            className="arrangement-resource-panel-close"
            onClick={onClose}
            aria-label="Fermer"
          >
            ×
          </button>
        </div>


        {/* INFOS ARRANGEMENT */}
        <div className="arrangement-resource-panel-info">

          <div>
            <span>Début</span>
            <strong>
              {formatHalfbeat(arrangementItem.start_halfbeat)}
            </strong>
          </div>

          <div>
            <span>Fin</span>
            <strong>
              {formatHalfbeat(arrangementItem.end_halfbeat)}
            </strong>
          </div>
        </div>

        {/* NOTES DE L'ARRANGEMENT */}

        {arrangementItem.notes && (
          <div className="arrangement-resource-panel-notes">
            <div className="arrangement-resource-panel-section-title"> Note de direction</div>
            <div className="arrangement-resource-panel-note-content">
              {arrangementItem.notes}
            </div>
          </div>
        )}

        {/* RESSOURCES */}
        <div className="arrangement-resource-panel-resources">
          <div className="arrangement-resource-panel-section-header">
            <div className="arrangement-resource-panel-section-title">
              Ressources
            </div>
            {editor && onAddResource && (
              <button
                type="button"
                className="arrangement-resource-add-button"
                onClick={addResource}
              >+</button>
            )}
          </div>

          {itemResources.length === 0 ? (
            <div className="arrangement-resource-empty">
              {editor ? 'Aucune ressource pour ce passage.' : 'Aucune ressource disponible pour ce passage.'}
            </div>
          ) : (
            <div className="arrangement-resource-list">
              {itemResources.map(resource => (
                <div key={resource.id} className="arrangement-resource-card">
                  <div className="arrangement-resource-icon">
                    {resourceIcons[resource.type]}
                  </div>

                  <div className="arrangement-resource-body">
                    {editor ? (
                      <>
                        <div className="arrangement-resource-edit-row">
                          <select
                            value={resource.type}
                            onChange={event =>
                              onUpdateResource(resource, {type: event.target.value as TransmissionResource['type']})
                            }
                          >
                            {Object.entries(resourceLabels).map(
                              ([value, label]) => (<option key={value} value={value}>{label}</option>)
                            )}
                          </select>
                          <button
                            type="button"
                            className="arrangement-resource-delete"
                            onClick={() => onDeleteResource(resource)} 
                            title="Supprimer"
                          > 🗑️ </button>
                        </div>

                        <input
                          type="text"
                          className="arrangement-resource-title-input"
                          value={resource.title}
                          onChange={event => onUpdateResource(resource, {title: event.target.value})}
                          placeholder="Titre"
                        />

                        <textarea
                          className="arrangement-resource-content-input"
                          value={resource.content}
                          onChange={event => onUpdateResource(resource, {content: event.target.value})}
                          placeholder={ 
                            resource.type === 'link'
                              ? 'https://...'
                              : 'Contenu de la ressource...'
                          }
                          rows={3}
                        />
                      </>
                    ) : (
                      <>
                        <div className="arrangement-resource-title">
                          {resource.title}
                        </div>
                        {resource.type === 'link' ? (
                          <a
                            href={resource.content}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="arrangement-resource-link"
                          >
                            {resource.content}
                          </a>
                        ) : (
                          <div className="arrangement-resource-content">
                            {resource.content}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
    </>
  )
}