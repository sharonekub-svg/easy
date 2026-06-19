# Prompt — Meccha Chameleon (Roblox replica)

A copy-paste prompt for building a Roblox (Luau) replica of the Steam hit
*Meccha Chameleon* — a casual hide-and-seek game where hiders camouflage their
body color to blend into the map while hunters find them before time runs out.

Sources: [Wikipedia](https://en.wikipedia.org/wiki/Meccha_Chameleon) ·
[Steam](https://store.steampowered.com/app/4704690/MECCHA_CHAMELEON/)

---

```
Build a Roblox (Luau) multiplayer game that is a faithful replica of the Steam
game "Meccha Chameleon" — a casual hide-and-seek game where hiders camouflage
their body color to blend into the map while hunters try to find them before a
timer runs out.

CORE LOOP (one round)
1. Lobby: players join a server (support up to 24, sweet spot 6–12). A round
   manager auto-starts when >=2 players are present.
2. Team assignment: split into HIDERS and HUNTERS (e.g. 1 hunter per ~5 hiders).
3. Hide phase (20s): hunters are frozen/blinded; hiders spread out and camouflage.
4. Hunt phase (120s): hunters search and tag hiders. Tagged hiders are out
   (spectate). Hiders survive by staying hidden and blending in.
5. Round end: hiders win if any survive the timer; hunters win if they tag all.
   Show a results screen, award points/coins, then loop back to lobby.

HIDER MECHANICS (the signature feature — get this right)
- Start as a plain WHITE character.
- A color-blend GUI: a HSV color WHEEL + brightness slider to paint the whole
  avatar any color, plus an EYEDROPPER tool that samples the color of whatever
  surface the player is looking at (raycast to the BasePart, read its Color) so
  they can match walls/floor/props exactly.
- POSES: let the player switch stance — STAND, CURL (ball), LIE FLAT — using
  animations, to better match objects in the scene.
- Movement is slow; standing perfectly still + matching color = nearly invisible.

HUNTER MECHANICS
- Faster move speed, a "tag" action (click/touch a hider within range).
- A limited number of "ping" reveals or a proximity heat indicator (optional).
- On-screen count of hiders remaining and time left.

GAME MODES (build CLASSIC first, then add)
- CLASSIC HUNT: hunters vs hiders as above.
- INFECTION: a tagged hider becomes a hunter; last hider standing wins.
- DOUBLE: everyone hides first, then everyone becomes a hunter when the hunt
  timer starts.

MAPS
- Ship ONE polished map first: "Hide-and-Seek Mansion" (rooms, furniture, lots
  of colored props to blend with). Architect it so maps are swappable modules.
- Future maps: Sewer, Backrooms, Penguin Hotel, Sugarland, Indoor Country.

ROBLOX IMPLEMENTATION
- Server-authoritative round manager in ServerScriptService (state machine:
  LOBBY -> HIDE -> HUNT -> RESULTS).
- Teams service for Hiders/Hunters; ReplicatedStorage RemoteEvents for
  color-change, pose-change, and tag actions (validate on the server).
- Recolor the avatar via Highlight/BodyColors or by setting each MeshPart.Color;
  replicate to all clients.
- Client GUI: color wheel, eyedropper, pose buttons, HUD (role, timer, players
  left). Keep it clean and cute/casual in style.
- Basic anti-cheat: server checks tag distance and round state; ignore client
  actions outside the valid phase.

POLISH
- Cute, colorful, low-poly art direction. Sound: round start/end stingers,
  tag SFX, ticking timer near the end. Camera juice on tag. Leaderboard with
  wins/coins. A simple cosmetic shop is a nice-to-have.

DELIVERABLE
- A working .rbxl place with the Classic mode fully playable end-to-end on one
  map, clean modular Luau, and clear instructions to add more modes/maps.
```
