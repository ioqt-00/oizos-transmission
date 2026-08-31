import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()

const dbPath = path.join(
  ROOT,
  'server',
  'data',
  'orchestra.db'
)

const seedPath = path.join(
  ROOT,
  'server',
  'seed',
  'dummy-data.json'
)

if (!fs.existsSync(seedPath)) {
  console.error('❌ Aucun fichier dummy-data.json trouvé.')
  process.exit(1)
}

const data = JSON.parse(
  fs.readFileSync(seedPath, 'utf8')
)

const db = new Database(dbPath)

db.pragma('foreign_keys = ON')

const transaction = db.transaction(() => {

  /*
   * Les tables doivent déjà avoir été créées
   * par le serveur.
   */

  db.prepare('DELETE FROM structure_items').run()
  db.prepare('DELETE FROM measures').run()
  db.prepare('DELETE FROM grid_blocks').run()
  db.prepare('DELETE FROM scores').run()
  db.prepare('DELETE FROM songs').run()
  db.prepare('DELETE FROM parts').run()

  const insertPart = db.prepare(`
    INSERT INTO parts (
      id,
      name,
      position
    )
    VALUES (
      @id,
      @name,
      @position
    )
  `)

  for (const part of data.parts) {
    insertPart.run(part)
  }

  const insertSong = db.prepare(`
    INSERT INTO songs (
      id,
      title,
      artist,
      composer,
      arranger,
      duration,
      tempo,
      key_signature,
      style,
      notes,
      lyrics,
      created_at,
      updated_at
    )
    VALUES (
      @id,
      @title,
      @artist,
      @composer,
      @arranger,
      @duration,
      @tempo,
      @key_signature,
      @style,
      @notes,
      @lyrics,
      @created_at,
      @updated_at
    )
  `)

  for (const song of data.songs) {
    insertSong.run(song)
  }

  const insertScore = db.prepare(`
    INSERT INTO scores (
      id,
      song_id,
      part_id,
      file_name,
      file_path
    )
    VALUES (
      @id,
      @song_id,
      @part_id,
      @file_name,
      @file_path
    )
  `)

  for (const score of data.scores) {
    insertScore.run(score)
  }

  const insertBlock = db.prepare(`
    INSERT INTO grid_blocks (
      id,
      song_id,
      name,
      position,
      notes
    )
    VALUES (
      @id,
      @song_id,
      @name,
      @position,
      @notes
    )
  `)

  for (const block of data.blocks) {
    insertBlock.run(block)
  }

  const insertMeasure = db.prepare(`
    INSERT INTO measures (
      id,
      block_id,
      position,
      chord,
      beats,
      notes
    )
    VALUES (
      @id,
      @block_id,
      @position,
      @chord,
      @beats,
      @notes
    )
  `)

  for (const measure of data.measures) {
    insertMeasure.run(measure)
  }

  const insertStructure = db.prepare(`
    INSERT INTO structure_items (
      id,
      song_id,
      block_id,
      position,
      repeat_count,
      notes
    )
    VALUES (
      @id,
      @song_id,
      @block_id,
      @position,
      @repeat_count,
      @notes
    )
  `)

  for (const item of data.structure) {
    insertStructure.run(item)
  }
})

transaction()

console.log('✓ Dummy data restaurées.')
console.log(`✓ ${data.songs.length} morceau(x)`)
console.log(`✓ ${data.blocks.length} bloc(s)`)
console.log(`✓ ${data.measures.length} mesure(s)`)
