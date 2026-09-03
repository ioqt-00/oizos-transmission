import { useMemo, useState } from 'react'
import './Arrangement.css'
import { start } from 'node:repl'

type Part = {
  id: number
  name: string
  position: number
}

type GridBlock = {
  id: number
  song_id: number
  name: string
  position: number
  notes: string
}

type Measure = {
  id: number
  block_id: number
  position: number
  chord: string
  beats: number
  notes: string
}

type StructureItem = {
  id: number
  song_id: number
  block_id: number
  position: number
  repeat_count: number
  notes: string
}

export type ArrangementItem = {
  id: number
  song_id: number
  structure_item_id: number
  part_id: number
  start_halfbeat: number
  duration_halfbeats: number
  label: string
  notes: string
}

type Song = {
  id: number
  title: string
  blocks: GridBlock[]
  measures: Measure[]
  structure: StructureItem[]
  arrangement: ArrangementItem[]
}

type Props = {
  song: Song
  parts: Part[]
}

const PX_PER_HALFBEAT = 10

function getBlock(song: Song, structureItem: StructureItem) {
  return song.blocks.find(
    b => b.id === structureItem.block_id
  )
}

function getMeasures(song: Song, blockId: number) {
  return song.measures
    .filter(m => m.block_id === blockId)
    .sort((a,b) => a.position - b.position)
}

function getBlockDuration(song: Song, blockId: number) {
  return getMeasures(song, blockId)
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

/* ============================================================
   RENDU
   ============================================================ */

export function ArrangementTab({
  song,
  parts
}: Props) {
  const items = song.arrangement
  const timeline = useMemo(
    () => buildTimeline(song),
    [song]
  )
  const totalHalfbeats =
    timeline.length
      ? timeline[timeline.length - 1].end
      : 0

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
                    <small>{index + 1}</small>
                  </div>
                )
              })}
            </div>
            {parts.map(part => (
              <div className="arrangement-part-row" key={part.id}>
                <div className="arrangement-part-name">{part.name}</div>
                <div className="arrangement-track">
                  {timeline.map(entry => {
                    const block =
                      getBlock(
                        song,
                        entry.structureItem
                      )
                    const measures =
                      block
                        ? getMeasures(
                            song,
                            block.id
                          )
                        : []
                    const partItems =
                      items.filter(
                        item =>
                          item.part_id ===
                            part.id &&
                          item.structure_item_id ===
                            entry.structureItem.id
                      )
                    let measureCursor = 0
                    return (
                      <div
                        key={
                          entry.structureItem.id
                        }
                        className="arrangement-structure-cell"
                        style={{
                          width:
                            entry.duration *
                            PX_PER_HALFBEAT
                        }}
                      >
                        {measures.map(measure => {

                          const width = measure.beats * 2 * PX_PER_HALFBEAT
                          const left = measureCursor
                          measureCursor += width
                          return (
                            <div
                              key={measure.id}
                              className="arrangement-measure"
                              style={{
                                left,
                                width
                              }}
                            >
                              <span>{measure.position + 1}</span>
                            </div>
                          )
                        })}
                        {partItems.map(item => (
                          <div
                            key={item.id}
                            className="arrangement-item"
                            style={{
                              left: item.start_halfbeat * PX_PER_HALFBEAT,
                              width: item.duration_halfbeats * PX_PER_HALFBEAT
                            }}
                          >
                            {item.label}
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
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
  parts
}: Props) {
  const [resizing, setResizing] = useState<{
      id: number
      initialX: number
      initialDuration: number
    } | null>(null)

  const timeline = useMemo(
    () => buildTimeline(song),
    [song]
  )

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
    structureItemId: number,
    startHalfbeat: number
  ) {
    const durationHalfbeats = 10

    const item: ArrangementItem = {
      id: -Date.now(),
      song_id: song.id,
      structure_item_id: structureItemId,
      part_id: partId,
      start_halfbeat: startHalfbeat,
      duration_halfbeats: durationHalfbeats,
      label: '',
      notes: ''
    }

    addItem(item)
  }

  function handleTrackClick(
    event: React.MouseEvent<HTMLDivElement>,
    partId: number,
    structureItem: StructureItem
  ) {

    /*
     * On ne crée que si le clic n'a pas
     * été intercepté par un événement existant.
     */

    const rect=event.currentTarget.getBoundingClientRect()
    const x = event.clientX - rect.left
    const startHalfbeat = roundToHalfbeat(x)
    createItem(partId, structureItem.id, startHalfbeat)
  }

  function startResize(
    event: React.PointerEvent,
    item: ArrangementItem
  ) {
    event.stopPropagation()
    setResizing({
      id: item.id,
      initialX: event.clientX,
      initialDuration:
        item.duration_halfbeats
    })
    ;(
      event.currentTarget as HTMLElement
    ).setPointerCapture(event.pointerId)
  }

  function handleResizeMove(
    event: React.PointerEvent,
    item: ArrangementItem
  ) {
    if (!resizing)
      return
    const delta = event.clientX - resizing.initialX
    const deltaHalfbeats = Math.round(delta / PX_PER_HALFBEAT)
    const duration = Math.max(1, resizing.initialDuration + deltaHalfbeats)
    updateItem(item, {duration_halfbeats: duration})
  }

  async function finishResize() {
    if (!resizing)
      return
    const item = arrangement.find(x => x.id === resizing.id)
    setResizing(null)
  }

  return (
    <section className="card arrangement-card">

      <div className="arrangement-title">
        <div>
          <h3>🎼 Arrangement</h3>
          <p>
            Cliquez dans une ligne pour
            créer un événement.
          </p>
        </div>
      </div>

      <div className="arrangement-scroll">

        <div className="arrangement-grid">

          <div className="arrangement-part-header">
            Pupitre
          </div>

          <div className="arrangement-header-track">

            {timeline.map(
              (entry, index) => {

                const block =
                  getBlock(
                    song,
                    entry.structureItem
                  )

                return (
                  <div
                    key={
                      entry.structureItem.id
                    }
                    className="arrangement-section"
                    style={{
                      width:
                        entry.duration *
                        PX_PER_HALFBEAT
                    }}
                  >
                    <strong>
                      {block?.name ||
                        'Bloc supprimé'}
                    </strong>

                    {entry.structureItem
                      .repeat_count > 1 && (
                      <span>
                        ×
                        {
                          entry.structureItem
                            .repeat_count
                        }
                      </span>
                    )}

                    <small>
                      {index + 1}
                    </small>
                  </div>
                )
              }
            )}

          </div>

          {parts.map(part => (

            <div
              className="arrangement-part-row"
              key={part.id}
            >

              <div className="arrangement-part-name">
                {part.name}
              </div>

              <div className="arrangement-track">

                {timeline.map(entry => {

                  const block =
                    getBlock(
                      song,
                      entry.structureItem
                    )

                  const measures =
                    block
                      ? getMeasures(
                          song,
                          block.id
                        )
                      : []

                  const partItems =
                    arrangement.filter(
                      item =>
                        item.part_id ===
                          part.id &&
                        item.structure_item_id ===
                          entry.structureItem.id
                    )

                  let measureCursor = 0

                  return (
                    <div
                      key={entry.structureItem.id}
                      className="arrangement-structure-cell editor-cell"
                      style={{width:entry.duration * PX_PER_HALFBEAT, backgroundSize: PX_PER_HALFBEAT * 4}}
                      onClick={event =>
                        handleTrackClick(
                          event,
                          part.id,
                          entry.structureItem
                        )
                      }
                    >

                      {measures.map(measure => {

                        const width = measure.beats * 2 * PX_PER_HALFBEAT
                        const left = measureCursor
                        measureCursor += width
                        return (
                          <div
                            key={measure.id}
                            className="arrangement-measure"
                            style={{
                              left,
                              width
                            }}
                          >
                            <span>
                              {measure.position + 1}
                            </span>
                          </div>
                        )
                      })}

                      {partItems.map(item => (
                        <div
                          key={item.id}
                          className="arrangement-item editor-item"
                          style={{
                            left:
                              item.start_halfbeat *
                              PX_PER_HALFBEAT,
                            width:
                              item.duration_halfbeats *
                              PX_PER_HALFBEAT
                          }}
                          onClick={e =>
                            e.stopPropagation()
                          }
                        >

                          <input
                            value={item.label}
                            placeholder="Note"
                            onChange={e => {updateItem(item,{label:e.target.value})}}
                          />

                          <button
                            type="button"
                            className="arrangement-delete"
                            onClick={() => deleteItem(item)}
                          >×</button>

                          <div
                            className="arrangement-resize"
                            onPointerDown={e => startResize(e, item)}
                            onPointerMove={e => handleResizeMove(e, item)}
                            onPointerUp={finishResize}
                          />

                        </div>
                      ))}

                    </div>
                  )
                })}

              </div>
            </div>
          ))}

        </div>
      </div>
    </section>
  )
}