import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const databasePath = resolve(process.env.DATABASE_PATH || 'data/karaoke.sqlite');
mkdirSync(dirname(databasePath), { recursive: true });
export const db = new DatabaseSync(databasePath);

db.exec(`
  CREATE TABLE IF NOT EXISTS performances (
    id INTEGER PRIMARY KEY,
    singer TEXT,
    song TEXT,
    status TEXT DEFAULT 'waiting',
    position INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS votes (
    performance_id INTEGER,
    voter TEXT,
    PRIMARY KEY (performance_id, voter)
  );
  CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY, phase TEXT);
  INSERT OR IGNORE INTO settings VALUES (1, 'open');
  CREATE TABLE IF NOT EXISTS certificates (
    category TEXT PRIMARY KEY,
    performance_id INTEGER NOT NULL
  );
`);

// add missing columns without deleting the existing queue
const columns = db.prepare('PRAGMA table_info(performances)').all();
const hasPosition = columns.some(column => column.name === 'position');
if (!hasPosition) {
  db.exec('ALTER TABLE performances ADD COLUMN position INTEGER DEFAULT 0');
}
db.exec('UPDATE performances SET position = id WHERE position = 0');

for (const name of ['artists', 'album', 'artwork', 'music_url']) {
  if (!columns.some(column => column.name === name)) {
    db.exec(`ALTER TABLE performances ADD COLUMN ${name} TEXT DEFAULT ''`);
  }
}
