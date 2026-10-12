import { renderFinale, type Certificate } from './finale';
type StagePerformance = { id: number; singer: string; song: string; status: string; artwork?: string; album?: string };
type StageEvent = { phase: string; performances: StagePerformance[]; results: (StagePerformance & { votes: number })[] | null; certificates?: Certificate[] | null };
let previousSinger: number | undefined;
let resultsVisible = false;
let queueSnapshot = '';
let previousNextId: number | undefined;
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const element = (id: string) => document.getElementById(id)!;

function celebrate() {
  if (reducedMotion() || document.hidden) return;
  const layer = document.createElement('div');
  layer.className = 'stage-confetti';
  layer.setAttribute('aria-hidden', 'true');
  for (let index = 0; index < 64; index++) {
    const piece = document.createElement('span');
    piece.style.setProperty('--left', `${Math.random() * 100}%`);
    piece.style.setProperty('--delay', `${Math.random() * 0.8}s`);
    piece.style.setProperty('--drift', `${(Math.random() - 0.5) * 320}px`);
    piece.style.setProperty('--spin', `${360 + Math.random() * 720}deg`);
    layer.append(piece);
  }
  (document.querySelector('.winner-spotlight[open]') ?? document.body).append(layer);
  setTimeout(() => layer.remove(), 5200);
}

export function renderProjector(event: StageEvent) {
  renderFinale({ results: event.results, certificates: event.certificates }, celebrate);
  const isProjector = document.body.classList.contains('projector-view');
  const current = event.performances.find(person => person.status === 'singing');
  document.body.classList.toggle('stage-live', current !== undefined);
  element('current-heading').textContent = current ? '● NOW SINGING / LIVE' : '○ THE STAGE IS YOURS';
  element('current').textContent = current?.singer ?? 'Who’s taking the mic?';
  element('projector-song-title').textContent = current?.song ?? (isProjector ? 'Scan the code to join the lineup' : 'Choose a song below to join the lineup');
  element('stage-caption').textContent = event.phase === 'open'
    ? (current ? (isProjector ? 'Love this performance? Scan to vote.' : 'Love this performance? Give them your vote.') : 'Pick your favorite. Make it yours.')
    : 'Voting and queue are closed.';
  if (current && current.id !== previousSinger) {
    if (!reducedMotion()) {
      element('current').animate([
        { opacity: 0, transform: 'translateY(12px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ], { duration: 650, easing: 'ease-out' });
      element('projector-song-title').animate([
        { opacity: 0, transform: 'translateX(-20px)' },
        { opacity: 1, transform: 'translateX(0)' },
      ], { duration: 700, easing: 'ease-out' });
      element('current-song').animate([{ opacity: 0 }, { opacity: 1 }], { duration: 900 });
    }
    celebrate();
  }
  if (event.results !== null && !resultsVisible) celebrate();
  previousSinger = current?.id;
  resultsVisible = event.results !== null;

  const waiting = event.performances.filter(person => person.status === 'waiting');
  element('queue-caption').textContent = waiting.length
    ? `${waiting.length} ${waiting.length === 1 ? 'performance' : 'performances'} in the wings`
    : 'The next spot could be yours.';
  // Restore the structured rows after the shared page refresh renders its plain list.
  const snapshot = JSON.stringify(waiting);
  const list = element('queue');
  const changed = snapshot !== queueSnapshot;
  if (!changed) return;
  const nextChanged = waiting[0]?.id !== previousNextId;
  previousNextId = waiting[0]?.id;
  queueSnapshot = snapshot;
  list.replaceChildren();
  for (const [index, person] of waiting.entries()) {
    const row = document.createElement('li');
    const number = document.createElement('span');
    number.className = 'queue-number';
    number.textContent = String(index + 1).padStart(2, '0');
    number.setAttribute('aria-hidden', 'true');
    const details = document.createElement('div');
    const singer = document.createElement('strong');
    singer.textContent = person.singer;
    const song = document.createElement('p');
    song.textContent = person.song;
    details.append(singer, song);
    const cover = document.createElement('span');
    cover.className = 'queue-cover';
    cover.textContent = '\u266b';
    if (person.artwork) {
      const image = document.createElement('img');
      image.src = person.artwork;
      image.alt = 'Album cover for ' + (person.album || person.song);
      image.width = 64;
      image.height = 64;
      image.loading = 'lazy';
      image.onerror = () => { image.hidden = true; };
      cover.append(image);
    } else {
      cover.setAttribute('aria-label', 'No album artwork');
    }
    row.append(number, cover, details);
    if (index === 0) {
      const badge = document.createElement('span');
      badge.className = 'queue-badge';
      badge.textContent = 'NEXT';
      row.append(badge);
    }
    list.append(row);
  }
  if (changed && waiting.length && !reducedMotion()) {
    list.animate([{ opacity: 0.4, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 450, easing: 'ease-out' });
    if (nextChanged) {
      list.firstElementChild?.animate([
        { backgroundColor: '#e879a6', transform: 'translateX(-12px)' },
        { backgroundColor: '#f7e5ed', transform: 'translateX(0)' },
      ], { duration: 1200, easing: 'ease-out' });
    }
  }
}
