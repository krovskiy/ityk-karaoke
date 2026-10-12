import * as database from '../database/event.js';
import { validText, optionalText, appleUrl, musicUrl, type SongMetadata } from './validation.js';

// the error handler sends this status and message to the browser
export class EventError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

type QueueEntry = SongMetadata & { singer?: unknown; song?: unknown };

export function getPublicEvent() {
  let results = null;
  if (database.getPhase() === 'revealed') {
    results = database.getResults();
  }
  return {
    phase: database.getPhase(),
    performances: database.getPerformances(),
    results,
    certificates: results === null ? null : database.getCertificates(),
  };
}

export function getHostEvent() {
  return {
    phase: database.getPhase(),
    performances: database.getHostPerformances(),
    results: database.getResults(),
    certificates: database.getCertificates(),
  };
}

export function joinQueue(entry: QueueEntry) {
  if (database.getPhase() !== 'open') {
    throw new EventError('The queue is closed.');
  }
  if (!validText(entry.singer)) {
    throw new EventError('Enter a singer name (1 to 200 characters).');
  }
  if (!validText(entry.song)) {
    throw new EventError('Enter a song (1 to 200 characters).');
  }
  database.addPerformance(entry.singer.trim(), entry.song.trim(), {
    artists: optionalText(entry.artists),
    album: optionalText(entry.album),
    artwork: appleUrl(entry.artwork, 'mzstatic.com'),
    music_url: musicUrl(entry.music_url),
  });
}

export function vote(id: unknown, voter: string) {
  const current = database.getCurrent();
  if (database.getPhase() !== 'open' || !current || current.id !== id) {
    throw new EventError('Voting is only open for the current singer.');
  }
  if (!database.addVote(Number(current.id), voter)) {
    throw new EventError('You already voted for this performance.', 409);
  }
}

export function nextSinger() {
  if (database.getPhase() !== 'open') {
    throw new EventError('Reopen the event first.');
  }
  database.finishCurrent();
  database.startNext();
}

export function changePerformance(id: number, action: string, entry: QueueEntry) {
  const person = database.getPerformance(id);
  if (!person) {
    throw new EventError('Performance not found.', 404);
  }

  if (action === 'edit') {
    if (!validText(entry.singer) || !validText(entry.song)) {
      throw new EventError('Singer and song must contain 1 to 200 characters.');
    }
    if (entry.song.trim() !== person.song) {
      database.clearSongDetails(id);
    }
    database.editPerformance(id, entry.singer.trim(), entry.song.trim());
  } else if (action === 'start') {
    if (database.getPhase() !== 'open' || person.status !== 'waiting') {
      throw new EventError('Only a waiting singer can start while the event is open.');
    }
    database.finishCurrent();
    database.setStatus(id, 'singing');
  } else if (action === 'skip') {
    database.setStatus(id, 'skipped');
  } else if (action === 'restore') {
    if (person.status !== 'skipped') {
      throw new EventError('Only a skipped singer can return to the queue.');
    }
    database.setStatus(id, 'waiting');
  } else if (action === 'delete') {
    database.deletePerformance(id);
  } else if (action === 'up' || action === 'down') {
    const queue = database.getQueue();
    const index = queue.findIndex(row => row.id === id);
    let neighborIndex = index - 1;
    if (action === 'down') {
      neighborIndex = index + 1;
    }
    if (index < 0 || neighborIndex < 0 || neighborIndex >= queue.length) {
      throw new EventError('Cannot move this singer further.');
    }
    database.swapPositions(id, Number(queue[neighborIndex].id));
  } else {
    throw new EventError('Unknown action.');
  }
}

export function closeEvent() {
  database.finishCurrent();
  database.setPhase('closed');
}

export function reopenEvent() {
  database.setPhase('open');
}

export function revealResults() {
  if (database.getPhase() === 'open') {
    throw new EventError('Close voting first.');
  }
  database.setPhase('revealed');
}

export function resetEvent(confirmation: unknown) {
  if (confirmation !== 'RESET') {
    throw new EventError('Type RESET to clear the event.');
  }
  database.resetEvent();
}

export function awardCertificate(category: unknown, performanceId: unknown) {
  const categories = ['costume', 'presence', 'duet', 'unexpected'];
  if (typeof category !== 'string' || !categories.includes(category)) {
    throw new EventError('Choose a valid certificate category.');
  }
  if (performanceId !== null && (typeof performanceId !== 'number' || !Number.isInteger(performanceId) || database.getPerformance(performanceId)?.status !== 'done')) {
    throw new EventError('Choose a finished performance for this certificate.');
  }
  database.setCertificate(category, performanceId as number | null);
}
