export type SongDetails = {
  song: string;
  artists: string;
  album: string;
  artwork: string;
  music_url: string;
};

export function showSong(container: HTMLElement, song: SongDetails) {
  if (song.artwork) {
    const image = document.createElement('img');
    image.src = song.artwork;
    image.alt = 'Album cover for ' + song.album;
    image.width = 100;
    image.height = 100;
    image.loading = 'lazy';
    container.append(image);
  }
  const details = document.createElement('p');
  details.textContent = song.song;
  if (song.artists) {
    details.textContent += ' - ' + song.artists;
  }
  if (song.album) {
    details.textContent += ' - Album: ' + song.album;
  }
  container.append(details);

  if (song.music_url) {
    const link = document.createElement('a');
    link.href = song.music_url;
    link.textContent = 'Open in Apple Music / iTunes';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    container.append(link);
  }
}
