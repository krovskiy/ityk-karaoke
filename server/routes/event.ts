import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { getPublicEvent, joinQueue, vote } from '../logic/event.js';

export const eventRoutes = Router();

eventRoutes.get('/event/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  let previous = '';
  const push = () => {
    const snapshot = JSON.stringify(getPublicEvent());
    if (snapshot !== previous) {
      previous = snapshot;
      res.write(`data: ${snapshot}\n\n`);
    }
  };
  push();
  const changes = setInterval(push, 500);
  const heartbeat = setInterval(() => res.write(': keepalive\n\n'), 15000);
  req.on('close', () => { clearInterval(changes); clearInterval(heartbeat); });
});

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
