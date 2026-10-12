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
The host desk shows the next action, current singer, waiting order, and private vote counts.
Audience and projector pages receive live event updates, with polling as a fallback.

## Awards finale

1. Finish the performances and close voting from the host desk.
2. Choose finished performances for Best Costume, Best Stage Presence, Best Duet,
   and Most Unexpected Performance. Choices save immediately.
3. Click **Begin the big-screen awards finale**. Audience scores become public,
   and the projector switches to seven envelopes.
4. On the projector, click bronze, silver, then gold to reveal the top three.
   Each opens a full-screen winner spotlight.
   Gold also shows **ITÜK KARAOKE CHAMPION 2026**.
5. Open the certificate envelopes to celebrate the selected winners.

Categories without a selected winner, or prize places without an eligible performance,
remain unavailable. Envelope reveals are local to that projector tab and survive a refresh.
Reopening or resetting the event clears the projector's reveal state.

Song search uses Apple's iTunes API and needs no API key.
Queue entries and votes are saved automatically in `data/`.

## Commands

```sh
npm run dev     # development
npm run build   # production build
npm start       # production server on port 3000
npm run check   # lint, types, and build
npm test        # build and isolated event-flow regression checks
npm run audit   # dependency vulnerabilities
```

GitHub Actions runs the checks on pushes and pull requests.

## Folders

- `client/`: pages and browser code.
- `server/`: routes, event logic, database, and Apple API.
- `config/`: build settings.
- `dist/`: generated files; edit the source instead.
