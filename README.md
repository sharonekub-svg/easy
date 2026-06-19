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

- `game/engine.js` — renderer + post FX (SSAO, bloom, warm grade, film grain, SMAA, ACES)
- `game/textures.js` — procedural PBR textures (wood, marble, tile, carpet, wallpaper, grass)
- `game/input.js` — keyboard, mouse-orbit, gamepad and touch (virtual stick)
- `game/audio.js` — fully synthesised music + reverb + SFX (no asset downloads)
- `game/chameleon.js` — rounded avatar, smooth colour-morph, blink/tongue idles,
  pose + jump squash/stretch, movement lean
- `game/maps.js` — swappable maps. Andy's Room (the Toy Story bedroom: cloud
  wallpaper, Andy's bed, kids desk + office chair, bookshelf, window, lamps and
  the full cast as toys), The Mansion and Sunset Garden
- `game/toys.js` — procedural recreations of the Toy Story cast: Buzz, Woody,
  Jessie & Bullseye, Rex, Hamm, Slinky, Mr. Potato Head, Lenny, the Aliens,
  Lotso, RC and the Luxo Ball. Modelled after the object set in
  github.com/yasseraboelsaad/Toy-Story-room-simulation (Unity); its binary models
  can't load in a static web build, so each is rebuilt from primitives.
- `game/textures.js` — procedural textures incl. cloud wallpaper, play-mat, stripes
- `game/entities.js` — shared world physics/LOS/camera-collision + hunter & hider AI
- `game/fx.js` — paint-splash, poof, dust, noise rings, camera shake
- `game/ui.js` — menus, loading screen, HUD, HSV colour wheel, stamina, mini-map, mobile
- `game/game.js` — MENU → HIDE → HUNT → RESULTS state machine, velocity-based
  movement (accel/decel, sprint+stamina, slide, hop) and a collision-aware orbit camera

To change colour you PAINT yourself: aim the crosshair at any object (or stand on
a surface) and press E — the chameleon lifts a brush and the colour sweeps up its
body. The cast is scaled like toys: small hider chameleons and a towering hunter.

Controls: WASD move · Shift sprint · Space hop · C crouch (sprint+C slide) · X curl ·
Z lie · E paint · drag to look. Modes: Classic, Infection, Double. 60fps with
adjustable quality (Low/Med/High).

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
