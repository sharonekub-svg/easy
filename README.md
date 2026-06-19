# EZ — Describe it. Play it.

EZ is an AI game builder: describe a game in one sentence and it builds a real,
playable game and runs it live in your browser. This repo is the marketing +
product front-end, implemented from the Claude Design handoff.

## What's here

A self-contained static site — no build step. Open `index.html` or serve the
folder with any static server.

- `index.html` — markup for the three screens
- `styles.css` — palette, layout, animations
- `app.js` — screen routing, chat simulation, credit meter, game registry
- `car3d.js` — **Apex Drift** (3D neon racer)
- `hideout3d.js` + `game/` — **Meccha Chameleon**, a polished 3D camouflage
  hide & seek (see below)

## Meccha Chameleon (`game/`)

A near-commercial-quality WebGL hide & seek: morph your colour to match the
scene and stay still to vanish from the hunter. Built as clean ES modules:

- `game/engine.js` — renderer + post FX (SSAO, bloom, colour-grade, SMAA, ACES)
- `game/input.js` — keyboard, mouse-orbit, gamepad and touch (virtual stick)
- `game/audio.js` — fully synthesised music + SFX (no asset downloads)
- `game/chameleon.js` — rounded avatar, smooth colour-morph, pose squash/stretch
- `game/maps.js` — swappable maps (The Mansion, Sunset Garden)
- `game/entities.js` — shared world physics/LOS + hunter & hider AI + manager
- `game/fx.js` — paint-splash, poof, dust, noise rings, camera shake
- `game/ui.js` — menus, HUD, HSV colour wheel, mini-map, mobile controls
- `game/game.js` — the MENU → HIDE → HUNT → RESULTS state machine

Modes: Classic, Infection, Double. Runs at 60fps with adjustable quality.

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
