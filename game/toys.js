/* ===== Meccha Chameleon — Toy Story cast =====
 * Procedural recreations of the exact objects from the "Andy's Room" Toy Story
 * simulation (github.com/yasseraboelsaad/Toy-Story-room-simulation): Buzz,
 * Woody, Jessie & Bullseye, Rex, Hamm, Slinky Dog, Mr. Potato Head, Lenny, the
 * Aliens (LGM), Lotso, RC and the Luxo Ball. The original ships Unity binary
 * models that a static web build can't load, so each character is rebuilt here
 * from primitives with its signature silhouette and colours. Every coloured
 * part is pickable (you can paint yourself its colour) and each toy registers
 * one collider so it doubles as camouflage cover.
 *
 * Each builder takes (b, x, z, rotY) where b is the map Builder.
 */

// small helper: place a box/cyl/sphere relative to a toy origin with rotation
function rel(x, z, rotY, lx, lz) {
  const c = Math.cos(rotY || 0), s = Math.sin(rotY || 0);
  return [x + lx * c + lz * s, z - lx * s + lz * c];
}

// ---------------- BUZZ LIGHTYEAR ----------------
export function buzz(b, x, z, rotY) {
  const o = { rough: 0.4 }, g = rotY || 0;
  b.collide(x, z, 1.4, 1.0, 0, 2.6);
  // boots + legs (white with purple)
  [[-0.32, 0], [0.32, 0]].forEach((p) => {
    const [px, pz] = rel(x, z, g, p[0], p[1]);
    b.box(0.34, 0.9, 0.4, 0xf2f3f6, px, 0.55, pz, { collide: false, rough: 0.4 });
    b.box(0.4, 0.34, 0.5, 0x5a338f, px, 0.18, pz + 0.05, { collide: false, rough: 0.4 }); // boot
    b.box(0.36, 0.18, 0.42, 0x3cae4f, px, 1.0, pz, { collide: false, rough: 0.4 });        // knee band
  });
  // hips (purple)
  b.box(0.85, 0.35, 0.5, 0x5a338f, x, 1.15, z, { collide: false, rough: 0.4 });
  // torso (white) + green chest panel + control buttons
  b.box(0.9, 0.95, 0.55, 0xf2f3f6, x, 1.75, z, { collide: false, rough: 0.4 });
  const [cx, cz] = rel(x, z, g, 0, 0.3);
  b.box(0.55, 0.5, 0.08, 0x3cae4f, cx, 1.8, cz, { collide: false, cast: false, rough: 0.4 });
  b.box(0.5, 0.18, 0.06, 0xe8e8ee, cx, 1.55, cz + 0.02, { collide: false, cast: false }); // purple/white belt area
  [[-0.12, 0xd23b3b], [0, 0xf2c33c], [0.12, 0x2f7fd8]].forEach((bt) => { const [bx, bz] = rel(x, z, g, bt[0], 0.32); b.sphere(0.05, bt[1], bx, 1.82, bz, { collide: false, cast: false }); });
  // shoulders / arms (white + green gloves)
  [[-0.6, 0x3cae4f], [0.6, 0x3cae4f]].forEach((p) => {
    const [ax, az] = rel(x, z, g, p[0], 0);
    b.box(0.3, 0.8, 0.35, 0xf2f3f6, ax, 1.7, az, { collide: false, rough: 0.4 });
    b.box(0.32, 0.3, 0.38, 0x3cae4f, ax, 1.3, az, { collide: false, rough: 0.4 }); // glove
  });
  // wing pack (white panels, red/green tips)
  [[-0.55, 1], [0.55, -1]].forEach((p) => { const [wx, wz] = rel(x, z, g, p[0], -0.4); b.box(0.18, 0.7, 0.5, 0xf2f3f6, wx, 1.85, wz, { collide: false, cast: false }); b.box(0.2, 0.2, 0.2, p[1] > 0 ? 0xd23b3b : 0x3cae4f, wx, 2.15, wz, { collide: false, cast: false }); });
  // head: purple hood + peach face + clear-ish dome look
  b.sphere(0.42, 0x6b3fa0, x, 2.55, z, { collide: false, rough: 0.4 });               // hood
  const [fx, fz] = rel(x, z, g, 0, 0.18);
  b.sphere(0.3, 0xe8b88f, fx, 2.5, fz, { collide: false, rough: 0.5 });               // face
  b.box(0.5, 0.1, 0.1, 0x6b3fa0, x, 2.78, z, { collide: false, cast: false });        // chin strap
}

// ---------------- WOODY ----------------
export function woody(b, x, z, rotY) {
  const g = rotY || 0;
  b.collide(x, z, 1.1, 0.9, 0, 2.4);
  // boots + blue jeans
  [[-0.24, 0x6b4a2c], [0.24, 0x6b4a2c]].forEach((p) => { const [px, pz] = rel(x, z, g, p[0], 0); b.box(0.3, 0.3, 0.42, p[1], px, 0.16, pz + 0.05, { collide: false, rough: 0.6 }); b.box(0.26, 0.8, 0.32, 0x3f63a8, px, 0.7, pz, { collide: false, rough: 0.7 }); });
  // yellow plaid shirt body
  b.box(0.78, 0.85, 0.5, 0xe8c84a, x, 1.45, z, { collide: false, rough: 0.7 });
  // cow-print vest (brown/white)
  b.box(0.84, 0.7, 0.54, 0x8a5a36, x, 1.5, z, { collide: false, rough: 0.7 });
  const [vx, vz] = rel(x, z, g, 0, 0.28); b.box(0.5, 0.7, 0.06, 0xe8c84a, vx, 1.5, vz, { collide: false, cast: false }); // open front shows shirt
  // red bandana
  b.box(0.42, 0.2, 0.3, 0xc0392b, x, 1.92, z + 0.0, { collide: false, cast: false });
  // arms (yellow) + hands
  [[-0.52], [0.52]].forEach((p) => { const [ax, az] = rel(x, z, g, p[0], 0); b.box(0.22, 0.7, 0.28, 0xe8c84a, ax, 1.4, az, { collide: false, rough: 0.7 }); b.sphere(0.13, 0xe8b88f, ax, 1.06, az, { collide: false }); });
  // head + hair + cowboy hat
  b.sphere(0.34, 0xe8b88f, x, 2.18, z, { collide: false, rough: 0.55 });
  b.box(0.4, 0.18, 0.4, 0x4a2f1c, x, 2.34, z - 0.06, { collide: false, cast: false }); // hair
  b.cyl(0.7, 0.12, 0xb5853f, x, 2.46, z, { collide: false, cast: false, rough: 0.6 }); // brim
  b.cyl(0.26, 0.4, 0xb5853f, x, 2.66, z, { collide: false, cast: false, rough: 0.6 }); // crown
}

// ---------------- JESSIE ----------------
export function jessie(b, x, z, rotY) {
  const g = rotY || 0;
  b.collide(x, z, 1.0, 0.9, 0, 2.4);
  // boots + yellow chaps
  [[-0.24], [0.24]].forEach((p) => { const [px, pz] = rel(x, z, g, p[0], 0); b.box(0.3, 0.32, 0.42, 0x9a6a3a, px, 0.16, pz + 0.05, { collide: false }); b.box(0.28, 0.8, 0.34, 0xe8c84a, px, 0.72, pz, { collide: false, rough: 0.7 }); b.box(0.3, 0.12, 0.36, 0xffffff, px, 0.5, pz, { collide: false, cast: false }); });
  // red/white shirt
  b.box(0.74, 0.85, 0.48, 0xd23b3b, x, 1.45, z, { collide: false, rough: 0.7 });
  const [cx, cz] = rel(x, z, g, 0, 0.26); b.box(0.7, 0.2, 0.06, 0xffffff, cx, 1.72, cz, { collide: false, cast: false }); // white yoke
  // arms
  [[-0.48], [0.48]].forEach((p) => { const [ax, az] = rel(x, z, g, p[0], 0); b.box(0.2, 0.68, 0.26, 0xd23b3b, ax, 1.4, az, { collide: false, rough: 0.7 }); b.sphere(0.12, 0xe8b88f, ax, 1.08, az, { collide: false }); });
  // head + red braid + cowgirl hat
  b.sphere(0.32, 0xe8b88f, x, 2.16, z, { collide: false, rough: 0.55 });
  const [hx, hz] = rel(x, z, g, 0, -0.2); b.cyl(0.1, 0.9, 0x9a3b1f, hx, 1.7, hz, { collide: false, cast: false, seg: 6 }); // braid
  b.cyl(0.62, 0.1, 0xe8c84a, x, 2.42, z, { collide: false, cast: false }); b.cyl(0.24, 0.36, 0xe8c84a, x, 2.6, z, { collide: false, cast: false });
}

// ---------------- BULLSEYE (horse) ----------------
export function bullseye(b, x, z, rotY) {
  const g = rotY || 0, tan = 0xc89b6a, cream = 0xf0e0c0;
  b.collide(x, z, 1.8, 1.0, g, 1.8);
  b.box(1.7, 0.9, 0.8, tan, x, 1.0, z, { collide: false, rough: 0.7, rotY: g }); // body
  // legs
  [[0.6, 0.3], [0.6, -0.3], [-0.6, 0.3], [-0.6, -0.3]].forEach((p) => { const [lx, lz] = rel(x, z, g, p[0], p[1]); b.box(0.22, 0.7, 0.22, tan, lx, 0.35, lz, { collide: false }); b.box(0.24, 0.16, 0.24, cream, lx, 0.08, lz, { collide: false, cast: false }); });
  // neck + head
  const [nx, nz] = rel(x, z, g, 0.85, 0); b.box(0.45, 0.8, 0.5, tan, nx, 1.4, nz, { collide: false, rough: 0.7 });
  const [hx, hz] = rel(x, z, g, 1.15, 0); b.box(0.4, 0.5, 0.7, tan, hx, 1.7, hz, { collide: false }); b.box(0.42, 0.3, 0.4, cream, hx + 0.0, 1.6, hz + 0.0, { collide: false, cast: false });
  // mane + tail
  b.box(0.2, 0.9, 0.55, cream, nx - 0.2 * Math.cos(g), 1.6, nz + 0.2 * Math.sin(g), { collide: false, cast: false });
  const [tx, tz] = rel(x, z, g, -0.95, 0); b.box(0.18, 0.7, 0.3, cream, tx, 0.7, tz, { collide: false, cast: false });
}

// ---------------- REX (dinosaur) ----------------
export function rex(b, x, z, rotY) {
  const g = rotY || 0, green = 0x6fae3f, belly = 0xa6d472;
  b.collide(x, z, 1.4, 1.2, g, 2.6);
  // big tail (back)
  const [tx, tz] = rel(x, z, g, 0, -1.0); b.box(0.5, 0.5, 1.2, green, tx, 0.7, tz, { collide: false, rough: 0.6 });
  // body
  b.box(0.9, 1.1, 0.9, green, x, 1.2, z, { collide: false, rough: 0.6, rotY: g });
  const [bx, bz] = rel(x, z, g, 0, 0.4); b.box(0.6, 0.9, 0.1, belly, bx, 1.15, bz, { collide: false, cast: false });
  // legs
  [[-0.3], [0.3]].forEach((p) => { const [lx, lz] = rel(x, z, g, p[0], 0.1); b.box(0.34, 0.8, 0.5, green, lx, 0.5, lz, { collide: false }); });
  // tiny arms
  [[-0.4], [0.4]].forEach((p) => { const [ax, az] = rel(x, z, g, p[0], 0.35); b.box(0.14, 0.4, 0.14, green, ax, 1.4, az, { collide: false, cast: false }); });
  // head with jaw + teeth
  const [hx, hz] = rel(x, z, g, 0, 0.45); b.box(0.7, 0.6, 0.8, green, hx, 2.1, hz, { collide: false, rough: 0.6 });
  const [jx, jz] = rel(x, z, g, 0, 0.7); b.box(0.6, 0.18, 0.5, belly, jx, 1.85, jz, { collide: false, cast: false }); // mouth
  for (let i = -1; i <= 1; i++) { const [px, pz] = rel(x, z, g, i * 0.18, 0.9); b.box(0.06, 0.12, 0.06, 0xffffff, px, 1.95, pz, { collide: false, cast: false }); }
  // eyes
  [[-0.16], [0.16]].forEach((p) => { const [ex, ez] = rel(x, z, g, p[0], 0.78); b.sphere(0.08, 0xffffff, ex, 2.3, ez, { collide: false, cast: false }); });
}

// ---------------- HAMM (piggy bank) ----------------
export function hamm(b, x, z, rotY) {
  const g = rotY || 0, pink = 0xe79ab5, dark = 0xd07a98;
  b.collide(x, z, 1.5, 1.1, g, 1.4);
  b.sphere(0.85, pink, x, 0.95, z, { collide: false, rough: 0.5 }); const body = 0; // round body
  b.box(1.5, 1.0, 1.1, pink, x, 0.85, z, { collide: false, rough: 0.5, rotY: g }); // belly box blends
  // legs (4 stubby)
  [[0.5, 0.4], [0.5, -0.4], [-0.5, 0.4], [-0.5, -0.4]].forEach((p) => { const [lx, lz] = rel(x, z, g, p[0], p[1]); b.cyl(0.18, 0.35, dark, lx, 0.18, lz, { collide: false }); });
  // snout + nostrils
  const [sx, sz] = rel(x, z, g, 0, 0.75); b.cyl(0.22, 0.18, dark, sx, 1.0, sz, { collide: false, cast: false, rotY: g });
  // ears
  [[-0.35], [0.35]].forEach((p) => { const [ex, ez] = rel(x, z, g, p[0], 0.45); b.box(0.22, 0.22, 0.06, dark, ex, 1.5, ez, { collide: false, cast: false }); });
  // coin slot on top
  b.box(0.4, 0.05, 0.1, 0x7a4a60, x, 1.55, z, { collide: false, cast: false });
  // curly tail
  const [qx, qz] = rel(x, z, g, 0, -0.8); b.sphere(0.12, dark, qx, 1.0, qz, { collide: false, cast: false });
  // eyes
  [[-0.2], [0.2]].forEach((p) => { const [ex, ez] = rel(x, z, g, p[0], 0.6); b.sphere(0.08, 0xffffff, ex, 1.25, ez, { collide: false, cast: false }); });
}

// ---------------- SLINKY DOG ----------------
export function slinky(b, x, z, rotY) {
  const g = rotY || 0, brown = 0x8a5a36, dark = 0x6b4226, spring = 0xb8b8c0;
  b.collide(x, z, 2.6, 0.8, g, 1.2);
  // front (head + chest)
  const [fx, fz] = rel(x, z, g, 1.0, 0);
  b.box(0.6, 0.55, 0.7, brown, fx, 0.7, fz, { collide: false, rough: 0.7 });
  const [hx, hz] = rel(x, z, g, 1.45, 0); b.box(0.5, 0.45, 0.7, brown, hx, 0.95, hz, { collide: false }); // head
  const [snx, snz] = rel(x, z, g, 1.75, 0); b.box(0.35, 0.3, 0.45, dark, snx, 0.85, snz, { collide: false, cast: false }); // snout
  [[-0.45], [0.45]].forEach((p) => { const [ex, ez] = rel(x, z, g, 1.4, p[0]); b.box(0.16, 0.3, 0.16, dark, ex, 1.25, ez, { collide: false, cast: false }); }); // ears
  // front legs
  [[-0.22], [0.22]].forEach((p) => { const [lx, lz] = rel(x, z, g, 0.9, p[0]); b.cyl(0.1, 0.5, brown, lx, 0.25, lz, { collide: false }); });
  // SLINKY spring middle
  for (let i = 0; i < 6; i++) { const [cx, cz] = rel(x, z, g, 0.4 - i * 0.28, 0); const t = b.cyl(0.28, 0.06, spring, cx, 0.62, cz, { collide: false, cast: false, seg: 14, rotY: g }); t.rotation.x = Math.PI / 2; }
  // back (hind + tail)
  const [rx, rz] = rel(x, z, g, -1.25, 0); b.box(0.6, 0.55, 0.7, brown, rx, 0.7, rz, { collide: false, rough: 0.7 });
  [[-0.22], [0.22]].forEach((p) => { const [lx, lz] = rel(x, z, g, -1.35, p[0]); b.cyl(0.1, 0.5, brown, lx, 0.25, lz, { collide: false }); });
  const [tx, tz] = rel(x, z, g, -1.6, 0); b.cyl(0.07, 0.4, brown, tx, 0.95, tz, { collide: false, cast: false });
}

// ---------------- MR. POTATO HEAD ----------------
export function potatoHead(b, x, z, rotY) {
  const g = rotY || 0, body = 0x9a6a3c;
  b.collide(x, z, 1.2, 1.0, g, 1.8);
  b.sphere(0.7, body, x, 1.0, z, { collide: false, rough: 0.55 }); const b2 = b.sphere(0.72, body, x, 1.1, z, { collide: false, rough: 0.55 }); b2.scale.y = 1.2;
  // blue hat (bowler)
  b.cyl(0.55, 0.08, 0x2f4fa0, x, 1.78, z, { collide: false, cast: false });
  b.cyl(0.34, 0.4, 0x2f4fa0, x, 1.98, z, { collide: false, cast: false });
  // eyes (white with blue)
  [[-0.2], [0.2]].forEach((p) => { const [ex, ez] = rel(x, z, g, p[0], 0.6); b.sphere(0.13, 0xffffff, ex, 1.3, ez, { collide: false, cast: false }); b.sphere(0.06, 0x2f7fd8, ex + 0.0, 1.3, ez + 0.08, { collide: false, cast: false }); });
  // red lips + moustache
  const [mx, mz] = rel(x, z, g, 0, 0.66); b.box(0.34, 0.12, 0.1, 0xd23b3b, mx, 0.95, mz, { collide: false, cast: false }); b.box(0.4, 0.06, 0.08, 0x2a1a10, mx, 1.05, mz, { collide: false, cast: false });
  // nose
  b.sphere(0.1, 0xd98a5a, mx, 1.12, mz, { collide: false, cast: false });
  // ears + ARMS + feet
  [[-0.62, 0xe8c84a], [0.62, 0xe8c84a]].forEach((p) => { const [ax, az] = rel(x, z, g, p[0], 0); b.box(0.12, 0.5, 0.12, p[1], ax, 1.0, az, { collide: false, cast: false }); });
  [[-0.3], [0.3]].forEach((p) => { const [fx, fz] = rel(x, z, g, p[0], 0.25); b.box(0.26, 0.16, 0.5, 0xd98a5a, fx, 0.18, fz + 0.2, { collide: false, cast: false }); }); // big feet
}

// ---------------- LENNY (binoculars) ----------------
export function lenny(b, x, z, rotY) {
  const g = rotY || 0, red = 0xc0392b, black = 0x26262c;
  b.collide(x, z, 1.0, 0.7, g, 1.3);
  [[-0.22], [0.22]].forEach((p) => {
    const [cx, cz] = rel(x, z, g, p[0], 0);
    b.cyl(0.26, 0.9, red, cx, 0.95, cz, { collide: false, rough: 0.4 });           // barrel
    const [lx, lz] = rel(x, z, g, p[0], 0.32); b.cyl(0.2, 0.2, black, lx, 1.3, lz, { collide: false, cast: false, rotY: g }); // lens
    b.sphere(0.14, 0x9fe0ff, lx, 1.3, lz + 0.08, { collide: false, cast: false }); // glass eye
    // feet
    b.box(0.3, 0.16, 0.45, black, cx, 0.1, cz + 0.1, { collide: false, cast: false });
  });
  b.box(0.5, 0.2, 0.3, black, x, 1.0, z, { collide: false, cast: false }); // bridge
}

// ---------------- ALIEN (Little Green Man) ----------------
export function alien(b, x, z, rotY, scale) {
  const g = rotY || 0, s = scale || 1, green = 0x5fbf4a, suit = 0x3aa0a0;
  b.collide(x, z, 0.9 * s, 0.7 * s, 0, 1.8 * s);
  // legs + boots
  [[-0.18], [0.18]].forEach((p) => { const [lx, lz] = rel(x, z, g, p[0] * s, 0); b.box(0.2 * s, 0.5 * s, 0.24 * s, suit, lx, 0.3 * s, lz, { collide: false }); b.box(0.24 * s, 0.14 * s, 0.3 * s, 0x2a2a30, lx, 0.07 * s, lz + 0.05 * s, { collide: false, cast: false }); });
  // teal jumpsuit body
  b.box(0.55 * s, 0.6 * s, 0.4 * s, suit, x, 0.85 * s, z, { collide: false, rough: 0.6 });
  b.box(0.5 * s, 0.18 * s, 0.42 * s, 0xffffff, x, 1.02 * s, z, { collide: false, cast: false }); // collar
  // arms reaching up ("the claaaw")
  [[-0.4], [0.4]].forEach((p) => { const [ax, az] = rel(x, z, g, p[0] * s, 0); const arm = b.box(0.16 * s, 0.55 * s, 0.16 * s, green, ax, 1.3 * s, az, { collide: false, cast: false }); arm.rotation.z = -p[0] * 0.6; });
  // green head
  b.sphere(0.4 * s, green, x, 1.45 * s, z, { collide: false, rough: 0.5 });
  // THREE eyes on stalks + antenna
  [[-0.18], [0, ], [0.18]].forEach((p, i) => { const [ex, ez] = rel(x, z, g, p[0] * s, 0.34 * s); b.sphere(0.1 * s, 0xffffff, ex, (1.5 + (i === 1 ? 0.06 : 0)) * s, ez, { collide: false, cast: false }); b.sphere(0.045 * s, 0x222, ex, (1.5 + (i === 1 ? 0.06 : 0)) * s, ez + 0.08 * s, { collide: false, cast: false }); });
  b.cyl(0.02 * s, 0.25 * s, green, x, 1.8 * s, z, { collide: false, cast: false }); b.sphere(0.06 * s, green, x, 1.95 * s, z, { collide: false, cast: false });
  // mouth
  const [mx, mz] = rel(x, z, g, 0, 0.38 * s); b.box(0.14 * s, 0.04 * s, 0.05 * s, 0x2a1a10, mx, 1.36 * s, mz, { collide: false, cast: false });
}

// ---------------- LOTSO (pink bear) ----------------
export function lotso(b, x, z, rotY) {
  const g = rotY || 0, pink = 0xe06aa0, light = 0xf0a0c4;
  b.collide(x, z, 1.6, 1.2, g, 2.2);
  b.sphere(0.95, pink, x, 1.1, z, { collide: false, rough: 0.85 });           // belly
  b.box(1.6, 1.4, 1.2, pink, x, 1.0, z, { collide: false, rough: 0.85, rotY: g });
  const [tx, tz] = rel(x, z, g, 0, 0.45); b.sphere(0.6, light, tx, 1.0, tz, { collide: false, cast: false, rough: 0.9 }); // light tummy
  // head + ears + muzzle
  b.sphere(0.6, pink, x, 2.0, z, { collide: false, rough: 0.85 });
  [[-0.42], [0.42]].forEach((p) => { const [ex, ez] = rel(x, z, g, p[0], 0); b.sphere(0.26, pink, ex, 2.4, ez, { collide: false, cast: false, rough: 0.85 }); });
  const [snx, snz] = rel(x, z, g, 0, 0.5); b.sphere(0.3, light, snx, 1.9, snz, { collide: false, cast: false, rough: 0.9 });
  b.sphere(0.1, 0x6a2a44, snx, 1.98, snz + 0.18, { collide: false, cast: false });
  // arms + legs
  [[-0.85], [0.85]].forEach((p) => { const [ax, az] = rel(x, z, g, p[0], 0); b.sphere(0.34, pink, ax, 1.2, az, { collide: false, cast: false, rough: 0.85 }); });
  [[-0.45], [0.45]].forEach((p) => { const [lx, lz] = rel(x, z, g, p[0], 0.2); b.sphere(0.36, pink, lx, 0.4, lz, { collide: false, cast: false, rough: 0.85 }); });
}

// ---------------- RC (remote-control car) ----------------
export function rcCar(b, x, z, rotY) {
  const g = rotY || 0, red = 0xd5352b, dark = 0x2a2a30;
  b.collide(x, z, 1.6, 0.9, g, 0.8);
  b.box(1.5, 0.4, 0.85, red, x, 0.4, z, { collide: false, rough: 0.3, metal: 0.2, rotY: g }); // chassis
  b.box(0.8, 0.35, 0.7, 0xe8e8ee, x, 0.7, z, { collide: false, rough: 0.2, rotY: g });          // cockpit
  b.box(0.6, 0.25, 0.6, 0x3a6aa0, x, 0.85, z, { collide: false, cast: false, rotY: g });        // driver
  // big knobby wheels
  [[0.55, 0.5], [0.55, -0.5], [-0.55, 0.5], [-0.55, -0.5]].forEach((p) => { const [wx, wz] = rel(x, z, g, p[0], p[1]); const w = b.cyl(0.3, 0.26, dark, wx, 0.3, wz, { collide: false, seg: 12 }); w.rotation.x = Math.PI / 2 + g; });
  // antenna
  const [ax, az] = rel(x, z, g, -0.6, 0); b.cyl(0.02, 1.2, dark, ax, 1.0, az, { collide: false, cast: false }); b.sphere(0.06, 0xffd23b, ax, 1.6, az, { collide: false, cast: false });
}

// ---------------- LUXO / PIXAR BALL ----------------
export function luxoBall(b, x, z, r) {
  r = r || 1.3;
  b.collide(x, z, r * 2, r * 2, 0, r * 2);
  b.sphere(r, 0xf4f4f4, x, r, z, { rough: 0.35 });                         // white ball
  // blue band
  const band = b.sphere(r * 1.005, 0x2f7fd8, x, r, z, { collide: false, rough: 0.35 }); band.scale.y = 0.22;
  // red star (approximate with a red disc patch on the side)
  const star = b.sphere(r * 1.01, 0xd5352b, x, r + r * 0.45, z, { collide: false, cast: false, rough: 0.35 }); star.scale.set(0.55, 0.4, 0.2);
}

// place every member of the cast around Andy's room; returns nothing
export function placeCast(b) {
  buzz(b, 6, -2, -0.5);
  woody(b, -6, -3, 0.6);
  jessie(b, -9, 2, 1.0);
  bullseye(b, -12, 4, 0.3);
  rex(b, 10, 5, -1.0);
  hamm(b, 12, -3, 0.4);
  slinky(b, -2, 9, 1.4);
  potatoHead(b, 3, 7, -0.5);
  lenny(b, 8, 9, 0.2);
  lotso(b, -15, -2, 0.8);
  rcCar(b, 0, -7, 0.5);
  // a little squad of Aliens
  alien(b, 14, 9, -0.6, 1.0);
  alien(b, 15.2, 8, -0.3, 0.9);
  alien(b, 13, 7.6, -1.0, 1.05);
}
