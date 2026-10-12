type ToastKind = 'success' | 'error';
const region = document.createElement('div');
region.className = 'toast-region';
region.setAttribute('aria-label', 'Notifications');
document.body.append(region);
let lastError = '';
let lastErrorTime = 0;

export function toast(message: string, kind: ToastKind = 'success') {
  // Repeated background polling failures should not flood the screen.
  if (kind === 'error') {
    if (message === lastError && Date.now() - lastErrorTime < 15000) return;
    lastError = message;
    lastErrorTime = Date.now();
  }
  const notification = document.createElement('div');
  notification.className = `toast toast-${kind}`;
  const text = document.createElement('p');
  text.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  text.setAttribute('aria-atomic', 'true');
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = '×';
  close.setAttribute('aria-label', 'Dismiss notification');
  notification.append(text, close);
  region.append(notification);
  requestAnimationFrame(() => { text.textContent = message; });

  let timer: ReturnType<typeof setTimeout>;
  function dismiss() {
    clearTimeout(timer);
    notification.remove();
  }
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(dismiss, kind === 'error' ? 8000 : 5000);
  }
  close.onclick = dismiss;
  notification.onmouseenter = () => clearTimeout(timer);
  notification.onmouseleave = schedule;
  notification.addEventListener('focusin', () => clearTimeout(timer));
  notification.addEventListener('focusout', schedule);
  schedule();
  if (region.children.length > 3) {
    (region.firstElementChild?.querySelector('button') as HTMLButtonElement)?.click();
  }
}
