/* ===== Meccha Chameleon — Maps =====
 * Maps are swappable modules. Each build() returns a uniform descriptor:
 *   { group, colliders[], pickables[], spawns[], hunterSpawn, bounds, mood,
 *     apply(scene,renderer,engine), update(dt,time), dispose() }
 * THE MANSION is the showcase: a grand central hall (chandelier, fireplace,
 * grand rug) opening onto themed rooms and corner nooks, dressed with textured
 * PBR surfaces, window light shafts and living, animated detail. GARDEN is a
 * lighter outdoor map (fountain landmark, trees, flower beds) proving the
 * format is generic.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import * as TEX from './textures.js';

function rng(seed) { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }

class Builder {
  constructor() { this.group = new THREE.Group(); this.colliders = []; this.pickables = []; this._geos = []; }
  mat(color, rough, metal) { return new THREE.MeshStandardMaterial({ color, roughness: rough == null ? 0.8 : rough, metalness: metal || 0 }); }
  _g(geo) { this._geos.push(geo); return geo; }
  box(w, h, d, color, x, y, z, o) {
    o = o || {};
    const m = new THREE.Mesh(this._g(new THREE.BoxGeometry(w, h, d)), this.mat(color, o.rough, o.metal));
    m.position.set(x, y, z); m.castShadow = o.cast !== false; m.receiveShadow = true;
    if (o.rotY) m.rotation.y = o.rotY;
    if (o.tex) TEX.applyTex(m.material, o.tex, o.rep, o.bumpScale);
    if (o.emissive != null) { m.material.emissive = new THREE.Color(o.emissive); m.material.emissiveIntensity = o.emissiveI || 1; }
    this.group.add(m); this.pickables.push(m);
    if (o.collide !== false) this.collide(x, z, w, d, o.rotY, h);
    return m;
  }
  cyl(r, h, color, x, y, z, o) {
    o = o || {};
    const m = new THREE.Mesh(this._g(new THREE.CylinderGeometry(r, o.r2 == null ? r : o.r2, h, o.seg || 20)), this.mat(color, o.rough, o.metal));
    m.position.set(x, y, z); m.castShadow = o.cast !== false; m.receiveShadow = true;
    if (o.emissive != null) { m.material.emissive = new THREE.Color(o.emissive); m.material.emissiveIntensity = o.emissiveI || 1; }
    this.group.add(m); this.pickables.push(m);
    if (o.collide) this.collide(x, z, r * 2, r * 2, 0, h);
    return m;
  }
  sphere(r, color, x, y, z, o) {
    o = o || {};
    const m = new THREE.Mesh(this._g(new THREE.SphereGeometry(r, 20, 16)), this.mat(color, o.rough, o.metal));
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
    if (o.emissive != null) { m.material.emissive = new THREE.Color(o.emissive); m.material.emissiveIntensity = o.emissiveI || 1; }
    this.group.add(m); this.pickables.push(m); return m;
  }
  plane(w, d, color, x, y, z, o) {
    o = o || {};
    const m = new THREE.Mesh(this._g(new THREE.PlaneGeometry(w, d)), this.mat(color, o.rough == null ? 0.95 : o.rough, o.metal));
    m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.receiveShadow = true;
    if (o.tex) TEX.applyTex(m.material, o.tex, o.rep, o.bumpScale);
    this.group.add(m); this.pickables.push(m); return m;
  }
  collide(x, z, w, d, rotY, h) {
    let hw = w / 2, hd = d / 2;
    if (rotY) { const c = Math.abs(Math.cos(rotY)), s = Math.abs(Math.sin(rotY)); hw = (w * c + d * s) / 2; hd = (w * s + d * c) / 2; }
    this.colliders.push({ x, z, hw, hd, h: h || 1 });
  }
  wallWithGaps(horizontal, fixed, start, end, gaps, h, color, tex) {
    let segs = [[start, end]];
    (gaps || []).forEach((gp) => {
      const a = gp[0] - gp[1] / 2, bb = gp[0] + gp[1] / 2, ns = [];
      segs.forEach((sg) => { const s = sg[0], e = sg[1]; if (bb <= s || a >= e) ns.push([s, e]); else { if (s < a) ns.push([s, a]); if (bb < e) ns.push([bb, e]); } });
      segs = ns;
    });
    segs.forEach((sg) => {
      const len = sg[1] - sg[0], mid = (sg[0] + sg[1]) / 2;
      if (horizontal) this.box(len, h, 0.45, color, mid, h / 2, fixed, { rough: 0.96, tex: tex, rep: Math.max(1, len / 4) });
      else this.box(0.45, h, len, color, fixed, h / 2, mid, { rough: 0.96, tex: tex, rep: Math.max(1, len / 4) });
    });
    // door header above each gap for a finished look
    (gaps || []).forEach((gp) => {
      if (horizontal) this.box(gp[1], h - 2.6, 0.45, color, gp[0], h - (h - 2.6) / 2, fixed, { collide: false, cast: false, rough: 0.96 });
      else this.box(0.45, h - 2.6, gp[1], color, fixed, h - (h - 2.6) / 2, gp[0], { collide: false, cast: false, rough: 0.96 });
    });
  }
}

// ---------- shared dressing prefabs ----------
function painting(b, x, y, z, rotY, w, h, col) {
  const frame = b.box(w + 0.18, h + 0.18, 0.08, 0x4a3420, x, y, z, { rotY, collide: false, cast: false, rough: 0.5 });
  b.box(w, h, 0.04, col, x + Math.sin(rotY) * 0.05, y, z + Math.cos(rotY) * 0.05, { rotY, collide: false, cast: false, rough: 0.4 });
}
function windowGlow(b, x, y, z, rotY, w, h) {
  // frame + glowing pane (emissive) — reads as a warm window
  b.box(w + 0.3, h + 0.3, 0.2, 0xece3d2, x, y, z, { rotY, collide: false, cast: false, rough: 0.6 });
  b.box(w, h, 0.06, 0xfff2cf, x + Math.sin(rotY) * 0.06, y, z + Math.cos(rotY) * 0.06, { rotY, collide: false, cast: false, emissive: 0xffd98a, emissiveI: 1.1, rough: 0.2 });
  // mullions
  b.box(0.06, h, 0.08, 0xece3d2, x, y, z, { rotY, collide: false, cast: false });
  b.box(w, 0.06, 0.08, 0xece3d2, x, y, z, { rotY, collide: false, cast: false });
}
function lightShaft(b, x, z, rotY) {
  // soft volumetric-ish beam from a window to the floor
  const geo = new THREE.CylinderGeometry(0.4, 2.6, 6, 8, 1, true);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffe9b0, transparent: true, opacity: 0.06, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
  const m = new THREE.Mesh(geo, mat); m.position.set(x, 3, z); m.rotation.z = rotY || 0.25; b.group.add(m);
  return m;
}
function sofa(b, x, z, color, rotY, tex) {
  const g = rotY || 0, dx = Math.cos(g), dz = -Math.sin(g);
  b.box(2.6, 0.5, 1.1, color, x, 0.42, z, { rotY: g, rough: 0.9, tex });
  b.box(2.6, 0.7, 0.3, color, x - dz * 0.4, 0.85, z - dx * 0.4, { rotY: g, collide: false, rough: 0.9, tex });
  b.box(0.32, 0.75, 1.1, color, x + dx * 1.15, 0.78, z + dz * 1.15, { rotY: g, collide: false, rough: 0.9 });
  b.box(0.32, 0.75, 1.1, color, x - dx * 1.15, 0.78, z - dz * 1.15, { rotY: g, collide: false, rough: 0.9 });
  // cushions
  b.box(1.0, 0.2, 0.9, color, x + dx * 0.55, 0.62, z + dz * 0.55, { rotY: g, collide: false, cast: false, rough: 0.95 });
  b.box(1.0, 0.2, 0.9, color, x - dx * 0.55, 0.62, z - dz * 0.55, { rotY: g, collide: false, cast: false, rough: 0.95 });
}
function table(b, x, z, color, legColor, tex) {
  b.box(1.7, 0.16, 1.05, color, x, 0.88, z, { collide: true, rough: 0.4, metal: 0.05, tex });
  [[0.74, 0.44], [-0.74, 0.44], [0.74, -0.44], [-0.74, -0.44]].forEach((p) => b.box(0.12, 0.88, 0.12, legColor, x + p[0], 0.44, z + p[1], { collide: false }));
}
function chair(b, x, z, color, rotY) {
  const g = rotY || 0, dx = Math.cos(g), dz = -Math.sin(g);
  b.box(0.6, 0.1, 0.6, color, x, 0.5, z, { collide: false, rough: 0.5 });
  b.box(0.6, 0.7, 0.1, color, x - dz * 0.25, 0.85, z - dx * 0.25, { rotY: g, collide: false, rough: 0.5 });
  [[0.24, 0.24], [-0.24, 0.24], [0.24, -0.24], [-0.24, -0.24]].forEach((p) => b.box(0.08, 0.5, 0.08, color, x + p[0], 0.25, z + p[1], { collide: false }));
}
function shelf(b, x, z, color, rotY, woodTex) {
  b.box(2.2, 2.6, 0.5, color, x, 1.3, z, { rotY, rough: 0.6, tex: woodTex });
  const booky = [0xd84b4b, 0x4b7bd8, 0xe6b93c, 0x53c08a, 0xb066c9, 0xe87fb0, 0xf08a3d, 0x36b3a8];
  const dx = Math.cos(rotY || 0), dz = -Math.sin(rotY || 0);
  for (let r = 0; r < 4; r++) for (let i = 0; i < 6; i++) {
    const hh = 0.42 + Math.random() * 0.16;
    b.box(0.16 + Math.random() * 0.08, hh, 0.32, booky[(r * 6 + i) % booky.length], x - dx * 0.85 + dx * i * 0.34, 0.5 + r * 0.58 + hh / 2 - 0.21, z - dz * 0.85 + dz * i * 0.34, { rotY, collide: false, cast: false });
  }
}
function plant(b, x, z) {
  b.cyl(0.3, 0.55, 0xc77b4a, x, 0.27, z, { r2: 0.22, collide: true, rough: 0.7 });
  b.sphere(0.58, 0x3f9d54, x, 1.0, z, { rough: 0.95 });
  b.sphere(0.42, 0x4cb364, x + 0.26, 1.28, z - 0.1, { rough: 0.95 });
  b.sphere(0.38, 0x357f44, x - 0.22, 1.22, z + 0.16, { rough: 0.95 });
  b.sphere(0.3, 0x52c06a, x + 0.05, 1.5, z + 0.05, { rough: 0.95 });
}
function rug(b, x, z, color, w, d) { b.plane(w, d, color, x, 0.02, z, { tex: TEX.carpet(color), rep: 2, rough: 1 }); }

// returns {light, update} for a hanging chandelier that sways + flickers
function chandelier(b, x, y, z) {
  const grp = new THREE.Group(); grp.position.set(x, y, z);
  // chain
  const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.4, 6), b.mat(0x3a2f22, 0.6, 0.4)); chain.position.y = 0.7; grp.add(chain);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.05, 8, 20), b.mat(0xcaa45a, 0.35, 0.8)); ring.rotation.x = Math.PI / 2; grp.add(ring);
  const candles = [];
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2, cx = Math.cos(a) * 0.55, cz = Math.sin(a) * 0.55;
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 6), b.mat(0xcaa45a, 0.35, 0.8)); arm.position.set(cx, 0.05, cz); grp.add(arm);
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffd27a }));
    flame.position.set(cx, 0.28, cz); grp.add(flame); candles.push(flame);
  }
  // no cube shadow here (the directional key light handles shadows) — keeps fps up
  const light = new THREE.PointLight(0xffd28a, 26, 26, 1.8); light.position.set(0, 0.2, 0); grp.add(light);
  b.group.add(grp);
  return { grp, light, candles, base: y, update(dt, t) { grp.rotation.z = Math.sin(t * 0.7) * 0.02; grp.position.y = y + Math.sin(t * 0.9) * 0.04; light.intensity = 24 + Math.sin(t * 9.3) * 2 + Math.sin(t * 17) * 1.2; } };
}
// fireplace with a flickering hearth light
function fireplace(b, x, z, rotY) {
  const g = rotY || 0;
  b.box(3.2, 2.6, 0.7, 0x6b5848, x, 1.3, z, { rotY: g, rough: 0.85, tex: TEX.tile(0x8a7766, 0x52453a, 3), rep: 2 });
  b.box(2.0, 1.4, 0.4, 0x1a1410, x, 0.85, z + Math.cos(g) * 0.2, { rotY: g, collide: false, cast: false, rough: 1 }); // recess
  b.box(3.6, 0.25, 0.9, 0x4a3a2c, x, 2.7, z, { rotY: g, collide: false, rough: 0.6 }); // mantel
  // logs + ember glow
  b.cyl(0.12, 1.0, 0x3a2418, x, 0.4, z + Math.cos(g) * 0.25, { rotY: g, collide: false, cast: false, seg: 8 });
  const ember = b.sphere(0.4, 0xff7a2a, x, 0.45, z + Math.cos(g) * 0.25, { collide: false, cast: false, emissive: 0xff5a1a, emissiveI: 2.2, rough: 1 });
  const light = new THREE.PointLight(0xff7a32, 14, 12, 2); light.position.set(x, 0.8, z + Math.cos(g) * 0.4); b.group.add(light);
  return { light, ember, update(dt, t) { const f = 12 + Math.sin(t * 13) * 3 + Math.random() * 3; light.intensity = f; ember.material.emissiveIntensity = 1.8 + Math.sin(t * 11) * 0.5 + Math.random() * 0.4; } };
}
function staircase(b, x, z, color) {
  for (let i = 0; i < 7; i++) b.box(4, 0.3, 0.7, color, x, 0.15 + i * 0.3, z - i * 0.7, { collide: i < 2, rough: 0.5, tex: TEX.wood(color, 4), rep: 1 });
  b.box(0.2, 2.4, 5, 0x4a3420, x - 2.1, 1.2, z - 2, { collide: false, rough: 0.4 });
  b.box(0.2, 2.4, 5, 0x4a3420, x + 2.1, 1.2, z - 2, { collide: false, rough: 0.4 });
}
function piano(b, x, z, rotY) {
  const g = rotY || 0;
  b.box(2.2, 0.9, 1.4, 0x141014, x, 0.55, z, { rotY: g, rough: 0.2, metal: 0.1 });
  b.box(1.2, 0.1, 0.5, 0xf4f0e8, x, 1.0, z + Math.cos(g) * 0.2, { rotY: g, collide: false, cast: false, rough: 0.3 });
  b.box(2.0, 1.0, 0.12, 0x141014, x, 1.4, z - Math.cos(g) * 0.6, { rotY: g, collide: false, rough: 0.2 });
  [[0.9, 0.5], [-0.9, 0.5], [0.9, -0.5], [-0.9, -0.5]].forEach((p) => b.box(0.1, 0.55, 0.1, 0x141014, x + p[0], 0.27, z + p[1], { collide: false }));
}
function lampPost(b, x, z, color, realLight) {
  b.cyl(0.1, 1.6, 0x4a3f33, x, 0.8, z, { collide: true, rough: 0.5 });
  b.cyl(0.34, 0.5, color, x, 1.75, z, { r2: 0.22, collide: false, cast: false, emissive: color, emissiveI: realLight === false ? 0.9 : 0.5, rough: 0.4 });
  if (realLight === false) return null;
  const light = new THREE.PointLight(0xfff0d0, 9, 9, 2); light.position.set(x, 1.7, z); b.group.add(light);
  return light;
}
function bed(b, x, z, color) {
  b.box(2.4, 0.5, 3.2, 0x6b4e3a, x, 0.4, z, { rough: 0.5, tex: TEX.wood(0x6b4e3a, 4), rep: 2 });
  b.box(2.2, 0.35, 3.0, color, x, 0.74, z, { collide: false, rough: 0.95, tex: TEX.carpet(color), rep: 1 });
  b.box(2.2, 0.5, 0.7, 0xf3ece0, x, 0.9, z - 1.1, { collide: false, rough: 0.95 });
  b.box(0.2, 1.6, 3.2, 0x5a4030, x, 0.8, z - 1.6, { collide: false, rough: 0.5 }); // headboard
}

// =========================== MANSION ===========================
function buildMansion() {
  const b = new Builder();
  const r = rng(7);
  const WALL_H = 5;
  const X = 24, Z = 20;
  const wallCol = 0xece1cf;
  const woodFloorT = TEX.wood(0xb78a5e, 6);
  const wallT = TEX.wallpaper(wallCol, true);

  const _anim = [];

  // ---- exterior shell ----
  b.box(X * 2, WALL_H, 0.6, wallCol, 0, WALL_H / 2, -Z, { rough: 0.96, tex: wallT, rep: X });
  b.box(X * 2, WALL_H, 0.6, wallCol, 0, WALL_H / 2, Z, { rough: 0.96, tex: wallT, rep: X });
  b.box(0.6, WALL_H, Z * 2, wallCol, -X, WALL_H / 2, 0, { rough: 0.96, tex: wallT, rep: Z });
  b.box(0.6, WALL_H, Z * 2, wallCol, X, WALL_H / 2, 0, { rough: 0.96, tex: wallT, rep: Z });
  // baseboards
  [[-Z, true], [Z, true]].forEach((p) => b.box(X * 2, 0.3, 0.7, 0x6b5a44, 0, 0.15, p[0], { collide: false, cast: false, rough: 0.5 }));

  // ---- interior walls forming a 3x3 plan with door gaps ----
  // vertical walls at x=-8 and x=8
  b.wallWithGaps(false, -8, -Z, Z, [[0, 4], [-13.5, 3], [13.5, 3]], WALL_H, wallCol, wallT);
  b.wallWithGaps(false, 8, -Z, Z, [[0, 4], [-13.5, 3], [13.5, 3]], WALL_H, wallCol, wallT);
  // horizontal walls at z=-7 and z=7
  b.wallWithGaps(true, -7, -X, X, [[0, 4], [-16, 3], [16, 3]], WALL_H, wallCol, wallT);
  b.wallWithGaps(true, 7, -X, X, [[0, 4], [-16, 3], [16, 3]], WALL_H, wallCol, wallT);

  // cell centres
  const CX = [-16, 0, 16], CZ = [-13.5, 0, 13.5];

  // ===== CENTER: GRAND HALL (landmark) =====
  b.plane(16, 14, 0xe8e0d0, 0, 0, 0, { tex: TEX.marble(0xe8e0d0, 0x9a8f7a), rep: 3, rough: 0.25, metal: 0.05 });
  rug(b, 0, 2, 0x7a2f3a, 7, 5);
  const chand = chandelier(b, 0, 4.6, 0); _anim.push(chand);
  const fire = fireplace(b, 0, -6.6, 0); _anim.push(fire);
  staircase(b, 13.5, 0, 0x8a6a44); // grand stair against east-ish (within hall corridor sense)
  // hall accents
  b.cyl(0.4, 3.6, 0xdcd2bf, -6.5, 1.8, -5.5, { collide: true, rough: 0.4 }); // column
  b.cyl(0.4, 3.6, 0xdcd2bf, 6.5, 1.8, -5.5, { collide: true, rough: 0.4 });
  b.cyl(0.55, 0.3, 0xcaa45a, -6.5, 3.7, -5.5, { collide: false, rough: 0.3, metal: 0.6 });
  b.cyl(0.55, 0.3, 0xcaa45a, 6.5, 3.7, -5.5, { collide: false, rough: 0.3, metal: 0.6 });
  painting(b, 0, 3.4, -6.95, 0, 1.6, 1.1, 0x35506b);
  // hall ceiling medallion (partial ceiling for the chandelier)
  b.cyl(3.2, 0.25, 0xf0e8d8, 0, 4.95, 0, { collide: false, cast: false, rough: 0.7 });

  // ===== NORTH room (z=-13.5): LIBRARY =====
  b.plane(14, 11, 0x9c7b95, 0, 0, -13.5, { tex: TEX.wood(0x8a6f86, 6), rep: 4, rough: 0.45 });
  rug(b, 0, -13.5, 0x3a2f5a, 8, 6);
  shelf(b, -5, -18.5, 0x5a4434, 0, TEX.wood(0x5a4434, 4));
  shelf(b, 0, -18.5, 0x5a4434, 0, TEX.wood(0x5a4434, 4));
  shelf(b, 5, -18.5, 0x5a4434, 0, TEX.wood(0x5a4434, 4));
  table(b, -3.5, -12, 0x5a4068, 0x3a2a44, TEX.wood(0x5a4068, 3));
  chair(b, -3.5, -10.6, 0x6a5078, Math.PI);
  b.box(1.0, 1.1, 1.0, 0x9b59b6, 3.5, 0.55, -12, { collide: true, rough: 0.9 }); // armchair
  plant(b, 6, -10);
  windowGlow(b, -10, 2.6, -19.7, 0, 2, 2.2);
  windowGlow(b, 10, 2.6, -19.7, 0, 2, 2.2);
  _anim.push({ m: lightShaft(b, -9, -16, 0.3), update() {} });

  // ===== SOUTH room (z=13.5): LIVING ROOM =====
  b.plane(14, 11, 0xb78a5e, 0, 0, 13.5, { tex: woodFloorT, rep: 5, rough: 0.4 });
  rug(b, 0, 13.5, 0x9c5b3b, 8, 6);
  sofa(b, -4, 13.5, 0x3f6d7c, Math.PI / 2, TEX.carpet(0x3f6d7c));
  sofa(b, 0, 17.5, 0x3f6d7c, 0, TEX.carpet(0x3f6d7c));
  table(b, 0, 13.5, 0x8a5a36, 0x5e3d24, TEX.wood(0x8a5a36, 3));
  b.box(2.6, 1.0, 0.5, 0x2a2a32, 4.5, 0.5, 18.4, { rough: 0.4 }); // TV unit
  b.box(3.0, 1.7, 0.16, 0x0a0a10, 4.5, 1.9, 18.7, { collide: false, rough: 0.15, metal: 0.5, emissive: 0x101820, emissiveI: 0.6 });
  plant(b, -6, 18);
  lampPost(b, 6, 9, 0xffd98a);
  painting(b, -3, 3.0, 19.7, Math.PI, 1.4, 1.0, 0x6b8c4a);

  // ===== EAST room (x=16): KITCHEN / DINING =====
  b.plane(13, 11, 0xd9cbb2, 16, 0, 0, { tex: TEX.tile(0xe6ddcb, 0xbcaf96, 5), rep: 4, rough: 0.3, metal: 0.05 });
  b.box(6, 1.0, 1.0, 0xeae3d4, 19, 0.5, -5.5, { rough: 0.4 });
  b.box(6, 0.12, 1.0, 0x2f2a26, 19, 1.06, -5.5, { collide: false, rough: 0.2, metal: 0.3 });
  b.box(1.3, 1.9, 1.0, 0xced4da, 22.6, 0.95, -5.5, { rough: 0.25, metal: 0.4 }); // fridge
  table(b, 15, 1, 0xb98b54, 0x7a5a34, TEX.wood(0xb98b54, 3));
  chair(b, 15, 2.6, 0x8a6a3a, Math.PI); chair(b, 15, -0.6, 0x8a6a3a, 0); chair(b, 13.6, 1, 0x8a6a3a, -Math.PI / 2); chair(b, 16.4, 1, 0x8a6a3a, Math.PI / 2);
  b.sphere(0.18, 0xe8483b, 15, 1.05, 1, { collide: false, cast: false }); b.sphere(0.18, 0xffc23c, 15.4, 1.05, 0.8, { collide: false, cast: false }); b.sphere(0.18, 0x8ac24a, 14.7, 1.05, 1.3, { collide: false, cast: false });
  lampPost(b, 20, 5, 0xfff0c0);
  windowGlow(b, 23.7, 2.6, -2, Math.PI / 2, 2, 2.2);

  // ===== WEST room (x=-16): BEDROOM =====
  b.plane(13, 11, 0xc98f86, -16, 0, 0, { tex: TEX.wood(0xb07f76, 6), rep: 4, rough: 0.45 });
  rug(b, -16, 0, 0xb0617a, 8, 6);
  bed(b, -18, 1, 0xe88fb0);
  b.box(1.2, 1.2, 0.6, 0xb98b54, -13, 0.6, -4, { rough: 0.4, tex: TEX.wood(0xb98b54, 3) }); // dresser
  b.box(1.6, 2.4, 0.7, 0x7a5a34, -22, 1.2, 4.5, { rough: 0.45, tex: TEX.wood(0x7a5a34, 3) }); // wardrobe
  plant(b, -12, 4);
  lampPost(b, -13, -4, 0xffc6da, false);
  windowGlow(b, -23.7, 2.6, 2, Math.PI / 2, 2, 2.2);

  // ===== CORNER NOOKS =====
  // NW conservatory (plants)
  b.plane(11, 9, 0xa9b48a, -16, 0, -13.5, { tex: TEX.tile(0xb9c49a, 0x8a9670, 4), rep: 3, rough: 0.4 });
  plant(b, -19, -16); plant(b, -13, -17); plant(b, -16, -11); plant(b, -20, -11);
  b.box(2, 0.5, 1, 0x8a7766, -16, 0.25, -16, { rough: 0.6 });
  windowGlow(b, -23.7, 2.6, -14, Math.PI / 2, 2, 2.4);
  // NE study
  b.plane(11, 9, 0x8a6f5a, 16, 0, -13.5, { tex: TEX.wood(0x8a6f5a, 6), rep: 3, rough: 0.45 });
  table(b, 16, -13.5, 0x5a4434, 0x3a2a22, TEX.wood(0x5a4434, 3)); chair(b, 16, -12, 0x6a5444, Math.PI);
  shelf(b, 19, -17.5, 0x5a4434, 0, TEX.wood(0x5a4434, 4));
  b.box(0.6, 0.4, 0.4, 0x2a3550, 16, 1.0, -13.5, { collide: false, cast: false }); // typewriter-ish
  painting(b, 16, 3.0, -19.7, 0, 1.2, 1.4, 0x7a3550);
  // SW music room (piano)
  b.plane(11, 9, 0x6f5a6a, -16, 0, 13.5, { tex: TEX.wood(0x6f5a6a, 6), rep: 3, rough: 0.4 });
  rug(b, -16, 13.5, 0x4a3550, 6, 5);
  piano(b, -17, 13.5, 0.4);
  b.box(0.5, 0.5, 0.5, 0x141014, -14, 0.5, 12, { collide: false }); // stool
  lampPost(b, -13, 17, 0xe0c0ff, false);
  // SE games / dining alt
  b.plane(11, 9, 0xa07a5a, 16, 0, 13.5, { tex: TEX.wood(0xa07a5a, 6), rep: 3, rough: 0.45 });
  rug(b, 16, 13.5, 0x355a4a, 6, 5);
  table(b, 16, 13.5, 0x2f5a3a, 0x1f3a26, TEX.carpet(0x2f5a3a)); // pool/green table
  chair(b, 13.5, 13.5, 0x6a5444, -Math.PI / 2); chair(b, 18.5, 13.5, 0x6a5444, Math.PI / 2);
  plant(b, 20, 17);
  windowGlow(b, 23.7, 2.6, 14, Math.PI / 2, 2, 2.2);

  // scattered colourful crates / cover across hall corridors (camo cover)
  const crateCol = [0xe8483b, 0x3a7bd5, 0xffc23c, 0x2ec4a6, 0x9b59b6, 0xff8a3d];
  const crateSpots = [[-6, 9], [6, -9], [10, 8], [-10, -8], [4, 4], [-4, -4]];
  crateSpots.forEach((p, i) => { const s = 0.9 + r() * 0.7; b.box(s, s, s, crateCol[i % crateCol.length], p[0], s / 2, p[1], { rough: 0.7, tex: TEX.wood(crateCol[i % crateCol.length], 4), rep: 1 }); });

  const spawns = [
    new THREE.Vector3(-3, 0, 13.5), new THREE.Vector3(15, 0, -2),
    new THREE.Vector3(0, 0, -15), new THREE.Vector3(-18, 0, 2),
    new THREE.Vector3(-16, 0, 14), new THREE.Vector3(16, 0, 14)
  ];

  return finalize(b, {
    mood: 'cozy', bounds: { minX: -X + 1, maxX: X - 1, minZ: -Z + 1, maxZ: Z - 1 },
    spawns, hunterSpawn: new THREE.Vector3(0, 0, 5), _anim,
    apply(scene, renderer, engine) {
      scene.background = makeGradientTex(0x241b26, 0x4a3340);
      scene.fog = new THREE.FogExp2(0x2a2030, 0.015);
      const hemi = new THREE.HemisphereLight(0xffe9cf, 0x2a2030, 0.55); scene.add(hemi); this._lights.push(hemi);
      const key = new THREE.DirectionalLight(0xffe2b8, 1.15);
      key.position.set(16, 26, 12); key.castShadow = true;
      key.shadow.mapSize.set(renderer.shadowMap.enabled ? 2048 : 1024, 2048);
      key.shadow.camera.near = 1; key.shadow.camera.far = 90;
      key.shadow.camera.left = -30; key.shadow.camera.right = 30; key.shadow.camera.top = 30; key.shadow.camera.bottom = -30;
      key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
      scene.add(key); scene.add(key.target); this._lights.push(key, key.target); this.sun = key;
      const fill = new THREE.DirectionalLight(0x9ab0ff, 0.25); fill.position.set(-14, 12, -10); scene.add(fill); this._lights.push(fill);
      const pmrem = new THREE.PMREMGenerator(renderer); this._env = pmrem.fromScene(new RoomEnvironment(), 0.04);
      scene.environment = this._env.texture; pmrem.dispose();
      this._motes = dustMotes(scene, 0, 2.4, 0, 40); this._anim2 = this._motes.update;
    },
    update(dt, t) { this._anim.forEach((a) => a.update && a.update(dt, t)); if (this._anim2) this._anim2(dt, t); }
  });
}

// =========================== GARDEN ===========================
function buildGarden() {
  const b = new Builder();
  const r = rng(21); const X = 26, Z = 26;
  const _anim = [];
  b.plane(X * 2, Z * 2, 0x5fae3f, 0, 0, 0, { tex: TEX.grass(0x5fae3f), rep: 16, rough: 1, bumpScale: 0.02 });
  // gentle terrain mounds (visual)
  for (let i = 0; i < 6; i++) { const x = (r() - 0.5) * 40, z = (r() - 0.5) * 40; b.sphere(2 + r() * 2, 0x66b545, x, -1.4, z, { rough: 1, cast: false }); }
  // stone path cross
  b.plane(3, Z * 2, 0xb7ad97, 0, 0.02, 0, { tex: TEX.tile(0xc3b99f, 0x8f8670, 6), rep: 8, rough: 0.8 });
  b.plane(X * 2, 3, 0xb7ad97, 0, 0.02, 0, { tex: TEX.tile(0xc3b99f, 0x8f8670, 6), rep: 8, rough: 0.8 });
  // hedges
  const hedge = 0x3f8f43;
  [[0, -Z, X * 2, 1], [0, Z, X * 2, 1], [-X, 0, 1, Z * 2], [X, 0, 1, Z * 2]].forEach((h) => b.box(h[2], 2.0, h[3], hedge, h[0], 1.0, h[1], { rough: 0.95, tex: TEX.carpet(hedge), rep: 4 }));
  // FOUNTAIN landmark (center)
  b.cyl(2.4, 0.6, 0xc7bda3, 0, 0.3, 0, { collide: true, rough: 0.7 });
  b.cyl(2.0, 0.3, 0x4a90c2, 0, 0.55, 0, { collide: false, cast: false, rough: 0.1, metal: 0.2, emissive: 0x1a4060, emissiveI: 0.3 });
  b.cyl(0.3, 1.4, 0xc7bda3, 0, 1.1, 0, { collide: true, rough: 0.7 });
  b.sphere(0.45, 0x6ab0d8, 0, 1.9, 0, { collide: false, cast: false, rough: 0.1, emissive: 0x2a6080, emissiveI: 0.4 });
  _anim.push(fountainSpray(b, 0, 2.0, 0));
  // trees
  const treeSpots = [[-14, -14], [14, -13], [-15, 13], [15, 14], [-8, 16], [10, -17]];
  treeSpots.forEach((p) => {
    b.cyl(0.4, 2.6, 0x6b4a2e, p[0], 1.3, p[1], { collide: true, r2: 0.5, rough: 0.8 });
    b.sphere(1.8, 0x3f9d54, p[0], 3.4, p[1], { rough: 0.95 });
    b.sphere(1.3, 0x4cb364, p[0] + 1, 3.9, p[1] - 0.6, { rough: 0.95 });
    b.sphere(1.2, 0x357f44, p[0] - 0.9, 3.7, p[1] + 0.7, { rough: 0.95 });
  });
  // flower beds (colourful camo cover)
  const cols = [0xe8483b, 0x3a7bd5, 0xffc23c, 0xff8a3d, 0x9b59b6, 0x2ec4a6, 0xf25c9a];
  for (let i = 0; i < 18; i++) {
    const x = (r() - 0.5) * (X * 2 - 8), z = (r() - 0.5) * (Z * 2 - 8);
    if (Math.hypot(x, z) < 5) continue;
    if (r() < 0.5) { b.sphere(0.45 + r() * 0.4, cols[i % cols.length], x, 0.4, z, { rough: 0.85 }); b.cyl(0.06, 0.5, 0x3f8f43, x, 0.25, z, { collide: false, cast: false }); }
    else { const s = 1 + r() * 1.6; b.box(s, s * (0.7 + r()), s, cols[i % cols.length], x, s / 2, z, { rough: 0.7, tex: TEX.wood(cols[i % cols.length], 4), rep: 1 }); }
  }
  // benches
  b.box(2, 0.4, 0.6, 0x7a5a3a, -6, 0.5, -3, { rough: 0.6 }); b.box(2, 0.4, 0.6, 0x7a5a3a, 6, 0.5, 3, { rough: 0.6 });

  const spawns = [new THREE.Vector3(-14, 0, -14), new THREE.Vector3(14, 0, -13), new THREE.Vector3(-15, 0, 13), new THREE.Vector3(15, 0, 14), new THREE.Vector3(0, 0, -16), new THREE.Vector3(0, 0, 16)];
  return finalize(b, {
    mood: 'sunny', bounds: { minX: -X + 1.5, maxX: X - 1.5, minZ: -Z + 1.5, maxZ: Z - 1.5 },
    spawns, hunterSpawn: new THREE.Vector3(0, 0, 8), _anim,
    apply(scene, renderer) {
      scene.background = makeGradientTex(0x9fd4ff, 0xe9f6ff);
      scene.fog = new THREE.Fog(0xbfe2ff, 44, 110);
      const hemi = new THREE.HemisphereLight(0xeaf6ff, 0x4f7a3a, 0.85); scene.add(hemi); this._lights.push(hemi);
      const sun = new THREE.DirectionalLight(0xfff4e0, 2.0); sun.position.set(22, 34, 14); sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.near = 1; sun.shadow.camera.far = 110;
      sun.shadow.camera.left = -34; sun.shadow.camera.right = 34; sun.shadow.camera.top = 34; sun.shadow.camera.bottom = -34; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
      scene.add(sun); scene.add(sun.target); this._lights.push(sun, sun.target); this.sun = sun;
      const pmrem = new THREE.PMREMGenerator(renderer); this._env = pmrem.fromScene(new RoomEnvironment(), 0.04);
      scene.environment = this._env.texture; pmrem.dispose();
    },
    update(dt, t) { this._anim.forEach((a) => a.update && a.update(dt, t)); }
  });
}

// =========================== TOY ROOM (Toy Story style) ===========================
// Giant kid's bedroom seen from a tiny toy's-eye view: oversized furniture and a
// floor full of colourful building blocks, crayons and toys to blend into.
function toyBlock(b, x, z, color, size, rotY) {
  const s = size || 1.6;
  b.box(s, s, s, color, x, s / 2, z, { rotY: rotY || 0, rough: 0.45, tex: TEX.wood(color, 4), rep: 1 });
}
function bigBed(b, x, z, blanket) {
  b.box(11, 1.4, 7, 0x8a5a36, x, 0.7, z, { rough: 0.5, tex: TEX.wood(0x8a5a36, 5), rep: 3 });        // frame
  b.box(10.4, 1.0, 6.6, 0xf2efe6, x, 1.7, z, { collide: false, rough: 0.9 });                          // mattress
  b.box(10.4, 0.7, 4.4, blanket, x, 2.3, z + 1.0, { collide: false, rough: 0.95, tex: TEX.stripes(blanket, 0xffffff, 7), rep: 2 }); // blanket
  b.box(4.2, 1.0, 1.8, 0xfff4e8, x - 2.5, 2.4, z - 2.2, { collide: false, rough: 0.95 });              // pillow
  b.box(4.2, 1.0, 1.8, 0xeef4ff, x + 2.5, 2.4, z - 2.2, { collide: false, rough: 0.95 });
  b.box(11, 3.2, 0.6, 0x6f4a2c, x, 1.6, z - 3.6, { rough: 0.5, tex: TEX.wood(0x6f4a2c, 4), rep: 4 });  // headboard
  // legs raise it so toys can scoot under
  [[5, 3], [-5, 3], [5, -3], [-5, -3]].forEach((p) => b.box(0.7, 1.4, 0.7, 0x5a3c22, x + p[0], 0.7, z + p[1], { collide: false }));
}
function toyChest(b, x, z) {
  b.box(5, 3, 3.4, 0xd84b4b, x, 1.5, z, { rough: 0.4, tex: TEX.wood(0xd84b4b, 4), rep: 2 });
  b.box(5.2, 0.6, 3.6, 0xb83a3a, x, 3.2, z, { collide: false, rough: 0.4 });                            // lid lip
  // toys spilling out (colourful camo cover)
  const cols = [0x2f7fd8, 0xf2c33c, 0x4fbf5a, 0x9b5bd0, 0xf08a3d];
  for (let i = 0; i < 5; i++) b.sphere(0.5 + Math.random() * 0.4, cols[i], x + (Math.random() - 0.5) * 4, 0.6, z + 2.4 + Math.random() * 1.5, { rough: 0.5 });
}
function bookshelfBig(b, x, z, rotY) {
  b.box(6, 7, 1.6, 0x7a5a3a, x, 3.5, z, { rotY, rough: 0.5, tex: TEX.wood(0x7a5a3a, 5), rep: 2 });
  const cols = [0xd84b4b, 0x4b7bd8, 0xe6b93c, 0x53c08a, 0xb066c9, 0xe87fb0, 0xf08a3d, 0x36b3a8];
  const dx = Math.cos(rotY || 0), dz = -Math.sin(rotY || 0);
  for (let r = 0; r < 4; r++) for (let i = 0; i < 7; i++) {
    const hh = 1.0 + Math.random() * 0.5;
    b.box(0.5 + Math.random() * 0.2, hh, 1.0, cols[(r * 7 + i) % cols.length], x - dx * 2.3 + dx * i * 0.72, 1.0 + r * 1.6 + hh / 2 - 0.5, z - dz * 2.3 + dz * i * 0.72, { rotY, collide: false, cast: false });
  }
}
function bigDesk(b, x, z) {
  b.box(8, 0.5, 4, 0xb98b54, x, 3.4, z, { rough: 0.4, tex: TEX.wood(0xb98b54, 4), rep: 2 });
  [[3.4, 1.6], [-3.4, 1.6], [3.4, -1.6], [-3.4, -1.6]].forEach((p) => b.box(0.5, 3.4, 0.5, 0x8a6a3a, x + p[0], 1.7, z + p[1], { collide: false }));
  b.box(2.4, 1.6, 1.6, 0xe8e8ee, x - 2, 4.5, z, { collide: false, rough: 0.3, metal: 0.1 });           // monitor/box
  // pencil cup + crayons (colourful)
  const cray = [0xe23b3b, 0x2f7fd8, 0xf2c33c, 0x4fbf5a, 0xf08a3d, 0x9b5bd0];
  cray.forEach((c, i) => b.cyl(0.16, 1.4, c, x + 1.6 + (i % 3) * 0.42, 4.35, z - 0.6 + Math.floor(i / 3) * 0.42, { collide: false, cast: false, seg: 8 }));
  b.box(2.6, 0.08, 1.8, 0xffffff, x + 1.6, 3.66, z + 0.8, { collide: false, cast: false, rough: 0.9 }); // paper
}
function crayonPile(b, x, z) {
  const cray = [0xe23b3b, 0x2f7fd8, 0xf2c33c, 0x4fbf5a, 0xf08a3d, 0x9b5bd0, 0xe87fb0];
  for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; b.cyl(0.22, 2.2, cray[i], x + Math.cos(a) * 0.5, 0.22, z + Math.sin(a) * 0.5, { collide: false, cast: true, seg: 8, rotY: a }); }
}
function beachBall(b, x, z) {
  // colourful striped ball (use vertex-less coloured spheres stacked)
  const cols = [0xe23b3b, 0xf2c33c, 0x4fbf5a, 0x2f7fd8];
  b.sphere(1.6, 0xffffff, x, 1.6, z, { rough: 0.3 });
  cols.forEach((c, i) => { const s = b.sphere(1.62, c, x, 1.6, z, { rough: 0.3 }); s.scale.x = 0.18; s.rotation.y = i / cols.length * Math.PI; });
  b.collide(x, z, 3.2, 3.2, 0, 3.2);
}
function rocketToy(b, x, z) { // landmark
  b.cyl(1.2, 5, 0xe6e9ef, x, 2.5, z, { collide: true, rough: 0.4, metal: 0.2 });
  b.cyl(0.01, 2.2, 0xe23b3b, x, 6.0, z, { r2: 1.2, collide: false, rough: 0.4 });                       // nose cone
  b.box(0.5, 1.4, 2.4, 0xe23b3b, x, 0.9, z, { collide: false, rough: 0.4 });                            // fin
  b.box(2.4, 1.4, 0.5, 0xe23b3b, x, 0.9, z, { collide: false, rough: 0.4 });
  b.sphere(0.6, 0x8fd0ff, x, 3.4, z + 1.1, { collide: false, rough: 0.1, metal: 0.3, emissive: 0x3a6a8a, emissiveI: 0.4 }); // porthole
}
function dresserBig(b, x, z, rotY) {
  b.box(5, 5, 2.6, 0x8a6a44, x, 2.5, z, { rotY, rough: 0.45, tex: TEX.wood(0x8a6a44, 4), rep: 2 });
  const dx = Math.cos(rotY || 0), dz = -Math.sin(rotY || 0);
  for (let r = 0; r < 3; r++) b.box(4.2, 1.1, 0.2, 0x6f4a2c, x + dz * 1.3, 1.0 + r * 1.5, z + dx * 1.3, { rotY, collide: false, cast: false });
}
function poster(b, x, y, z, rotY, w, h, col) {
  b.box(w + 0.1, h + 0.1, 0.06, 0xffffff, x, y, z, { rotY, collide: false, cast: false, rough: 0.5 });
  b.box(w, h, 0.04, col, x + Math.sin(rotY) * 0.04, y, z + Math.cos(rotY) * 0.04, { rotY, collide: false, cast: false, emissive: col, emissiveI: 0.12, rough: 0.4 });
}
function bigWindow(b, x, y, z, rotY, w, h) {
  b.box(w + 0.8, h + 0.8, 0.5, 0xf2ede2, x, y, z, { rotY, collide: false, cast: false, rough: 0.6 });
  b.box(w, h, 0.1, 0xbfe6ff, x + Math.sin(rotY) * 0.1, y, z + Math.cos(rotY) * 0.1, { rotY, collide: false, cast: false, emissive: 0xcfeeff, emissiveI: 0.9, rough: 0.1 });
  b.box(w, 0.15, 0.14, 0xf2ede2, x, y, z, { rotY, collide: false, cast: false });
  b.box(0.15, h, 0.14, 0xf2ede2, x, y, z, { rotY, collide: false, cast: false });
  // curtains
  const dx = Math.cos(rotY), dz = -Math.sin(rotY);
  b.box(1.2, h + 1.4, 0.3, 0xe2739a, x - dx * (w / 2 + 0.4), y, z - dz * (w / 2 + 0.4), { rotY, collide: false, cast: false, rough: 0.95, tex: TEX.stripes(0xe2739a, 0xf0a0bd, 8), rep: 2 });
  b.box(1.2, h + 1.4, 0.3, 0xe2739a, x + dx * (w / 2 + 0.4), y, z + dz * (w / 2 + 0.4), { rotY, collide: false, cast: false, rough: 0.95, tex: TEX.stripes(0xe2739a, 0xf0a0bd, 8), rep: 2 });
}
function toyTrain(b, cx, cz, R) {
  const grp = new THREE.Group(); b.group.add(grp);
  const cars = [];
  const cols = [0xe23b3b, 0xf2c33c, 0x2f7fd8];
  for (let i = 0; i < 3; i++) {
    const car = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.9, 0.9), b.mat(cols[i], 0.4)); body.position.y = 0.5; body.castShadow = true; car.add(body);
    if (i === 0) { const cab = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.9), b.mat(cols[i], 0.4)); cab.position.set(-0.3, 1.1, 0); car.add(cab); const ch = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.6, 8), b.mat(0x333, 0.5)); ch.position.set(0.5, 1.1, 0); ch.rotation.x = Math.PI / 2; car.add(ch); }
    [-0.4, 0.4].forEach((wx) => [-0.45, 0.45].forEach((wz) => { const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.1, 10), b.mat(0x222, 0.4)); wh.rotation.x = Math.PI / 2; wh.position.set(wx, 0.22, wz); car.add(wh); }));
    grp.add(car); cars.push(car);
  }
  return { update(dt, t) { for (let i = 0; i < cars.length; i++) { const a = t * 0.35 - i * (1.6 / R); const x = cx + Math.cos(a) * R, z = cz + Math.sin(a) * R; cars[i].position.set(x, 0, z); cars[i].rotation.y = -a + Math.PI / 2; } } };
}
function mobile(b, x, y, z) {
  const grp = new THREE.Group(); grp.position.set(x, y, z); b.group.add(grp);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(3, 0.08, 0.08), b.mat(0x8a6a3a, 0.6)); grp.add(bar);
  const bar2 = bar.clone(); bar2.rotation.y = Math.PI / 2; grp.add(bar2);
  const shapes = [0xe23b3b, 0xf2c33c, 0x4fbf5a, 0x2f7fd8];
  const hang = [];
  [[1.4, 0], [-1.4, 0], [0, 1.4], [0, -1.4]].forEach((p, i) => {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 10), b.mat(shapes[i], 0.4)); s.position.set(p[0], -1, p[1]); grp.add(s); hang.push(s);
  });
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.5, 6), b.mat(0xaaaaaa, 0.5)); cord.position.y = 0.75; grp.add(cord);
  return { update(dt, t) { grp.rotation.y = t * 0.4; hang.forEach((s, i) => s.position.y = -1 + Math.sin(t * 1.5 + i) * 0.1); } };
}

function buildToyRoom() {
  const b = new Builder();
  const r = rng(99);
  const X = 26, Z = 22, WALL_H = 9;
  const _anim = [];
  const wallT = TEX.stars(0xbfe0f0, 0xffffff);

  // floor (warm wood) + big play mat in the centre
  b.plane(X * 2, Z * 2, 0xc89b6a, 0, 0, 0, { tex: TEX.wood(0xc89b6a, 10), rep: 10, rough: 0.5 });
  b.plane(18, 14, 0x6fbf4a, 0, 0.02, 2, { tex: TEX.playmat(), rep: 1, rough: 0.95 });

  // walls (tall, pastel with stars) + skirting
  b.box(X * 2, WALL_H, 0.6, 0xbfe0f0, 0, WALL_H / 2, -Z, { rough: 0.9, tex: wallT, rep: 6 });
  b.box(X * 2, WALL_H, 0.6, 0xbfe0f0, 0, WALL_H / 2, Z, { rough: 0.9, tex: wallT, rep: 6 });
  b.box(0.6, WALL_H, Z * 2, 0xbfe0f0, -X, WALL_H / 2, 0, { rough: 0.9, tex: wallT, rep: 6 });
  b.box(0.6, WALL_H, Z * 2, 0xbfe0f0, X, WALL_H / 2, 0, { rough: 0.9, tex: wallT, rep: 6 });
  [[-Z, true], [Z, true]].forEach((p) => b.box(X * 2, 0.6, 0.7, 0xffffff, 0, 0.3, p[0], { collide: false, cast: false, rough: 0.6 }));

  // furniture around the room
  bigBed(b, -16, -13, 0x4f9dd8);
  bookshelfBig(b, 22, -10, Math.PI / 2);
  bigDesk(b, 17, 14);
  b.box(2.4, 2.4, 2.4, 0x8a6a3a, 14, 1.2, 11, { collide: true }); // desk chair seat block (giant stool)
  toyChest(b, -18, 12);
  dresserBig(b, 0, -19, 0);
  rocketToy(b, 9, -14);                                  // landmark
  beachBall(b, -3, 14);
  crayonPile(b, 6, 6);
  crayonPile(b, -10, -2);
  // nightstand + alarm clock by the bed
  b.box(2.6, 2.6, 2.6, 0x9b6a44, -22, 1.3, -16, { rough: 0.5 });
  b.box(1, 0.7, 0.5, 0xe23b3b, -22, 2.9, -16, { collide: false, cast: false, emissive: 0x3a0a0a, emissiveI: 0.3 });

  // posters + a big window on the walls
  poster(b, -6, 5.5, -21.6, 0, 4, 5, 0xe6b93c);
  poster(b, 4, 5.5, -21.6, 0, 4, 5, 0x4fbf5a);
  poster(b, -21.6, 5.5, 4, Math.PI / 2, 4, 5, 0xe2739a);
  bigWindow(b, 21.6, 5.0, -2, -Math.PI / 2, 7, 6);

  // hanging mobile over the bed + a toy train looping on the mat
  _anim.push(mobile(b, -16, 8.4, -13));
  _anim.push(toyTrain(b, 0, 3, 6.5));

  // a SEA of colourful building blocks — the main camouflage cover
  const blockCols = [0xe23b3b, 0x2f7fd8, 0xf2c33c, 0x4fbf5a, 0xf08a3d, 0x9b5bd0, 0xe87fb0, 0x36b3a8];
  const blockSpots = [
    [-8, 4], [-6, 7], [10, 2], [12, 5], [4, -4], [-2, -6], [7, -7], [-12, 6], [14, -3],
    [2, 9], [-5, 11], [18, 6], [-14, 0], [16, -8], [0, -10], [-9, -9], [11, 9], [5, 13]
  ];
  blockSpots.forEach((p, i) => { if (Math.hypot(p[0], p[1] - 2) < 3) return; toyBlock(b, p[0], p[1], blockCols[i % blockCols.length], 1.3 + r() * 0.9, r() * Math.PI); });
  // a few stacked-block towers (cover + verticality)
  [[-6, -12], [13, 12], [20, 2]].forEach((p) => { for (let k = 0; k < 3; k++) toyBlock(b, p[0] + k * 0.2, p[1], blockCols[(k + p[0]) & 7], 1.5, k * 0.4); });

  const spawns = [
    new THREE.Vector3(-10, 0, 4), new THREE.Vector3(8, 0, 6), new THREE.Vector3(-4, 0, -6),
    new THREE.Vector3(14, 0, -4), new THREE.Vector3(-14, 0, -6), new THREE.Vector3(4, 0, 12)
  ];

  return finalize(b, {
    mood: 'toybox', castScale: { hiderScale: 0.5, hunterScale: 2.0 },
    bounds: { minX: -X + 1.5, maxX: X - 1.5, minZ: -Z + 1.5, maxZ: Z - 1.5 },
    spawns, hunterSpawn: new THREE.Vector3(0, 0, 8), _anim,
    apply(scene, renderer) {
      scene.background = makeGradientTex(0xbfe6ff, 0xeaf6ff);
      scene.fog = new THREE.Fog(0xdcefff, 60, 130);
      const hemi = new THREE.HemisphereLight(0xffffff, 0xb0c4d8, 0.95); scene.add(hemi); this._lights.push(hemi);
      const sun = new THREE.DirectionalLight(0xfff3df, 1.9); sun.position.set(18, 30, -6); sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.near = 1; sun.shadow.camera.far = 100;
      sun.shadow.camera.left = -34; sun.shadow.camera.right = 34; sun.shadow.camera.top = 34; sun.shadow.camera.bottom = -34; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
      scene.add(sun); scene.add(sun.target); this._lights.push(sun, sun.target); this.sun = sun;
      const warm = new THREE.PointLight(0xfff0d0, 14, 30, 2); warm.position.set(17, 7, 14); scene.add(warm); this._lights.push(warm); // desk lamp
      const pmrem = new THREE.PMREMGenerator(renderer); this._env = pmrem.fromScene(new RoomEnvironment(), 0.04);
      scene.environment = this._env.texture; pmrem.dispose();
      this._motes = dustMotes(scene, 0, 3, 0, 36); this._anim2 = this._motes.update;
    },
    update(dt, t) { this._anim.forEach((a) => a.update && a.update(dt, t)); if (this._anim2) this._anim2(dt, t); }
  });
}

// ---------- shared scene helpers ----------
function makeGradientTex(top, bottom) {
  if (typeof document === 'undefined') return new THREE.Color(bottom);
  const c = document.createElement('canvas'); c.width = 8; c.height = 256;
  const g = c.getContext('2d'); const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#' + ('000000' + top.toString(16)).slice(-6));
  grad.addColorStop(1, '#' + ('000000' + bottom.toString(16)).slice(-6));
  g.fillStyle = grad; g.fillRect(0, 0, 8, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.mapping = THREE.EquirectangularReflectionMapping; return t;
}
function dustMotes(scene, x, y, z, n) {
  const pos = new Float32Array(n * 3), seed = [];
  for (let i = 0; i < n; i++) { pos[i * 3] = x + (Math.random() - 0.5) * 40; pos[i * 3 + 1] = 0.5 + Math.random() * 4; pos[i * 3 + 2] = z + (Math.random() - 0.5) * 36; seed.push(Math.random() * 10); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: 0xfff0d0, size: 0.06, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; scene.add(pts);
  return { pts, dispose() { scene.remove(pts); geo.dispose(); mat.dispose(); }, update(dt, t) { const p = geo.attributes.position.array; for (let i = 0; i < n; i++) { p[i * 3 + 1] += Math.sin(t * 0.5 + seed[i]) * 0.002; p[i * 3] += Math.cos(t * 0.3 + seed[i]) * 0.003; } geo.attributes.position.needsUpdate = true; } };
}
function fountainSpray(b, x, y, z) {
  const n = 60, pos = new Float32Array(n * 3), v = [];
  for (let i = 0; i < n; i++) { pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; const a = Math.random() * Math.PI * 2; v.push({ x: Math.cos(a) * (0.4 + Math.random() * 0.5), y: 2 + Math.random() * 2, z: Math.sin(a) * (0.4 + Math.random() * 0.5), life: Math.random() }); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: 0xbfe6ff, size: 0.12, transparent: true, opacity: 0.7, depthWrite: false });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; b.group.add(pts);
  return { pts, update(dt) { const p = geo.attributes.position.array; for (let i = 0; i < n; i++) { const pt = v[i]; pt.life += dt; if (pt.life > 1) { pt.life = 0; p[i * 3] = x; p[i * 3 + 1] = y; p[i * 3 + 2] = z; } p[i * 3] += pt.x * dt; p[i * 3 + 1] += (pt.y - pt.life * 6) * dt; p[i * 3 + 2] += pt.z * dt; } geo.attributes.position.needsUpdate = true; } };
}

function finalize(b, props) {
  return Object.assign({
    group: b.group, colliders: b.colliders, pickables: b.pickables,
    _lights: [], sun: null, _env: null, _motes: null,
    dispose() {
      this._lights.forEach((l) => { if (l.parent) l.parent.remove(l); if (l.dispose) l.dispose(); });
      if (this._motes) this._motes.dispose();
      if (this._env) this._env.dispose && this._env.dispose();
      b.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose()); else o.material.dispose(); } });
    },
    update() {}
  }, props);
}

export const MAPS = [
  { id: 'toyroom', name: 'Toy Room', mood: 'Giant playroom', accent: '#f2c33c', build: buildToyRoom },
  { id: 'mansion', name: 'The Mansion', mood: 'Cozy indoor', accent: '#c98f86', build: buildMansion },
  { id: 'garden', name: 'Sunset Garden', mood: 'Bright outdoor', accent: '#6cbf4a', build: buildGarden }
];
export function buildMap(id) { const m = MAPS.find((x) => x.id === id) || MAPS[0]; return m.build(); }
