import { showSong, type SongDetails } from './music';

type HostPerformance = SongDetails & {
  id: number;
  singer: string;
  song: string;
  status: string;
  votes: number;
};

function element(id: string) {
  return document.getElementById(id)!;
}

const passwordInput = element('password') as HTMLInputElement;
const editForm = element('edit') as HTMLFormElement;
const singerInput = element('singer') as HTMLInputElement;
const songInput = element('song') as HTMLInputElement;
let password = '';
let editingId = 0;

// refreshing the page clears the password
async function request(path: string, data?: object) {
  let method = 'GET';
  if (data !== undefined) {
    method = 'POST';
  }

  const response = await fetch(`api/admin/${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${password}`,
    },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (response.status === 401) {
    logout();
  }
  if (!response.ok) {
    throw new Error(result.error);
  }
  return result;
}

function showError(error: unknown) {
  let message = 'Cannot reach the server.';
  if (error instanceof Error) {
    message = error.message;
  }
  element('message').textContent = message;
}

function addButton(row: HTMLElement, label: string, action: () => void) {
  const button = document.createElement('button');
  button.textContent = label;
  button.onclick = action;
  row.append(' ', button);
}

async function refresh() {
  const event = await request('event');
  element('controls').hidden = false;
  element('login').hidden = true;
  element('phase').textContent = event.phase;
  (element('next') as HTMLButtonElement).disabled = event.phase !== 'open';
  (element('close') as HTMLButtonElement).disabled = event.phase !== 'open';
  (element('reveal') as HTMLButtonElement).disabled = event.phase !== 'closed';
  (element('reopen') as HTMLButtonElement).disabled = event.phase === 'open';

  const list = element('performances');
  list.replaceChildren();
  for (const person of event.performances as HostPerformance[]) {
    const row = document.createElement('li');
    row.textContent = `${person.singer}: ${person.song} (${person.status}, ${person.votes} votes)`;
    showSong(row, person);
    const path = `performance/${person.id}/`;

    addButton(row, 'Edit', () => {
      editingId = person.id;
      singerInput.value = person.singer;
      songInput.value = person.song;
      editForm.hidden = false;
      singerInput.focus();
    });
    if (person.status === 'waiting') {
      addButton(row, 'Up', () => { void send(path + 'up'); });
      addButton(row, 'Down', () => { void send(path + 'down'); });
      if (event.phase === 'open') {
        addButton(row, 'Start now', () => { void send(path + 'start'); });
      }
    }
    if (person.status === 'waiting' || person.status === 'singing') {
      addButton(row, 'Skip', () => { void send(path + 'skip'); });
    }
    if (person.status === 'skipped') {
      addButton(row, 'Return to queue', () => { void send(path + 'restore'); });
    }
    addButton(row, 'Delete', () => {
      if (confirm(`Delete ${person.singer}'s performance and votes?`)) {
        void send(path + 'delete');
      }
    });
    list.append(row);
  }
}

async function send(path: string, data = {}) {
  try {
    await request(path, data);
    element('message').textContent = 'Saved.';
    await refresh();
    return true;
  } catch (error) {
    showError(error);
    return false;
  }
}

(element('login') as HTMLFormElement).onsubmit = async (event) => {
  event.preventDefault();
  password = passwordInput.value;
  passwordInput.value = '';
  try {
    await refresh();
    element('message').textContent = 'Logged in.';
  } catch (error) {
    showError(error);
  }
};

function logout() {
  password = '';
  editingId = 0;
  editForm.hidden = true;
  element('controls').hidden = true;
  element('performances').replaceChildren();
  element('login').hidden = false;
}
element('logout').onclick = logout;

editForm.onsubmit = async (event) => {
  event.preventDefault();
  const saved = await send(`performance/${editingId}/edit`, {
    singer: singerInput.value,
    song: songInput.value,
  });
  if (saved) {
    editForm.hidden = true;
  }
};
element('cancel').onclick = () => { editForm.hidden = true; };

for (const action of ['next', 'close', 'reopen', 'reveal']) {
  element(action).onclick = () => { void send(action); };
}
element('reset').onclick = () => {
  const confirmation = prompt('Type RESET to delete all performances and votes.');
  if (confirmation === 'RESET') {
    editForm.hidden = true;
    void send('reset', { confirmation });
  }
};

setInterval(() => {
  if (password) {
    refresh().catch(showError);
  }
}, 3000);
