# EZ — Describe it. Play it.

EZ is an AI game builder: describe a game in one sentence and it builds a real,
playable game and runs it live in your browser. This repo is the marketing +
product front-end, implemented from the Claude Design handoff.

## What's here

A self-contained static site — no build step. Open `index.html` or serve the
folder with any static server.

- `index.html` — markup for the three screens
- `styles.css` — palette, layout, animations
- `app.js` — screen routing, chat simulation, credit meter, and the playable
  **Neon Snake** canvas game

## Screens

- **Landing** — hero, "Describe your game…" input, example prompts
- **App** — split view: chat on the left, the live game on the right, with a
  persistent monthly-credits meter (warns at 80% used)
- **Gallery** — grid of games built with EZ, each with a one-click Remix

## Run locally

```
python3 -m http.server 8000
# open http://localhost:8000
```

## Palette

- `#000000` background · `#CB2957` brand accent · `#DDDDDD` / `#EEEEEE` text & surfaces
- Type: Martian Mono (display) + Space Grotesk (UI)
