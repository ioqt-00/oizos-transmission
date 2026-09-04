import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()

const db = new Database(
  path.join(ROOT, 'server', 'data', 'orchestra.db')
)

const seedDir = path.join(ROOT, 'server', 'seed')

fs.mkdirSync(seedDir, { recursive: true })

const songs = db
  .prepare('SELECT * FROM songs ORDER BY id')
  .all() as any[]

const parts = db
  .prepare('SELECT * FROM parts ORDER BY position')
  .all() as any[]

const scores = db
  .prepare('SELECT * FROM scores ORDER BY id')
  .all() as any[]

const blocks = db
  .prepare('SELECT * FROM grid_blocks ORDER BY id')
  .all() as any[]

const measures = db
  .prepare('SELECT * FROM measures ORDER BY id')
  .all() as any[]

const structure = db
  .prepare('SELECT * FROM structure_items ORDER BY id')
  .all() as any[]

const arrangement = db
  .prepare('SELECT * FROM arrangement_items ORDER BY id')
  .all() as any[]

const resources = db
  .prepare('SELECT * FROM song_resources ORDER BY id')
  .all() as any[]

const data = {
  version: 1,
  exportedAt: new Date().toISOString(),
  parts,
  songs,
  scores,
  blocks,
  measures,
  structure,
  arrangement,
  resources
}

const output = path.join(seedDir, 'dummy-data.json')

fs.writeFileSync(
  output,
  JSON.stringify(data, null, 2),
  'utf8'
)

console.log(`✓ Dummy data sauvegardées dans:`)
console.log(output)
console.log(`✓ ${songs.length} morceau(x)`)
console.log(`✓ ${blocks.length} bloc(s)`)
console.log(`✓ ${measures.length} mesure(s)`)
