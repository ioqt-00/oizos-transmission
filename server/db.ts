import Database from 'better-sqlite3'
import path from 'node:path'
import fs from 'node:fs'

import { ROOT, dataDir, uploadDir } from './services/song'

fs.mkdirSync(dataDir,{recursive:true})
fs.mkdirSync(uploadDir,{recursive:true})

const db=new Database(path.join(dataDir,'orchestra.db'))
db.pragma('foreign_keys = ON')

db.exec(`
CREATE TABLE IF NOT EXISTS parts(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL UNIQUE,position INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS songs(id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL UNIQUE,artist TEXT DEFAULT '',composer TEXT DEFAULT '',arranger TEXT DEFAULT '',duration TEXT DEFAULT '',tempo TEXT DEFAULT '',key_signature TEXT DEFAULT '',notes TEXT DEFAULT '',lyrics TEXT DEFAULT '',url_drive TEXT DEFAULT '',created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS scores(id INTEGER PRIMARY KEY AUTOINCREMENT,song_id INTEGER NOT NULL REFERENCES songs(id) ON DELETE CASCADE,part_id INTEGER NOT NULL REFERENCES parts(id) ON DELETE CASCADE,file_name TEXT NOT NULL,file_path TEXT NOT NULL,UNIQUE(song_id,part_id));
CREATE TABLE IF NOT EXISTS grid_blocks(id INTEGER PRIMARY KEY AUTOINCREMENT,song_id INTEGER NOT NULL REFERENCES songs(id) ON DELETE CASCADE,name TEXT NOT NULL,position INTEGER NOT NULL,notes TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS measures(id INTEGER PRIMARY KEY AUTOINCREMENT,block_id INTEGER NOT NULL REFERENCES grid_blocks(id) ON DELETE CASCADE,position INTEGER NOT NULL,chord TEXT DEFAULT '',beats INTEGER NOT NULL DEFAULT 4,notes TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS structure_items(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  song_id INTEGER NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  block_id INTEGER NOT NULL REFERENCES grid_blocks(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  repeat_count INTEGER NOT NULL DEFAULT 1,
  notes TEXT DEFAULT ''
  );
CREATE TABLE IF NOT EXISTS arrangement_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  song_id INTEGER NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  part_id INTEGER NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
  start_halfbeat INTEGER NOT NULL,
  end_halfbeat INTEGER NOT NULL,
  label TEXT DEFAULT '',
  notes TEXT DEFAULT ''
  );
`)

const defaultParts = ['Accordéon', 'Basse', 'Clarinette', 'Cordes Frottées', 'Flûte', 'Médium', 'Percus', 'Saxophone Alto', 'Trompette', 'Chant', 'Chant 2', 'Chant 3']
const ins=db.prepare('INSERT OR IGNORE INTO parts(name,position) VALUES(?,?)');
defaultParts.forEach((x,i)=>ins.run(x,i))

export default db
