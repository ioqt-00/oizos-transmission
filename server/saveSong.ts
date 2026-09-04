import Database from 'better-sqlite3'

export function createSaveSong(db: Database.Database) {

  return db.transaction((songId: number, data: any) => {

    /*
     * Vérification du morceau
     */
    const song = db
      .prepare('SELECT id FROM songs WHERE id=?')
      .get(songId)

    if (!song) {
      throw new Error('Morceau introuvable.')
    }

    /*
     * ============================================================
     * METADATA
     * ============================================================
     */

    db.prepare(`
      UPDATE songs
      SET
        title=@title,
        artist=@artist,
        composer=@composer,
        arranger=@arranger,
        duration=@duration,
        tempo=@tempo,
        key_signature=@key_signature,
        notes=@notes,
        lyrics=@lyrics,
        url_drive=@url_drive,
        updated_at=CURRENT_TIMESTAMP
      WHERE id=@id
    `).run({
      id: songId,
      title: data.title ?? '',
      artist: data.artist ?? '',
      composer: data.composer ?? '',
      arranger: data.arranger ?? '',
      duration: data.duration ?? '',
      tempo: data.tempo ?? '',
      key_signature: data.key_signature ?? '',
      notes: data.notes ?? '',
      lyrics: data.lyrics ?? '',
      url_drive: data.url_drive ?? ''
    })


    /*
     * ============================================================
     * GRILLE
     * ============================================================
     */

    db.prepare(`
      DELETE FROM grid_blocks
      WHERE song_id=?
    `).run(songId)

    const insertBlock = db.prepare(`
      INSERT INTO grid_blocks(
        song_id,
        name,
        position,
        notes
      )
      VALUES(?,?,?,?)
    `)

    const insertMeasure = db.prepare(`
      INSERT INTO measures(
        block_id,
        position,
        chord,
        beats,
        notes
      )
      VALUES(?,?,?,?,?)
    `)

    const blockIdMap = new Map<number, number>()

    for (
      const [blockIndex, block]
      of (data.blocks ?? []).entries()
    ) {

      const result = insertBlock.run(
        songId,
        block.name ?? 'Bloc',
        blockIndex,
        block.notes ?? ''
      )

      const newBlockId =
        Number(result.lastInsertRowid)

      if (
        block.id !== undefined &&
        block.id !== null
      ) {
        blockIdMap.set(
          Number(block.id),
          newBlockId
        )
      }

      const blockMeasures =
        block.measures ??
        (data.measures ?? []).filter(
          (m: any) =>
            m.block_id === block.id
        )

      for (
        const [measureIndex, measure]
        of blockMeasures.entries()
      ) {

        insertMeasure.run(
          newBlockId,
          measureIndex,
          measure.chord ?? '',
          Number(measure.beats) || 4,
          measure.notes ?? ''
        )
      }
    }


    /*
     * ============================================================
     * STRUCTURE
     * ============================================================
     */

    db.prepare(`
      DELETE FROM structure_items
      WHERE song_id=?
    `).run(songId)

    const insertStructure = db.prepare(`
      INSERT INTO structure_items(
        song_id,
        block_id,
        position,
        repeat_count,
        notes
      )
      VALUES(?,?,?,?,?)
    `)

    const structureIdMap =
      new Map<number, number>()

    for (
      const [position, item]
      of (data.structure ?? []).entries()
    ) {

      const newBlockId =
        blockIdMap.get(
          Number(item.block_id)
        )

      if (newBlockId === undefined) {
        throw new Error(
          `Bloc introuvable dans la structure : ${item.block_id}`
        )
      }

      const result =
        insertStructure.run(
          songId,
          newBlockId,
          position,
          Math.max(
            1,
            Number(item.repeat_count) || 1
          ),
          item.notes ?? ''
        )

      if (
        item.id !== undefined &&
        item.id !== null
      ) {
        structureIdMap.set(
          Number(item.id),
          Number(result.lastInsertRowid)
        )
      }
    }


    /*
     * ============================================================
     * ARRANGEMENT
     * ============================================================
     */

    db.prepare(`DELETE FROM arrangement_items WHERE song_id=?`).run(songId)

    const insertArrangement = db.prepare(`
      INSERT INTO arrangement_items(
        song_id,
        part_id,
        start_halfbeat,
        end_halfbeat,
        label,
        notes
      )
      VALUES(?,?,?,?,?,?)
    `)

    for (const item of (data.arrangement ?? [])) {
      const start_halfbeat = Number(item.start_halfbeat) || 0

      insertArrangement.run(
        songId,
        Number(item.part_id),
        Math.max(
          0,
          start_halfbeat
        ),
        Math.max(
          1,
          Number(item.end_halfbeat) || start_halfbeat+1
        ),
        item.label ?? '',
        item.notes ?? ''
      )
    }

    /*
     * ============================================================
     * RESSOURCES
     * ============================================================
     */

    db.prepare(`DELETE FROM song_resources WHERE song_id=?`).run(songId)

    const insertResources = db.prepare(`
      INSERT INTO song_resources(
        song_id,
        type,
        title,
        content, 
        position
      )
      VALUES(?,?,?,?,?)
    `)

    for (const item of (data.resources ?? [])) {
      insertResources.run(
        songId,
        item.type,
        item.title,
        item.content,
        item.position
      )
    }

    /*
     * ============================================================
     * TRANSMISSION RESSOURCES
     * ============================================================
     */

    db.prepare(`DELETE FROM transmission_resources WHERE song_id=?`).run(songId)

    const insertTransmissionResources = db.prepare(`
      INSERT INTO transmission_resources(
        song_id,
        arrangement_item_id,
        type,
        title,
        content, 
        position
      )
      VALUES(?,?,?,?,?,?)
    `)

    for (const item of (data.transmission_resources ?? [])) {
      insertTransmissionResources.run(
        songId,
        item.arrangement_item_id,
        item.type,
        item.title,
        item.content,
        item.position
      )
    }
  })
}
