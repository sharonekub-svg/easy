# Prompt — Upgrade Meccha Chameleon (browser game) to near-commercial quality

Feed this to EZ (or a coding agent) to transform the existing on-site Three.js
Meccha Chameleon into a polished, high-fidelity web game — better UX and
graphics, closer to the real Steam game. Browser/WebGL, deployable on Vercel.

---

```
UPGRADE the existing browser game "Meccha Chameleon" (a Three.js 3D hide & seek
where you camouflage your body colour to hide from a hunter) into a polished,
near-commercial-quality web game. Keep the core camouflage idea; make everything
around it ~1000x better. Target a smooth 60fps in the browser.

== START FROM WHAT EXISTS ==
- Three.js scene, third-person chase camera, a blocky player + hunter, colourful
  crates, an eyedropper (E) + colour palette, a CAMO meter, simple seeker AI,
  survival-time scoring. Refactor into clean modules; don't throw it away.

== UX OVERHAUL ==
1. Onboarding: a 20s guided first round that teaches move, eyedrop, blend, and
   "stay still to vanish", with non-blocking hint popups.
2. Real colour tools: an HSV colour WHEEL + brightness slider, AND a precise
   eyedropper that raycasts to the exact surface under a crosshair and copies
   its colour (not just the nearest crate). Show the picked colour as a swatch.
3. Poses with smooth animation: STAND, CROUCH, CURL (ball), LIE FLAT — each
   changes silhouette to match different props; binds to keys + on-screen buttons.
4. Readable feedback: a CAMO meter with clear states (HIDDEN / SUSPICIOUS /
   SPOTTED), a directional "the hunter is looking your way" indicator, a subtle
   noise ring when you move (movement reveals you), and a small mini-map.
5. Round flow + menus: Main menu -> mode select -> map select; HIDE phase timer,
   HUNT phase timer, a results screen with survival time, coins, and best.
6. Populated matches: add 3-6 AI hiders (other chameleons that also camouflage
   and flee) so it feels alive; architect for real multiplayer later.
7. Game modes: CLASSIC (hunter vs hiders), INFECTION (caught hiders join the
   hunters), DOUBLE (everyone hides, then everyone hunts).
8. Controls: WASD + mouse-look orbit camera, gamepad support, and full mobile
   support (touch joystick + tap buttons). Pause menu + settings (quality, sfx).

== GRAPHICS OVERHAUL (match the real game's cute, clean look) ==
1. Replace the open arena with a detailed MANSION map: connected rooms, furniture
   and props in many colours to blend into. Make maps swappable modules.
2. Characters: a rounded, charming chameleon avatar (eyes, soft body), with a
   smooth colour-morph shader when you repaint (don't snap - blend over ~0.3s)
   and squash/stretch pose animations.
3. Lighting & post: PBR materials, soft contact shadows, SSAO, subtle bloom on
   highlights, SMAA/TAA anti-aliasing, and a warm cinematic colour grade. Per-map
   lighting moods (cozy indoor, etc.). Nice skybox + gentle fog.
4. Juice: paint-splash particles when you absorb a colour, a "poof" + camera
   shake when caught, dust on footsteps, soft UI transitions, a ticking-timer
   vignette in the final seconds.
5. Audio: ambient music, footsteps, an absorb "blip", a heartbeat when the hunter
   is near, round start/win/lose stingers.

== TECH ==
- Three.js + EffectComposer (SSAO, Bloom, SMAA, colour grade). Load props and
  characters as Draco-compressed glTF. Instancing/LOD for performance. A clean
  state machine (MENU -> HIDE -> HUNT -> RESULTS) and an entity manager for
  hiders/hunter. Keep it a self-contained static web build (deployable on Vercel).

== DELIVERABLE ==
- The upgraded game running in the browser, Classic mode fully playable on the
  Mansion map with AI hiders, real colour tools, poses, polished UI and graphics,
  60fps, mobile-friendly. Clear structure to add modes and maps.
```
