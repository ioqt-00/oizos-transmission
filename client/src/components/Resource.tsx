import type { Song, SongResource, TransmissionResource } from '../types/song'
import './Resource.css'

type SongResourcesProps = {
  song: Song
  resources: SongResource[]
  transmissionResources: TransmissionResource[]
  setResources?: React.Dispatch<React.SetStateAction<SongResource[]>>
  setTransmissionResources?: React.Dispatch<React.SetStateAction<TransmissionResource[]>>
  editing: boolean
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

export function ResourceTab({
  song,
  resources,
  setResources,
  transmissionResources,
  setTransmissionResources,
  editing
}: SongResourcesProps) {

  function addSongResource(item: SongResource){
    setResources(current => [
        ...current, item
    ])
  }

  function deleteSongResource(item: SongResource){
    setResources(current =>
      current.filter(x =>
          x.id !== item.id
      )
    )
  }

  function updateSongResource(item: SongResource, patch:Partial<SongResource>){
    setResources(current =>
      current.map(x =>
        x.id === item.id
          ? { ...x, ...patch }
          : x
      )
    )
  }    

  function createResource(){
    const resource: SongResource = {
      id: -Date.now(),
      song_id: song.id,
      type: 'note',
      title: 'Nouvelle ressource',
      content: '',
      position: resources.length
    }

    addSongResource(resource)
  }

  return (
    <section className="card"><h3>🧰 Ressources</h3>

      {resources.length === 0 && (<p className="muted">Aucune ressource pour ce morceau.</p>)}

      <div className="song-resources">
        {resources.map(resource => (
          <div className="song-resource" key={resource.id}>
            <div className="song-resource-header">
              <span className="song-resource-icon">
                {resourceIcons[resource.type]}
              </span>

              {editing
                ? (<input value={resource.title} onChange={e => updateSongResource(resource, {title: e.target.value})}/>)
                : (<strong>{resource.title}</strong>)
              }

              {editing && (
                <button type="button" onClick={() => deleteSongResource(resource)}>🗑️</button>
              )}
            </div>

            {editing 
              ? (
              <>
                <select value={resource.type}
                  onChange={e => updateSongResource(resource, {type: e.target.value as SongResource['type']})}
                >
                  {Object.entries(resourceLabels).map(
                    ([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    )
                  )}
                </select>

                <textarea
                  value={resource.content}
                  onChange={e => updateSongResource(resource, {content: e.target.value})}
                  placeholder={
                    resource.type === 'link'
                      ? 'URL'
                      : 'Contenu de la ressource'
                  }
                />
              </>
              )
              : (<ResourceContent resource={resource} />)
            }
          </div>
        ))}
      </div>

      {editing && (
        <button type="button" onClick={createResource}>+ Ajouter une ressource</button>
      )}
    </section>
  )
}

function ResourceContent({resource}: {resource: SongResource}) {
  if (!resource.content) {return null}

  if (resource.type === 'link') {
    return (<a href={resource.content} target="_blank" rel="noopener noreferrer">Ouvrir le lien →</a>)
  }

  if (resource.type === 'audio') {
    return (<audio controls src={resource.content}/>)
  }

  if (resource.type === 'video') {
    return (<video controls src={resource.content}/>)
  }

  return (<p className="song-resource-content">{resource.content}</p>)
}
