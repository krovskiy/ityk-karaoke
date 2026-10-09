# ITYK Karaoke

## Setup

Requires Node.js 24 or newer.

1. Run `npm install`.
2. Copy `.env.example` to `.env`.
3. Set `ADMIN_PASSWORD` and `VITE_PUBLIC_URL` in `.env`.
4. Run `npm run dev`.

Open http://localhost:5173.

For the event QR code, use an address guests can reach instead of localhost.

## Pages

- `/`: join the queue and vote for the current singer.
- `/host.html`: manage the queue, close voting, and reveal results.
- `/?view=projector`: current singer, queue, and QR code.

Results stay hidden until the host reveals them.
Song search uses Apple's iTunes API and needs no API key.
Queue entries and votes are saved automatically in `data/`.

## Commands

```sh
npm run dev     # development
npm run build   # production build
npm start       # production server on port 3000
npm run check   # lint, types, and build
npm run audit   # dependency vulnerabilities
```

GitHub Actions runs the checks on pushes and pull requests.

## Folders

- `client/`: pages and browser code.
- `server/`: routes, event logic, database, and Apple API.
- `config/`: build settings.
- `dist/`: generated files; edit the source instead.
