import db from "./db"
import { GridBlock, Measure, StructureItem, ArrangementItem, SongResource, TransmissionResource } from '../client/src/types/song.ts'
import { isResourceType } from './services/song.ts'

type SaveSongPayload = {
  title?: string
  artist?: string
  composer?: string
  arranger?: string
  duration?: string
  tempo?: string
  key_signature?: string
  notes?: string
  lyrics?: string
  url_drive?: string

  blocks?: GridBlock[]
  measures?: Measure[]
  structure?: StructureItem[]
  arrangement?: ArrangementItem[]
  song_resources?: SongResource[]
  transmission_resources?: TransmissionResource[]
}

function idsOf(items: { id: number }[]) {
  return new Set(
    items
      .filter(x => x.id > 0)
      .map(x => x.id)
  )
}

function assertResourceType(type: string) {
  if (!isResourceType(type)) {
    throw new Error(`Type de ressource invalide : ${type}`)
  }
}

export function saveSong (req, res) {
  const songId = Number(req.params.id)
  const data = req.body as SaveSongPayload

  if (!Number.isInteger(songId) || songId <= 0) {
    return res.status(400).send('ID de morceau invalide.')
  }

  try {
    /*
      * ==========================================================
      * ID MAP
      *
      * Exemple :
      *
      * -101 → 42
      * -102 → 43
      *
      * Les IDs négatifs viennent du frontend.
      * ==========================================================
      */

    const blockIdMap = new Map<number, number>()
    const measureIdMap = new Map<number, number>()
    const structureIdMap = new Map<number, number>()
    const arrangementIdMap = new Map<number, number>()
    const songResourceIdMap = new Map<number, number>()
    const transmissionResourceIdMap = new Map<number, number>()

    /*
      * ==========================================================
      * TRANSACTION
      * ==========================================================
      */

    const transaction = db.transaction(() => {

      /*
        * --------------------------------------------------------
        * 0. Vérifier que le morceau existe
        * --------------------------------------------------------
        */

      const song = db.prepare(`SELECT id FROM songs WHERE id = ?`).get(songId)

      if (!song) {
        throw new Error('Morceau introuvable.')
      }

      /*
        * --------------------------------------------------------
        * 1. SONG
        * --------------------------------------------------------
        */

      db.prepare(`
        UPDATE songs
        SET
          title = @title,
          artist = @artist,
          composer = @composer,
          arranger = @arranger,
          duration = @duration,
          tempo = @tempo,
          key_signature = @key_signature,
          notes = @notes,
          lyrics = @lyrics,
          url_drive = @url_drive,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = @id
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
        * --------------------------------------------------------
        * 2. BLOCKS
        *
        * UPDATE si id positif
        * INSERT si id négatif
        * DELETE si absent du payload
        * --------------------------------------------------------
        */

      const blocks = data.blocks ?? []

      const existingBlocks = db.prepare(`
        SELECT id
        FROM grid_blocks
        WHERE song_id = ?
      `).all(songId) as { id: number }[]

      const incomingBlockIds = idsOf(blocks)

      // Suppression des blocs disparus
      for (const row of existingBlocks) {
        if (!incomingBlockIds.has(row.id)) {
          db.prepare(`DELETE FROM grid_blocks WHERE id = ? AND song_id = ?`).run(row.id, songId)
        }
      }

      // UPDATE / INSERT
      for (const block of blocks) {
        if (block.id > 0) {
          const existing = db.prepare(`
            SELECT id FROM grid_blocks WHERE id = ? AND song_id = ?
          `).get(block.id, songId)

          if (!existing) {
            throw new Error(
              `Bloc ${block.id} introuvable pour ce morceau.`
            )
          }

          db.prepare(`
            UPDATE grid_blocks
            SET
              name = ?,
              position = ?,
              notes = ?
            WHERE id = ?
              AND song_id = ?
          `).run(
            block.name ?? 'Bloc',
            block.position,
            block.notes ?? '',
            block.id,
            songId
          )
          blockIdMap.set(block.id, block.id)

        } else {
          const result = db.prepare(`
            INSERT INTO grid_blocks (
              song_id,
              name,
              position,
              notes
            )
            VALUES (?, ?, ?, ?)
          `).run(
            songId,
            block.name ?? 'Bloc',
            block.position,
            block.notes ?? ''
          )

          blockIdMap.set(
            block.id,
            Number(result.lastInsertRowid)
          )
        }
      }

      /*
        * --------------------------------------------------------
        * 3. MEASURES
        *
        * Important :
        * le block_id peut lui-même être négatif.
        * On le résout avec blockIdMap.
        * --------------------------------------------------------
        */

      const measures = data.measures ?? []

      const existingMeasures = db.prepare(`
        SELECT m.id
        FROM measures m
        JOIN grid_blocks b
          ON b.id = m.block_id
        WHERE b.song_id = ?
      `).all(songId) as { id: number }[]

      const incomingMeasureIds = idsOf(measures)

      for (const row of existingMeasures) {
        if (!incomingMeasureIds.has(row.id)) {
          db.prepare(`
            DELETE FROM measures WHERE id = ?
          `).run(row.id)
        }
      }

      for (const measure of measures) {

        const realBlockId =
          blockIdMap.get(measure.block_id)

        if (!realBlockId) {
          throw new Error(
            `Bloc ${measure.block_id} introuvable pour la mesure ${measure.id}.`
          )
        }

        if (measure.id > 0) {

          const existing = db.prepare(`
            SELECT m.id
            FROM measures m
            JOIN grid_blocks b
              ON b.id = m.block_id
            WHERE m.id = ?
              AND b.song_id = ?
          `).get(measure.id, songId)

          if (!existing) {
            throw new Error(
              `Mesure ${measure.id} introuvable pour ce morceau.`
            )
          }

          db.prepare(`
            UPDATE measures
            SET
              block_id = ?,
              position = ?,
              chord = ?,
              beats = ?,
              notes = ?
            WHERE id = ?
          `).run(
            realBlockId,
            measure.position,
            measure.chord ?? '',
            Number(measure.beats) || 4,
            measure.notes ?? '',
            measure.id
          )

          measureIdMap.set(measure.id, measure.id)

        } else {

          const result = db.prepare(`
            INSERT INTO measures (
              block_id,
              position,
              chord,
              beats,
              notes
            )
            VALUES (?, ?, ?, ?, ?)
          `).run(
            realBlockId,
            measure.position,
            measure.chord ?? '',
            Number(measure.beats) || 4,
            measure.notes ?? ''
          )

          measureIdMap.set(
            measure.id,
            Number(result.lastInsertRowid)
          )
        }
      }

      /*
        * --------------------------------------------------------
        * 4. STRUCTURE
        *
        * block_id peut être un ID temporaire.
        * --------------------------------------------------------
        */

      const structure = data.structure ?? []

      const existingStructure = db.prepare(`
        SELECT id FROM structure_items WHERE song_id = ?
      `).all(songId) as { id: number }[]

      const incomingStructureIds = idsOf(structure)

      for (const row of existingStructure) {
        if (!incomingStructureIds.has(row.id)) {
          db.prepare(`
            DELETE FROM structure_items WHERE id = ? AND song_id = ?
          `).run(row.id, songId)
        }
      }

      for (const item of structure) {

        const realBlockId = blockIdMap.get(item.block_id)

        if (!realBlockId) {
          throw new Error(
            `Bloc ${item.block_id} introuvable pour la structure.`
          )
        }

        if (item.id > 0) {
          const existing = db.prepare(`
            SELECT id FROM structure_items WHERE id = ? AND song_id = ?
          `).get(item.id, songId)

          if (!existing) {
            throw new Error(
              `Structure item ${item.id} introuvable.`
            )
          }

          db.prepare(`
            UPDATE structure_items
            SET
              block_id = ?,
              position = ?,
              repeat_count = ?,
              notes = ?
            WHERE id = ?
              AND song_id = ?
          `).run(
            realBlockId,
            item.position,
            Number(item.repeat_count) || 1,
            item.notes ?? '',
            item.id,
            songId
          )

          structureIdMap.set(item.id, item.id)

        } else {

          const result = db.prepare(`
            INSERT INTO structure_items (
              song_id,
              block_id,
              position,
              repeat_count,
              notes
            )
            VALUES (?, ?, ?, ?, ?)
          `).run(
            songId,
            realBlockId,
            item.position,
            Number(item.repeat_count) || 1,
            item.notes ?? ''
          )

          structureIdMap.set(
            item.id,
            Number(result.lastInsertRowid)
          )
        }
      }

      /*
        * --------------------------------------------------------
        * 5. TRANSMISSION RESOURCES
        *
        * On les traite AVANT arrangement_items disparus,
        * sinon les FK pourraient casser pendant la synchronisation.
        *
        * --------------------------------------------------------
        */

      const transmissionResources = data.transmission_resources ?? []

      const existingTransmissionResources = db.prepare(`
        SELECT tr.id
        FROM transmission_resources tr
        JOIN arrangement_items ai
          ON ai.id = tr.arrangement_item_id
        WHERE tr.song_id = ?
          AND ai.song_id = ?
      `).all(songId, songId) as { id: number }[]

      const incomingTransmissionIds = idsOf(transmissionResources)

      for (const row of existingTransmissionResources) {
        if (!incomingTransmissionIds.has(row.id)) {
          db.prepare(`
            DELETE FROM transmission_resources WHERE id = ? AND song_id = ?
          `).run(row.id, songId)
        }
      }

      /*
        * --------------------------------------------------------
        * 6. ARRANGEMENT ITEMS
        *
        * On synchronise AVANT de recréer les transmission resources.
        * --------------------------------------------------------
        */

      const arrangement =
        data.arrangement ?? []

      const existingArrangement = db.prepare(`
        SELECT id FROM arrangement_items WHERE song_id = ?
      `).all(songId) as { id: number }[]

      const incomingArrangementIds = idsOf(arrangement)

      for (const row of existingArrangement) {
        if (!incomingArrangementIds.has(row.id)) {
          db.prepare(`
            DELETE FROM arrangement_items WHERE id = ? AND song_id = ?
          `).run(row.id, songId)
        }
      }

      for (const item of arrangement) {

        if (item.start_halfbeat < 0 ||
            item.end_halfbeat <= item.start_halfbeat) {
          throw new Error(
            `Position invalide pour l'arrangement ${item.id}.`
          )
        }

        const part = db.prepare(`
          SELECT id FROM parts WHERE id = ?
        `).get(item.part_id)

        if (!part) {
          throw new Error(
            `Pupitre ${item.part_id} introuvable.`
          )
        }

        if (item.id > 0) {
          const existing = db.prepare(`
            SELECT id FROM arrangement_items WHERE id = ? AND song_id = ?
          `).get(item.id, songId)

          if (!existing) {
            throw new Error(
              `Arrangement item ${item.id} introuvable.`
            )
          }

          db.prepare(`
            UPDATE arrangement_items
            SET
              part_id = ?,
              start_halfbeat = ?,
              end_halfbeat = ?,
              label = ?,
              notes = ?
            WHERE id = ?
              AND song_id = ?
          `).run(
            item.part_id,
            item.start_halfbeat,
            item.end_halfbeat,
            item.label ?? '',
            item.notes ?? '',
            item.id,
            songId
          )

          arrangementIdMap.set(item.id, item.id)

        } else {

          const result = db.prepare(`
            INSERT INTO arrangement_items (
              song_id,
              part_id,
              start_halfbeat,
              end_halfbeat,
              label,
              notes
            )
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(
            songId,
            item.part_id,
            item.start_halfbeat,
            item.end_halfbeat,
            item.label ?? '',
            item.notes ?? ''
          )

          arrangementIdMap.set(
            item.id,
            Number(result.lastInsertRowid)
          )
        }
      }

      /*
        * --------------------------------------------------------
        * 7. TRANSMISSION RESOURCES
        *
        * Maintenant tous les arrangement_items existent
        * réellement en BDD.
        * --------------------------------------------------------
        */

      for (const resource of transmissionResources) {

        assertResourceType(resource.type)

        const realArrangementItemId =
          arrangementIdMap.get(
            resource.arrangement_item_id
          )

        if (!realArrangementItemId) {
          throw new Error(
            `Arrangement item ${resource.arrangement_item_id} introuvable pour la ressource ${resource.id}.`
          )
        }

        if (resource.id > 0) {

          const existing = db.prepare(`
            SELECT tr.id
            FROM transmission_resources tr
            JOIN arrangement_items ai
              ON ai.id = tr.arrangement_item_id
            WHERE tr.id = ?
              AND tr.song_id = ?
              AND ai.song_id = ?
          `).get(
            resource.id,
            songId,
            songId
          )

          if (!existing) {
            throw new Error(
              `Transmission resource ${resource.id} introuvable.`
            )
          }

          db.prepare(`
            UPDATE transmission_resources
            SET
              arrangement_item_id = ?,
              type = ?,
              title = ?,
              content = ?,
              position = ?
            WHERE id = ?
              AND song_id = ?
          `).run(
            realArrangementItemId,
            resource.type,
            resource.title,
            resource.content ?? '',
            resource.position,
            resource.id,
            songId
          )

          transmissionResourceIdMap.set(
            resource.id,
            resource.id
          )

        } else {

          const result = db.prepare(`
            INSERT INTO transmission_resources (
              song_id,
              arrangement_item_id,
              type,
              title,
              content,
              position
            )
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(
            songId,
            realArrangementItemId,
            resource.type,
            resource.title,
            resource.content ?? '',
            resource.position
          )

          transmissionResourceIdMap.set(
            resource.id,
            Number(result.lastInsertRowid)
          )
        }
      }


      /*
        * --------------------------------------------------------
        * 8. SONG RESOURCES
        * --------------------------------------------------------
        */

      const songResources =
        data.song_resources ?? []

      const existingSongResources = db.prepare(`
        SELECT id
        FROM song_resources
        WHERE song_id = ?
      `).all(songId) as { id: number }[]

      const incomingSongResourceIds =
        idsOf(songResources)

      for (const row of existingSongResources) {
        if (!incomingSongResourceIds.has(row.id)) {
          db.prepare(`
            DELETE FROM song_resources
            WHERE id = ? AND song_id = ?
          `).run(row.id, songId)
        }
      }

      for (const resource of songResources) {

        assertResourceType(resource.type)

        if (resource.id > 0) {

          const existing = db.prepare(`
            SELECT id
            FROM song_resources
            WHERE id = ? AND song_id = ?
          `).get(resource.id, songId)

          if (!existing) {
            throw new Error(
              `Song resource ${resource.id} introuvable.`
            )
          }

          db.prepare(`
            UPDATE song_resources
            SET
              type = ?,
              title = ?,
              content = ?,
              position = ?
            WHERE id = ?
              AND song_id = ?
          `).run(
            resource.type,
            resource.title,
            resource.content ?? '',
            resource.position,
            resource.id,
            songId
          )

          songResourceIdMap.set(
            resource.id,
            resource.id
          )

        } else {

          const result = db.prepare(`
            INSERT INTO song_resources (
              song_id,
              type,
              title,
              content,
              position
            )
            VALUES (?, ?, ?, ?, ?)
          `).run(
            songId,
            resource.type,
            resource.title,
            resource.content ?? '',
            resource.position
          )

          songResourceIdMap.set(
            resource.id,
            Number(result.lastInsertRowid)
          )
        }
      }
    })

    transaction()


    /*
      * ==========================================================
      * RETOUR
      *
      * Le client peut remplacer ses IDs négatifs par les vrais.
      * ==========================================================
      */

    res.json({
      ok: true,

      ids: {
        blocks: Object.fromEntries(blockIdMap),
        measures: Object.fromEntries(measureIdMap),
        structure: Object.fromEntries(structureIdMap),
        arrangement: Object.fromEntries(arrangementIdMap),
        song_resources: Object.fromEntries(songResourceIdMap),
        transmission_resources:
          Object.fromEntries(transmissionResourceIdMap)
      }
    })

  } catch (error) {

    console.error('saveSong error:', error)

    const message =
      error instanceof Error
        ? error.message
        : 'Erreur lors de la sauvegarde.'

    res.status(400).send(message)
  }
}
