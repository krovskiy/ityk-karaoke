import type { SongDetails } from './music';
import './animated-gradient';
import { toast } from './toast';
import { certificateCategories, type Certificate } from './finale';

type HostPerformance = SongDetails & { id: number; singer: string; song: string; status: string; votes: number };
type HostEvent = { phase: string; performances: HostPerformance[]; certificates?: Certificate[] };
const element = (id: string) => document.getElementById(id)!;
const button = (id: string) => element(id) as HTMLButtonElement;
const passwordInput = element('password') as HTMLInputElement;
const editForm = element('edit') as HTMLFormElement;
const editDialog = element('edit-dialog') as HTMLDialogElement;
const singerInput = element('singer') as HTMLInputElement;
const songInput = element('song') as HTMLInputElement;
let password = '';
let editingId = 0;
let busy = false;
let refreshing = false;
let eventData: HostEvent | undefined;
let filter = 'all';
let renderedSnapshot = '';
let previousStageId: number | undefined;

for (const category of certificateCategories) {
  const label = document.createElement('label');
  label.className = 'field';
  label.textContent = category.label;
  const select = document.createElement('select');
  select.dataset.category = category.key;
  select.onchange = () => { void send('certificate', { category: category.key, performance_id: select.value ? Number(select.value) : null }); };
  label.append(select);
  element('certificate-controls').append(label);
}

async function request(path: string, data?: object) {
  const sessionPassword = password;
  const response = await fetch(`api/admin/${path}`, {
    method: data === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionPassword}` },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  const result = await response.json();
  if (password !== sessionPassword) throw new Error('Your host session changed. Log in again.');
  if (response.status === 401) logout();
  if (!response.ok) throw new Error(result.error);
  return result;
}

function showError(error: unknown) {
  element('host-connection').textContent = 'Connection interrupted. Check your connection; the desk will retry automatically.';
  toast(error instanceof Error ? error.message : 'Cannot reach the server.', 'error');
}

function textNode(tag: string, text: string, className = '') {
  const node = document.createElement(tag);
  node.textContent = text;
  node.className = className;
  return node;
}

function addButton(row: HTMLElement, label: string, action: () => void, disabled = false, className = '') {
  const control = document.createElement('button');
  control.type = 'button';
  control.textContent = label;
  control.disabled = disabled || busy;
  control.className = className;
  control.onclick = action;
  row.append(control);
}

function render() {
  if (!eventData) return;
  const { phase, performances } = eventData;
  const current = performances.find(person => person.status === 'singing');
  const waiting = performances.filter(person => person.status === 'waiting');
  const done = performances.filter(person => person.status === 'done');
  const open = phase === 'open';
  element('host-instruction').textContent = open
    ? (current ? 'Advance when the singer finishes.' : waiting.length ? 'Ready to start the next singer.' : 'Waiting for signups.')
    : phase === 'closed' ? 'Choose certificates, then show awards.' : 'Open the projector to reveal the envelopes.';
  const certificateSnapshot = JSON.stringify({ done, certificates: eventData.certificates });
  document.querySelectorAll<HTMLSelectElement>('[data-category]').forEach(select => {
    select.disabled = busy || !done.length;
    if (select.dataset.snapshot === certificateSnapshot) return;
    select.dataset.snapshot = certificateSnapshot;
    select.replaceChildren(new Option(done.length ? 'No winner selected' : 'Finish a performance first', ''));
    for (const person of done) select.add(new Option(`${person.singer} — ${person.song}`, String(person.id)));
    select.value = String(eventData?.certificates?.find(item => item.category === select.dataset.category)?.id ?? '');
  });
  element('phase').textContent = open ? 'Live' : phase === 'closed' ? 'Voting closed' : 'Results published';
  document.querySelectorAll('.host-steps li').forEach((step, index) => {
    step.classList.toggle('is-current', index === (open ? 0 : phase === 'closed' ? 1 : 2));
  });
  button('next').textContent = current ? (waiting.length ? 'Finish & start next' : 'Finish performance') : 'Start next singer';
  button('next').disabled = busy || !open || (!current && !waiting.length);
  button('close').disabled = busy || !open;
  button('reveal').disabled = busy || phase !== 'closed';
  button('reopen').disabled = busy || open;
  element('close').closest('.host-action-block')!.classList.toggle('is-unavailable', !open);
  element('reveal').closest('.host-action-block')!.classList.toggle('is-unavailable', phase !== 'closed');
  element('reopen').closest('.host-action-block')!.classList.toggle('is-unavailable', open);
  button('reset').disabled = busy;
  element('next-help').textContent = !open ? 'Reopen the event to continue.' : current ? (waiting.length ? 'Finishes this performance and starts the next singer.' : 'Finishes this performance. Nobody else is waiting.') : waiting.length ? 'Starts the next singer and opens voting.' : 'Share the projector QR code to collect signups.';
  element('host-next-preview').textContent = waiting.length ? `Next: ${waiting[0].singer} — ${waiting[0].song}` : 'Next: nobody is waiting yet.';
  element('host-counts').textContent = `${waiting.length} waiting / ${done.length} finished`;

  // Keep buttons and keyboard focus stable during routine polling.
  const snapshot = JSON.stringify({ phase, performances, filter, busy });
  if (snapshot === renderedSnapshot) return;
  renderedSnapshot = snapshot;
  const stage = element('host-current');
  stage.replaceChildren();
  if (current) {
    stage.append(textNode('strong', current.singer), textNode('p', current.song), textNode('span', `${current.votes} votes · visible only to you`, 'host-hint'));
  } else {
    stage.append(textNode('strong', 'Stage empty'));
  }
  if (current?.id !== previousStageId && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    stage.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 500, easing: 'ease-out' });
    element('host-next-preview').animate([{ background: '#e879a6' }, { background: 'transparent' }], { duration: 1200 });
  }
  previousStageId = current?.id;
  const list = element('performances');
  list.replaceChildren();
  const visible = performances.filter(person => filter === 'all' || person.status === (filter === 'finished' ? 'done' : filter));
  const ordered = [...visible].sort((a, b) => Number(b.status === 'singing') - Number(a.status === 'singing'));
  element('host-empty').hidden = visible.length > 0;
  element('host-empty').textContent = performances.length ? 'No performances in this category.' : 'No signups yet. Open the projector and ask guests to scan the QR code.';
  const statusLabels: Record<string, string> = { singing: 'ON STAGE', waiting: 'WAITING', done: 'FINISHED', skipped: 'SKIPPED' };
  for (const person of ordered) {
    const row = document.createElement('li');
    row.className = `host-performance status-${person.status}`;
    const info = document.createElement('div');
    info.className = 'host-performance-info';
    if (person.artwork) {
      const cover = document.createElement('img');
      cover.src = person.artwork;
      cover.alt = 'Album cover for ' + (person.album || person.song);
      cover.width = 56;
      cover.height = 56;
      cover.loading = 'lazy';
      cover.onerror = () => { cover.hidden = true; };
      info.append(cover);
    }
    const details = document.createElement('div');
    const position = waiting.findIndex(entry => entry.id === person.id);
    details.append(textNode('span', statusLabels[person.status] + (position >= 0 ? ` · #${position + 1}` : ''), 'host-status'), textNode('strong', person.singer), textNode('p', person.song));
    info.append(details, textNode('span', `${person.votes} ${person.votes === 1 ? 'vote' : 'votes'}`, 'host-votes'));
    const actions = document.createElement('div');
    actions.className = 'actions host-row-actions';
    const path = `performance/${person.id}/`;
    addButton(actions, 'Edit', () => {
      editingId = person.id;
      singerInput.value = person.singer;
      songInput.value = person.song;
      editDialog.showModal();
      singerInput.focus();
    });
    if (person.status === 'waiting') {
      addButton(actions, 'Move earlier', () => { void send(path + 'up'); }, position === 0 || !open);
      addButton(actions, 'Move later', () => { void send(path + 'down'); }, position === waiting.length - 1 || !open);
      if (open) addButton(actions, 'Start now', () => {
        if ((!current && position === 0) || confirm(`Start ${person.singer} now?${current ? ` This finishes ${current.singer}'s current performance.` : ' This changes the usual queue order.'}`)) void send(path + 'start');
      }, false, 'host-primary');
    }
    if (person.status === 'waiting' || person.status === 'singing') {
      addButton(actions, person.status === 'singing' ? 'Stop & mark skipped' : 'Skip for now', () => {
        if (person.status !== 'singing' || confirm(`Stop ${person.singer}'s performance and mark it skipped? You can return them to the queue later.`)) void send(path + 'skip');
      });
    }
    if (person.status === 'skipped') addButton(actions, 'Return to waiting queue', () => { void send(path + 'restore'); });
    addButton(actions, 'Delete', () => {
      if (confirm(`Permanently delete ${person.singer}'s performance and all its votes?`)) void send(path + 'delete');
    }, false, 'host-danger');
    row.append(info, actions);
    list.append(row);
  }
}

async function refresh() {
  const data: HostEvent = await request('event');
  element('host-connection').textContent = '● Live updates';
  eventData = data;
  element('controls').hidden = false;
  element('login').hidden = true;
  render();
}

async function send(path: string, data = {}) {
  if (busy) return false;
  busy = true;
  element('controls').setAttribute('aria-busy', 'true');
  render();
  editForm.querySelectorAll('button').forEach(control => { control.disabled = true; });
  try {
    await request(path, data);
    const action = path.split('/').at(-1)!;
    const messages: Record<string, string> = {
      next: eventData?.performances.some(person => person.status === 'waiting') ? 'Next singer started.' : 'Performance finished.',
      close: 'Voting and signups closed. Results are still hidden.', reopen: 'Voting and signups reopened. Results hidden.',
      reveal: 'Final results are now public!', reset: 'New event ready. All previous performances and votes cleared.',
      edit: 'Name and song saved.', up: 'Moved earlier in the queue.', down: 'Moved later in the queue.',
      start: 'Singer started. Voting is open for them.', skip: 'Skipped for now. You can return them to the queue.',
      restore: 'Returned to the waiting queue.', delete: 'Performance and its votes deleted.',
      certificate: 'Certificate winner saved.',
    };
    toast(messages[action] ?? 'Changes saved.');
    await refresh().catch(showError);
    return true;
  } catch (error) {
    showError(error);
    return false;
  } finally {
    busy = false;
    document.querySelectorAll<HTMLSelectElement>('[data-category]').forEach(select => { delete select.dataset.snapshot; });
    element('controls').removeAttribute('aria-busy');
    editForm.querySelectorAll('button').forEach(control => { control.disabled = false; });
    render();
  }
}

(element('login') as HTMLFormElement).onsubmit = async event => {
  event.preventDefault();
  const submit = element('login').querySelector('button')!;
  submit.disabled = true;
  password = passwordInput.value;
  passwordInput.value = '';
  try { await refresh(); toast('Host desk ready. Start the first singer when you are ready.'); }
  catch (error) { showError(error); passwordInput.focus(); }
  finally { submit.disabled = false; }
};

function logout() {
  password = '';
  editingId = 0;
  eventData = undefined;
  renderedSnapshot = '';
  previousStageId = undefined;
  editDialog.close();
  element('controls').hidden = true;
  element('performances').replaceChildren();
  element('login').hidden = false;
}
element('logout').onclick = () => { logout(); toast('Logged out.'); };
editForm.onsubmit = async event => {
  event.preventDefault();
  if (await send(`performance/${editingId}/edit`, { singer: singerInput.value, song: songInput.value })) editDialog.close();
};
element('cancel').onclick = () => editDialog.close();
element('next').onclick = () => { void send('next'); };
element('close').onclick = () => {
  if (confirm('Close voting and signups? This finishes the current singer. Results remain hidden until you choose to show them.')) void send('close');
};
for (const action of ['reopen', 'reveal']) element(action).onclick = () => { void send(action); };
element('reset').onclick = () => {
  const confirmation = prompt('This permanently deletes ALL performances and votes. Type RESET to start a new event.');
  if (confirmation === 'RESET') { editDialog.close(); void send('reset', { confirmation }); }
};
document.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach(control => {
  control.onclick = () => {
    filter = control.dataset.filter!;
    document.querySelectorAll('[data-filter]').forEach(item => item.setAttribute('aria-pressed', String((item as HTMLElement).dataset.filter === filter)));
    render();
  };
});
setInterval(async () => {
  if (!password || busy || refreshing) return;
  refreshing = true;
  try { await refresh(); } catch (error) { showError(error); }
  finally { refreshing = false; }
}, 1000);
