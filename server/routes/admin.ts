import { Router } from 'express';
import {
  getHostEvent, nextSinger, changePerformance,
  closeEvent, reopenEvent, revealResults, resetEvent,
} from '../logic/event.js';

const password = process.env.ADMIN_PASSWORD;
if (!password) {
  throw new Error('Set ADMIN_PASSWORD in .env first.');
}

export const adminRoutes = Router();

adminRoutes.use((req, res, next) => {
  if (req.headers.authorization !== `Bearer ${password}`) {
    res.status(401).json({ error: 'Wrong host password.' });
    return;
  }
  next();
});

adminRoutes.get('/event', (_req, res) => {
  res.json(getHostEvent());
});

adminRoutes.post('/next', (_req, res) => {
  nextSinger();
  res.json({ ok: true });
});

adminRoutes.post('/performance/:id/:action', (req, res) => {
  changePerformance(Number(req.params.id), req.params.action, req.body || {});
  res.json({ ok: true });
});

adminRoutes.post('/close', (_req, res) => {
  closeEvent();
  res.json({ ok: true });
});

adminRoutes.post('/reopen', (_req, res) => {
  reopenEvent();
  res.json({ ok: true });
});

adminRoutes.post('/reveal', (_req, res) => {
  revealResults();
  res.json({ ok: true });
});

adminRoutes.post('/reset', (req, res) => {
  resetEvent(req.body?.confirmation);
  res.json({ ok: true });
});
