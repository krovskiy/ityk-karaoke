import gold from '../assets/award-gold.svg';
import silver from '../assets/award-silver.svg';
import bronze from '../assets/award-bronze.svg';
import costume from '../assets/award-costume.svg';
import presence from '../assets/award-presence.svg';
import duet from '../assets/award-duet.svg';
import unexpected from '../assets/award-unexpected.svg';

export type Certificate = { category: string; id: number; singer: string; song: string };
type Result = { id: number; singer: string; song: string; votes: number };
export const certificateCategories = [
  { key: 'costume', label: 'Best Costume', icon: costume },
  { key: 'presence', label: 'Best Stage Presence', icon: presence },
  { key: 'duet', label: 'Best Duet', icon: duet },
  { key: 'unexpected', label: 'Most Unexpected Performance', icon: unexpected },
];
let snapshot = '';
let spotlight: HTMLElement | undefined;
let opened = new Set<string>();

function node(tag: string, text: string, className = '') {
  const item = document.createElement(tag);
  item.textContent = text;
  item.className = className;
  return item;
}

export function renderFinale(event: { results: Result[] | null; certificates?: Certificate[] | null }, celebrate: () => void) {
  if (!document.body.classList.contains('projector-view')) return;
  const active = event.results !== null;
  document.body.classList.toggle('finale-view', active);
  if (!active) {
    snapshot = '';
    opened.clear();
    spotlight?.remove();
    try { sessionStorage.removeItem('karaoke-envelopes'); } catch { /* Storage may be disabled. */ }
    document.getElementById('finale')?.remove();
    return;
  }
  const nextSnapshot = JSON.stringify(event);
  if (nextSnapshot === snapshot) return;
  snapshot = nextSnapshot;
  opened = new Set();
  try {
    const saved = JSON.parse(sessionStorage.getItem('karaoke-envelopes') || 'null');
    if (saved?.snapshot === snapshot) opened = new Set(saved.opened);
  } catch { /* Keep the reveal usable without browser storage. */ }
  document.getElementById('finale')?.remove();
  spotlight?.remove();
  const root = document.createElement('div');
  root.id = 'finale';
  root.append(node('p', 'ITÜK / KARAOKE NIGHT 2026', 'finale-eyebrow'), node('h1', 'And the winners are…', 'finale-title'), node('p', 'Click an envelope to reveal its winner. Start with bronze and save the champion for last.', 'finale-help'));
  const podium = document.createElement('div');
  podium.className = 'envelope-grid podium-envelopes';

  function envelope(key: string, label: string, icon: string, winner: { singer: string; song: string } | undefined, reward: string, champion = false) {
    const control = document.createElement('button');
    control.type = 'button';
    control.className = `award-envelope${champion ? ' champion-envelope' : ''}`;
    control.disabled = !winner;
    control.setAttribute('aria-expanded', String(opened.has(key)));
    const face = document.createElement('span');
    face.className = 'envelope-face';
    const image = document.createElement('img');
    image.src = icon;
    image.alt = '';
    image.width = 56;
    image.height = 56;
    face.append(image, node('span', label, 'envelope-label'));
    if (reward) face.append(node('span', reward, 'envelope-reward'));
    const letter = node('span', winner?.singer ?? 'No winner selected', 'envelope-letter');
    const hint = node('span', !winner ? 'No eligible winner yet' : opened.has(key) ? 'Click to celebrate again' : 'Click to open', 'envelope-hint');
    control.append(face, letter, hint);
    control.classList.toggle('is-open', opened.has(key));
    control.onclick = () => {
      if (!winner) return;
      opened.add(key);
      control.classList.add('is-open');
      control.setAttribute('aria-expanded', 'true');
      hint.textContent = 'Click to celebrate again';
      try { sessionStorage.setItem('karaoke-envelopes', JSON.stringify({ snapshot, opened: [...opened] })); } catch { /* Optional persistence. */ }
      spotlight?.remove();
      const dialog = document.createElement('dialog');
      dialog.className = 'winner-spotlight';
      dialog.setAttribute('aria-label', label + ' winner');
      const medal = image.cloneNode() as HTMLImageElement;
      dialog.append(medal, node('p', label, 'winner-category'), node('h2', winner.singer, 'winner-name'), node('p', winner.song, 'winner-song'));
      if (champion) dialog.append(node('p', 'ITÜK KARAOKE CHAMPION 2026', 'champion-title'));
      if (reward) dialog.append(node('p', reward, 'winner-reward'));
      const back = node('button', 'Back to the envelopes') as HTMLButtonElement;
      back.type = 'button';
      back.onclick = () => dialog.close();
      dialog.append(back);
      dialog.addEventListener('close', () => { dialog.remove(); control.focus(); });
      document.body.append(dialog);
      spotlight = dialog;
      dialog.showModal();
      celebrate();
    };
    return control;
  }
  for (const [rank, label, icon] of [
    [2, '3rd Place', bronze], [1, '2nd Place', silver], [0, '1st Place', gold],
  ] as const) podium.append(envelope(`place-${rank}`, label, icon, event.results?.[rank], '', rank === 0));
  root.append(podium, node('h2', 'Iconic performance certificates', 'certificates-title'), node('p', 'Special recognition for a well-earned spotlight.', 'finale-help'));
  const certificates = document.createElement('div');
  certificates.className = 'envelope-grid certificate-envelopes';
  for (const category of certificateCategories) {
    const winner = event.certificates?.find(item => item.category === category.key);
    certificates.append(envelope(category.key, category.label, category.icon, winner, 'Special certificate'));
  }
  root.append(certificates);
  document.getElementById('results-section')!.append(root);
}
