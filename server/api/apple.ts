import { appleUrl, musicUrl } from '../logic/validation.js';

type AppleSearchResponse = {
  results: {
    trackName: string;
    artistName: string;
    collectionName?: string;
    artworkUrl100?: string;
    trackViewUrl?: string;
  }[];
};

const cache = new Map<string, { expires: number; songs: object[] }>();

export async function searchSongs(query: string) {
  const term = query.trim().toLowerCase();
  const cached = cache.get(term);
  if (cached && cached.expires > Date.now()) {
    return cached.songs;
  }

  const url = new URL('https://itunes.apple.com/search');
  url.searchParams.set('term', term);
  url.searchParams.set('entity', 'song');
  url.searchParams.set('limit', '8');
  url.searchParams.set('country', process.env.MUSIC_COUNTRY || 'EE');

  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) {
    throw new Error('Apple search is unavailable.');
  }
  const data = await response.json() as AppleSearchResponse;
  const songs = [];
  for (const track of data.results) {
    songs.push({
      song: track.trackName,
      artists: track.artistName,
      album: track.collectionName || '',
      artwork: appleUrl(track.artworkUrl100, 'mzstatic.com'),
      music_url: musicUrl(track.trackViewUrl),
    });
  }

  if (cache.size >= 100) {
    cache.clear();
  }
  cache.set(term, { expires: Date.now() + 300000, songs });
  return songs;
}
