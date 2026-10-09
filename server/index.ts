import express, { type ErrorRequestHandler } from 'express';
import { eventRoutes } from './routes/event.js';
import { musicRoutes } from './routes/music.js';
import { adminRoutes } from './routes/admin.js';
import { EventError } from './logic/event.js';

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(express.json());
app.use('/api', eventRoutes);
app.use('/api', musicRoutes);
app.use('/api/admin', adminRoutes);

const handleError: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof EventError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  if (error instanceof SyntaxError) {
    res.status(400).json({ error: 'Invalid JSON request.' });
    return;
  }
  console.error(error);
  res.status(500).json({ error: 'Something went wrong on the server.' });
};
app.use(handleError);

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Route not found.' });
});
app.use(express.static('dist/client'));
app.use((_req, res) => {
  res.status(404).send('Page not found.');
});
app.listen(port, '0.0.0.0', () => {
  console.log(`Karaoke server: http://localhost:${port}`);
});
