import QRCode from 'qrcode';
import './animated-gradient';
import { showSong, type SongDetails } from './music';
import { renderProjector } from './projector';
import { toast } from './toast';
import type { Certificate } from './finale';

type Performance = SongDetails & {
  id: number;
  singer: string;
  song: string;
  status: string;
};
type Result = Performance & { votes: number };
type EventData = {
  phase: string;
  performances: Performance[];
  results: Result[] | null;
  certificates?: Certificate[] | null;
};

function element(id: string) {
  return document.getElementById(id)!;
}

const view = new URLSearchParams(location.search).get('view');
const voteButton = element('vote') as HTMLButtonElement;
const joinForm = element('join') as HTMLFormElement;
const songInput = element('song-search') as HTMLInputElement;
let selectedSong: SongDetails | null = null;
let searchTimer: ReturnType<typeof setTimeout>;
let searchVersion = 0;
let currentId: number | undefined;
let currentSongSnapshot = '';
let singerNamesSnapshot = '';
let joining = false;
let voting = false;
let eventPhase = '';
const votedPerformances = new Set<number>();

function updateVoteButton() {
  voteButton.disabled = voting || currentId === undefined || eventPhase !== 'open' || votedPerformances.has(currentId);
  voteButton.textContent = currentId !== undefined && votedPerformances.has(currentId) ? 'Vote counted' : 'Vote for this singer';
}

if (view === 'projector') {
  document.body.classList.add('projector-view');
  element('projector').hidden = false;
} else {
  document.body.classList.add('audience-view');
  element('audience').hidden = false;
}

// textcontent stops names and songs from becoming html
function showList(id: string, lines: string[]) {
  const list = element(id);
  list.replaceChildren();
  for (const line of lines) {
    const item = document.createElement('li');
    item.textContent = line;
    list.append(item);
  }
}

async function refresh() {
  const response = await fetch('api/event');
  if (!response.ok) {
    throw new Error('Cannot load the event.');
  }
  const event: EventData = await response.json();
  renderEvent(event);
}

function renderEvent(event: EventData) {
  eventPhase = event.phase;
  if (!event.performances.length) votedPerformances.clear();
  const names = [...new Set(event.performances.flatMap(person => person.singer.split(' & ').map(name => name.trim())).filter(Boolean))]
    .sort((first, second) => first.localeCompare(second));
  const namesSnapshot = JSON.stringify(names);
  if (namesSnapshot !== singerNamesSnapshot) {
    singerNamesSnapshot = namesSnapshot;
    const suggestions = element('singer-names');
    suggestions.replaceChildren(...names.map(name => {
      const option = document.createElement('option');
      option.value = name;
      return option;
    }));
  }
  currentId = undefined;
  element('current').textContent = 'Nobody is singing yet.';
  const current = event.performances.find(person => person.status === 'singing');
  const snapshot = JSON.stringify(current);
  if (snapshot !== currentSongSnapshot) {
    currentSongSnapshot = snapshot;
    element('current-song').replaceChildren();
    if (current) showSong(element('current-song'), current);
  }
  for (const person of event.performances) {
    if (person.status === 'singing') {
      currentId = person.id;
      element('current').textContent = person.singer + ': ' + person.song;
    }
  }
  updateVoteButton();
  joinForm.hidden = event.phase !== 'open';

  element('results-section').hidden = event.results === null;
  element('result-message').textContent = 'Results will be revealed at the end.';
  const results = [];
  if (event.results !== null) {
    element('result-message').textContent = 'Final results';
    for (let index = 0; index < event.results.length; index++) {
      const person = event.results[index];
      const line = person.singer + ': ' + person.song + ' - ' + person.votes + ' votes';
      results.push(line);
    }
  }
  showList('results', results);
  renderProjector(event);
}

function showError(error: unknown) {
  let message = 'Cannot reach the server.';
  if (error instanceof Error) {
    message = error.message;
  }
  toast(message, 'error');
}

async function send(path: string, data: object) {
  try {
    const response = await fetch('api/' + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error);
    }
    toast(path === 'vote' ? 'Vote counted! Thanks for cheering them on.' : 'You’re in the queue! Watch Up next for your turn.');
    await refresh().catch(showError);
    return true;
  } catch (error) {
    showError(error);
    return false;
  }
}

joinForm.onsubmit = async (event) => {
  event.preventDefault();
  if (joining) return;
  const data = new FormData(joinForm);
  const singer = String(data.get('singer') ?? '').trim();
  const partner = String(data.get('duet_partner') ?? '').trim();
  const names = partner ? singer + ' & ' + partner : singer;
  if (!singer) {
    toast('Enter your name to join the queue.', 'error');
    (joinForm.elements.namedItem('singer') as HTMLInputElement).focus();
    return;
  }
  if (names.length > 200) {
    toast('Keep your name and duet partner’s name within 200 characters combined.', 'error');
    return;
  }
  joining = true;
  const submit = element('join-submit') as HTMLButtonElement;
  submit.disabled = true;
  const saved = await send('queue', {
    singer: names,
    song: data.get('song'),
    artists: selectedSong?.artists,
    album: selectedSong?.album,
    artwork: selectedSong?.artwork,
    music_url: selectedSong?.music_url,
  });
  if (saved) {
    joinForm.reset();
    clearSearch();
  }
  joining = false;
  submit.disabled = false;
};

function clearSearch() {
  clearTimeout(searchTimer);
  searchVersion++;
  selectedSong = null;
  element('selected-song').replaceChildren();
  element('song-suggestions').replaceChildren();
  element('search-message').textContent = '';
}

async function searchSongs(query: string, version: number) {
  try {
    const response = await fetch('api/music?q=' + encodeURIComponent(query));
    const songs = await response.json();
// ignore results from an older search
    if (version !== searchVersion) {
      return;
    }
    if (!response.ok) {
      throw new Error(songs.error);
    }
    const suggestions = element('song-suggestions');
    suggestions.replaceChildren();
    element('search-message').textContent = 'Choose a song below, or keep your manual entry.';
    if (songs.length === 0) {
      element('search-message').textContent = 'No songs found. You can type a song manually.';
    }
    for (const song of songs as SongDetails[]) {
      const row = document.createElement('li');
      const details = document.createElement('div');
      details.className = 'suggestion-song';
      showSong(details, song);
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = 'Choose';
      button.setAttribute('aria-label', 'Choose ' + song.song + ' by ' + song.artists);
      button.onclick = () => {
        clearSearch();
        selectedSong = song;
        songInput.value = song.song;
        showSong(element('selected-song'), song);
        toast('Selected: ' + song.song);
      };
      row.append(details, button);
      suggestions.append(row);
    }
  } catch {
    if (version === searchVersion) {
      element('search-message').textContent = 'Search unavailable. Type a song manually.';
    }
  }
}

songInput.oninput = () => {
  clearSearch();
  const query = songInput.value.trim();
  if (query.length < 2) {
    return;
  }
  const version = searchVersion;
  element('search-message').textContent = 'Searching...';
// wait for typing to stop before searching
  searchTimer = setTimeout(() => { void searchSongs(query, version); }, 800);
};

voteButton.onclick = async () => {
  if (voting || currentId === undefined || votedPerformances.has(currentId)) return;
  const performanceId = currentId;
  voting = true;
  updateVoteButton();
  if (await send('vote', { id: performanceId })) votedPerformances.add(performanceId);
  voting = false;
  updateVoteButton();
};

if (view === 'projector') {
  const url = new URL('https://kafeshka.cc/karaoke-ituk');

  const link = element('join-link') as HTMLAnchorElement;
  link.href = url.href;
  link.textContent = url.href;

  QRCode.toCanvas(element('qr'), url.href, { width: 144, margin: 2 }).then(() => {
    // Let the stylesheet control the displayed size at each breakpoint.
    element('qr').style.removeProperty('width');
    element('qr').style.removeProperty('height');
  }).catch(() => {
    toast('Could not create the QR code.', 'error');
  });
}

function update() {
  refresh().catch(showError);
}
update();
let streamConnected = false;
const stream = new EventSource('api/event/stream');
stream.onopen = () => { streamConnected = true; };
stream.onerror = () => { streamConnected = false; };
stream.onmessage = message => {
  try { renderEvent(JSON.parse(message.data)); } catch (error) { showError(error); }
};
setInterval(() => { if (!streamConnected) update(); }, 3000);
