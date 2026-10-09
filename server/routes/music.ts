import { Router } from 'express';
import { searchSongs } from '../api/apple.js';

export const musicRoutes = Router();

musicRoutes.get('/music', async (req, res) => {
  const query = req.query.q;
  if (typeof query !== 'string' || query.trim().length < 2 || query.length > 200) {
    res.status(400).json({ error: 'Enter 2 to 200 characters to search.' });
    return;
  }

  try {
    const songs = await searchSongs(query);
    res.json(songs);
  } catch {
    res.status(502).json({ error: 'Song search is unavailable. You can still type a song manually.' });
  }
});
