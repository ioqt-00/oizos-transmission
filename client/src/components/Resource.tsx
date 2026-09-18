import React from 'react'
import './Resource.css'

import type { Song, SongResource, TransmissionResource, Part, ArrangementItem } from '../types/song'

type SongResourcesProps = {
  song: Song
  setSong?: React.Dispatch<React.SetStateAction<Song>>
  parts: Part[]
  editing?: boolean
}

const resourceIcons: Record<
  SongResource['type'],
  string
> = {
  audio: '🎧',
  video: '🎥',
  note: '📝',
  link: '🔗'
}

const resourceLabels: Record<
  SongResource['type'],
  string
> = {
  audio: 'Audio',
  video: 'Vidéo',
  note: 'Note',
  link: 'Lien'
}

export function ResourceTab({
  song,
  setSong,
  parts,
  editing = false
}: SongResourcesProps) {
  const arrangementItems = song.arrangement
  const resources = song.song_resources
  const transmissionResources = song.transmission_resources

  function addSongResource(edited: SongResource){
    if (!setSong) return
    setSong(prev => {
      return {
        ...prev,

        song_resources:
          [
            ...(prev.song_resources), 
            edited
          ]
      }
    })
  }

  function deleteSongResource(edited: SongResource){
    if (!setSong) return
    setSong(prev => {
      return {
        ...prev,

        song_resources:
          prev.song_resources.filter(item =>
            item.id != edited.id
          )
      }
    })
  }

  function updateSongResource(edited: SongResource, patch:Partial<SongResource>){
    if (!setSong) return
    setSong(prev => {
      if (!prev) return prev
      return {
        ...prev,

        song_resources:
          prev.song_resources.map(item =>
            item.id === edited.id
              ? { ...item, ...patch }
              : item
          )
      }
    })
  }

  function createSongResource() {
    const nextPosition = 
      resources.length > 0
        ? Math.max(...resources.map(r => r.position)) + 1
        : 0

    const resource: SongResource = {
      id: -Date.now(),
      song_id: song.id,
      type: 'note',
      title: 'Nouvelle ressource',
      content: '',
      position: nextPosition
    }

    addSongResource(resource)
  }

  function addTransmissionResource(edited: TransmissionResource){
    if (!setSong) return
    setSong(prev => {
      return {
        ...prev,

        transmission_resources:
          [
            ...(prev.transmission_resources), 
            edited
          ]
      }
    })
  }

  function deleteTransmissionResource(edited: TransmissionResource){
    if (!setSong) return
    setSong(prev => {
      return {
        ...prev,

        transmission_resources:
          prev.transmission_resources.filter(item =>
            item.id != edited.id
          )
      }
    })
  }

  function updateTransmissionResource(edited: TransmissionResource, patch:Partial<TransmissionResource>){
    if (!setSong) return
    setSong(prev => {
      if (!prev) return prev
      return {
        ...prev,

        transmission_resources:
          prev.transmission_resources.map(item =>
            item.id === edited.id
              ? { ...item, ...patch }
              : item
          )
      }
    })
  }

  function createTransmissionResource(
    partId: number
  ) {
    // need existing arrangement_item_id
    const arrangementItem = arrangementItems.find(
      x => x.part_id === partId 
    )
    if (!arrangementItem) return

    const nextPosition =
      transmissionResources.length > 0
        ? Math.max(
            ...transmissionResources.map(r => r.position)
          ) + 1
        : 0
    const resource: TransmissionResource = {
      id: -Date.now(),
      song_id: song.id,
      arrangement_item_id: arrangementItem.id,
      type: 'note',
      title: 'Nouvelle ressource',
      content: '',
      position: nextPosition
    }
    addTransmissionResource(resource)
  }

  function getPartForResource(
    resource: TransmissionResource
  ) {
    const arrangementItem = arrangementItems.find(
      x => x.id === resource.arrangement_item_id
    )

    if (!arrangementItem) return undefined

    return parts.find(
      part => part.id === arrangementItem.part_id
    )
  }

  function getArrangementItemsForPart(part: Part) {
    return arrangementItems.filter(
      x => x.song_id === song.id && x.part_id === part.id
    ).sort((a,b) => a.start_halfbeat - b.start_halfbeat)
  }

  const transmissionByPart =
    parts
      .map(part => ({
        part,
        resources:
          transmissionResources.filter(resource => {
            const resourcePart = getPartForResource(resource)

            return resourcePart?.id === part.id
          })
      }))
      .filter(group =>
        editing || group.resources.length > 0
      )

  return (
    <section className="card song-resources">

      <h3>🧰 Ressources</h3>


      {/* =====================================
          RESSOURCES DU MORCEAU
          ===================================== */}

      <section className="resource-section">

        <div className="resource-section-header">
          <h4>Ressources du morceau</h4>

          {editing && (
            <button
              type="button"
              className="resource-add-button"
              onClick={createSongResource}
            >
              + Ajouter
            </button>
          )}
        </div>


        {resources.length === 0 ? (
          <p className="muted">
            Aucune ressource générale.
          </p>
        ) : (

          <div className="resource-list">

            {resources.map(resource => (

              <SongResourceCard
                key={resource.id}
                resource={resource}
                editing={editing}
                onUpdate={patch => updateSongResource(resource, patch)}
                onDelete={() => deleteSongResource(resource)}
              />

            ))}

          </div>

        )}

      </section>


      {/* =====================================
          TRANSMISSION
          ===================================== */}

      <section className="resource-section transmission-section">

        <div className="resource-section-header">
          <h4>Transmission</h4>
        </div>


        {transmissionByPart.length === 0 && !editing ? (

          <p className="muted">
            Aucune ressource de transmission.
          </p>

        ) : (

          <div className="transmission-groups">

            {transmissionByPart.map(
              ({ part, resources }) => {
                const arrItems = getArrangementItemsForPart(part)

                return (
                <section
                  className="transmission-part"
                  key={part.id}
                >
                  <div className="transmission-part-header">
                    <strong>
                      {part.name}
                    </strong>

                    {editing && arrItems.length>0 && ( 
                      <button
                        type="button"
                        className="resource-add-small"
                        onClick={() => createTransmissionResource(part.id)}
                      >
                        +
                      </button>
                    )}

                  </div>

                  {resources.length === 0 ? (

                    editing && (
                      <p className="muted resource-empty">
                        Aucune ressource
                      </p>
                    )

                  ) : (

                    <div className="resource-list">

                      {resources.map(resource => (

                        <TransmissionResourceCard
                          key={resource.id}
                          resource={resource}
                          editing={editing}
                          onUpdate={patch => updateTransmissionResource(resource, patch)}
                          arrangementItemsForPart={arrItems}
                          onDelete={() => deleteTransmissionResource(resource)}
                        />
                      ))}
                    </div>
                  )}
                </section>
              )}
            )}
          </div>
        )}
      </section>
    </section>
  )
}


/* =====================================================
   SONG RESOURCE
   ===================================================== */

type SongResourceCardProps = {
  resource: SongResource
  editing: boolean

  onUpdate: (
    patch: Partial<SongResource>
  ) => void

  onDelete: () => void
}


function SongResourceCard({
  resource,
  editing,
  onUpdate,
  onDelete
}: SongResourceCardProps) {

  if (!editing) {
    return (
      <div className="resource-card">
        <div className="resource-icon">
          {resourceIcons[resource.type]}
        </div>
        <div className="resource-body">
          <strong>{resource.title}</strong>
          <ResourceContent type={resource.type} content={resource.content}/>
        </div>
      </div>
    )
  }

  return (
    <div className="resource-card resource-card-edit">
      <div className="resource-icon">{resourceIcons[resource.type]}</div>
      <div className="resource-body">
        <input
          value={resource.title}
          onChange={e =>
            onUpdate({
              title: e.target.value
            })
          }
          placeholder="Titre"
        />
        <select className="resource-type-selection"
          value={resource.type}
          onChange={e => onUpdate({type: e.target.value as SongResource['type']})}
        >
          {Object.entries(resourceLabels).map(
            ([value, label]) => (<option key={value} value={value}>{label}</option>)
          )}
        </select>

        <textarea className='resource-content-input'
          value={resource.content}
          onChange={e => onUpdate({content: e.target.value})}
          placeholder={
            resource.type === 'link'
              ? 'URL'
              : 'Contenu'
          }
        />
      </div>
      <button type="button" className="resource-delete" onClick={onDelete}>🗑️</button>
    </div>
  )
}


/* =====================================================
   TRANSMISSION RESOURCE
   ===================================================== */

type TransmissionResourceCardProps = {
  resource: TransmissionResource
  editing: boolean
  onUpdate: (patch: Partial<TransmissionResource>) => void
  onDelete: () => void
  arrangementItemsForPart: ArrangementItem[]
}

function TransmissionResourceCard({
  resource,
  editing,
  onUpdate,
  onDelete,
  arrangementItemsForPart
}: TransmissionResourceCardProps) {

  if (!editing) {
    return (
      <div className="resource-card transmission-resource">
        <div className="resource-icon">{resourceIcons[resource.type]}</div>
        <div className="resource-body">
          <strong>{resource.title}</strong>
          <ResourceContent type={resource.type} content={resource.content}/>
        </div>
      </div>
    )
  }

  return (
    <div className="resource-card resource-card-edit transmission-resource">
      <div className="resource-icon">{resourceIcons[resource.type]}</div>
      <div className="resource-body">
        <input
          value={resource.title}
          onChange={e => onUpdate({title: e.target.value})}
          placeholder="Titre"
        />
        <select className='resource-type-selection'
          value={resource.type}
          onChange={e => onUpdate({type:e.target.value as TransmissionResource['type']})}
        >
          {Object.entries(resourceLabels).map(
            ([value, label]) => (
              <option key={value} value={value}>{label}</option>
            )
          )}
        </select>

        <textarea className='resource-content-input'
          value={resource.content}
          onChange={e => onUpdate({content: e.target.value})}
          placeholder={resource.type === 'link' ? 'URL' : 'Contenu'}
        />
        <select className='resource-arrangement-item-selection'
          value={resource.arrangement_item_id}
          onChange={e => onUpdate({arrangement_item_id:Number(e.target.value) as TransmissionResource['arrangement_item_id']})}
        >
          {
          arrangementItemsForPart.map(
            (item, index) => (
              <option key={item.id} value={item.id}>{index+1} {item.label}</option>
            )
          )}
        </select>

      </div>
      <button type="button" className="resource-delete" onClick={onDelete}>🗑️</button>
    </div>
  )
}

/* =====================================================
   CONTENT
   ===================================================== */

function ResourceContent({
  type,
  content
}: {
  type: SongResource['type']
  content: string
}) {
  if (!content) {
    return null
  }
  if (type === 'link') {
    return (
      <a href={content} target="_blank" rel="noopener noreferrer">Ouvrir le lien →</a>
    )
  }
  if (type === 'audio') {
    return (
      <audio controls src={content}/>
    )
  }
  if (type === 'video') {
    return (
      <video controls src={content}/>
    )
  }
  return (
    <p className="resource-content">{content}</p>
  )
}
