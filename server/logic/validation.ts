export function validText(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }
  if (value.trim().length === 0) {
    return false;
  }
  if (value.length > 200) {
    return false;
  }
  return true;
}

export function optionalText(value: unknown) {
  if (typeof value === 'string' && value.length <= 500) {
    return value.trim();
  }
  return '';
}

export function appleUrl(value: unknown, domain: string) {
  try {
    const url = new URL(optionalText(value));
    if (url.protocol === 'https:' && (url.hostname === domain || url.hostname.endsWith('.' + domain))) {
      return url.href;
    }
  } catch {
// missing or invalid links become an empty string
  }
  return '';
}

export type SongMetadata = {
  artists?: unknown;
  album?: unknown;
  artwork?: unknown;
  music_url?: unknown;
};

export function musicUrl(value: unknown) {
  const link = appleUrl(value, 'music.apple.com');
  if (link) {
    return link;
  }
  return appleUrl(value, 'itunes.apple.com');
}
