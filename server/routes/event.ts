import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { getPublicEvent, joinQueue, vote } from '../logic/event.js';

export const eventRoutes = Router();

eventRoutes.get('/event', (_req, res) => {
  res.json(getPublicEvent());
});

eventRoutes.post('/queue', (req, res) => {
  joinQueue(req.body || {});
  res.json({ ok: true });
});

eventRoutes.post('/vote', (req, res) => {
// clearing this cookie allows another vote
  let voter = '';
  const cookies = (req.headers.cookie || '').split(';');
  for (const cookie of cookies) {
    if (cookie.trim().startsWith('voter=')) {
      voter = cookie.trim().slice(6);
    }
  }
  if (!voter) {
    voter = randomUUID();
    res.cookie('voter', voter, { httpOnly: true, sameSite: 'lax', maxAge: 86400000 });
  }
  vote(req.body?.id, voter);
  res.json({ ok: true });
});
