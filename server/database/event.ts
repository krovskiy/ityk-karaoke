import { db } from './connection.js';

export function getPhase() {
  return db.prepare('SELECT phase FROM settings WHERE id = 1').get()!.phase;
}

export function setPhase(phase: string) {
  db.prepare('UPDATE settings SET phase = ? WHERE id = 1').run(phase);
}

export function getPerformances() {
  return db.prepare('SELECT * FROM performances ORDER BY position, id').all();
}

export function getHostPerformances() {
  return db.prepare(`
    SELECT p.*, COUNT(v.voter) AS votes
    FROM performances p LEFT JOIN votes v ON p.id = v.performance_id
    GROUP BY p.id ORDER BY p.position, p.id
  `).all();
}

export function getResults() {
  return db.prepare(`
    SELECT p.*, COUNT(v.voter) AS votes
    FROM performances p LEFT JOIN votes v ON p.id = v.performance_id
    WHERE p.status = 'done'
    GROUP BY p.id ORDER BY votes DESC, p.id
  `).all();
}

export function getPerformance(id: number) {
  return db.prepare('SELECT * FROM performances WHERE id = ?').get(id);
}

export function getCurrent() {
  return db.prepare("SELECT id FROM performances WHERE status = 'singing'").get();
}

export function getQueue() {
  return db.prepare("SELECT id, position FROM performances WHERE status = 'waiting' ORDER BY position, id").all();
}

type SongDetails = {
  artists: string;
  album: string;
  artwork: string;
  music_url: string;
};

export function addPerformance(singer: string, song: string, details: SongDetails) {
  db.prepare(`
    INSERT INTO performances (singer, song, artists, album, artwork, music_url, position)
    VALUES (?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(position), 0) + 1 FROM performances))
  `).run(singer, song, details.artists, details.album, details.artwork, details.music_url);
}

export function editPerformance(id: number, singer: string, song: string) {
  db.prepare('UPDATE performances SET singer = ?, song = ? WHERE id = ?').run(singer, song, id);
}

export function clearSongDetails(id: number) {
  db.prepare("UPDATE performances SET artists = '', album = '', artwork = '', music_url = '' WHERE id = ?").run(id);
}

export function setStatus(id: number, status: string) {
  db.prepare('UPDATE performances SET status = ? WHERE id = ?').run(status, id);
}

export function finishCurrent() {
  db.exec("UPDATE performances SET status = 'done' WHERE status = 'singing'");
}

export function startNext() {
  db.exec(`
    UPDATE performances SET status = 'singing'
    WHERE id = (
      SELECT id FROM performances WHERE status = 'waiting'
      ORDER BY position, id LIMIT 1
    )
  `);
}

export function swapPositions(firstId: number, secondId: number) {
  const first = getPerformance(firstId)!;
  const second = getPerformance(secondId)!;
  db.prepare('UPDATE performances SET position = ? WHERE id = ?').run(second.position, firstId);
  db.prepare('UPDATE performances SET position = ? WHERE id = ?').run(first.position, secondId);
}

export function deletePerformance(id: number) {
  db.prepare('DELETE FROM votes WHERE performance_id = ?').run(id);
  db.prepare('DELETE FROM performances WHERE id = ?').run(id);
}

export function addVote(id: number, voter: string) {
  const result = db.prepare('INSERT OR IGNORE INTO votes VALUES (?, ?)').run(id, voter);
  return result.changes > 0;
}

export function resetEvent() {
  db.exec("DELETE FROM votes; DELETE FROM performances; UPDATE settings SET phase = 'open'");
}
