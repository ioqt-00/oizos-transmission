export type Part = {
  id: number
  name: string
  position: number
}

export type GridBlock = {
    id:number
    name:string
    position:number
    notes:string
}

export type Score = {
    id:number
    part_id:number
    file_name:string
    file_path:string
}

export type Measure = {
    id:number
    block_id:number
    position:number
    chord:string
    beats:number
    notes:string
}

export type StructureItem = {
    id:number
    block_id:number
    position:number
    repeat_count:number
    notes:string
}

export type ArrangementItem = {
  id: number
  song_id: number
  part_id: number
  start_halfbeat: number
  end_halfbeat: number
  label: string
  notes: string
}

export type Song = {
  id: number
  title: string
  artist:string
  composer:string
  arranger:string
  duration:string
  tempo:string
  key_signature:string
  notes:string
  lyrics:string
  url_drive:string
  scores:Score[]
  blocks: GridBlock[]
  measures: Measure[]
  structure: StructureItem[]
  arrangement: ArrangementItem[]
  resources: SongResource[]
}

export type SongResource = {
  id: number
  song_id: number
  type: 'audio' | 'video' | 'note' | 'link'
  title: string
  content: string
  position: number
}
