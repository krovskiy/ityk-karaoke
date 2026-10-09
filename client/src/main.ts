import QRCode from 'qrcode';
import { showSong, type SongDetails } from './music';

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

if (view === 'projector') {
  element('projector').hidden = false;
} else {
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

  currentId = undefined;
  element('current').textContent = 'Nobody is singing yet.';
  element('current-song').replaceChildren();
  const queue = [];
  for (const person of event.performances) {
    if (person.status === 'singing') {
      currentId = person.id;
      element('current').textContent = person.singer + ': ' + person.song;
      showSong(element('current-song'), person);
    }
    if (person.status === 'waiting') {
      queue.push(person.singer + ': ' + person.song);
    }
  }
  showList('queue', queue);
  voteButton.disabled = currentId === undefined || event.phase !== 'open';
  joinForm.hidden = event.phase !== 'open';

  element('results-section').hidden = event.results === null;
  element('result-message').textContent = 'Results will be revealed at the end.';
  const results = [];
  const prizes = [150, 100, 50];
  if (event.results !== null) {
    element('result-message').textContent = 'Final results';
    for (let index = 0; index < event.results.length; index++) {
      const person = event.results[index];
      let line = person.singer + ': ' + person.song + ' - ' + person.votes + ' votes';
      if (index < 3) {
        line += ' - ' + prizes[index] + ' minion points';
      }
      results.push(line);
    }
  }
  showList('results', results);
}

function showError(error: unknown) {
  let message = 'Cannot reach the server.';
  if (error instanceof Error) {
    message = error.message;
  }
  element('message').textContent = message;
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
    element('message').textContent = 'Done.';
    await refresh();
    return true;
  } catch (error) {
    showError(error);
    return false;
  }
}

joinForm.onsubmit = async (event) => {
  event.preventDefault();
  const data = new FormData(joinForm);
  const saved = await send('queue', {
    singer: data.get('singer'),
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
      showSong(row, song);
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = 'Choose ' + song.song;
      button.onclick = () => {
        clearSearch();
        selectedSong = song;
        songInput.value = song.song;
        showSong(element('selected-song'), song);
      };
      row.append(' ', button);
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
  voteButton.disabled = true;
  await send('vote', { id: currentId });
};

if (view === 'projector') {
  const url = new URL(import.meta.env.VITE_PUBLIC_URL || location.href);
  url.search = '';
  url.hash = '';

  const link = element('join-link') as HTMLAnchorElement;
  link.href = url.href;
  link.textContent = url.href;

  QRCode.toCanvas(element('qr'), url.href).catch(() => {
    element('message').textContent = 'Could not create the QR code.';
  });
}

function update() {
  refresh().catch(showError);
}
update();
setInterval(update, 3000);
