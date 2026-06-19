/* ===== Meccha Chameleon — Maps =====
 * Maps are swappable modules. Each build() returns a uniform descriptor:
 *   { group, colliders[], pickables[], spawns[], hunterSpawn, bounds, mood,
 *     apply(scene,renderer,engine), dispose() }
 * The MANSION is the showcase: connected rooms full of colourful furniture to
 * blend into. GARDEN is a lighter outdoor map proving the format is generic.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

function rng(seed) { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }

// shared builder context: registers meshes as pickable + optional collider
class Builder {
  constructor() {
    this.group = new THREE.Group();
    this.colliders = [];
    this.pickables = [];
  }
  mat(color, rough, metal) { return new THREE.MeshStandardMaterial({ color, roughness: rough == null ? 0.8 : rough, metalness: metal || 0 }); }
  box(w, h, d, color, x, y, z, opts) {
    opts = opts || {};
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this.mat(color, opts.rough, opts.metal));
    m.position.set(x, y, z); m.castShadow = opts.cast !== false; m.receiveShadow = true;
    if (opts.rotY) m.rotation.y = opts.rotY;
    this.group.add(m); this.pickables.push(m);
    if (opts.collide !== false) this.collide(x, z, w, d, opts.rotY);
    return m;
  }
  cyl(r, h, color, x, y, z, opts) {
    opts = opts || {};
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, opts.r2 == null ? r : opts.r2, h, opts.seg || 18), this.mat(color, opts.rough, opts.metal));
    m.position.set(x, y, z); m.castShadow = opts.cast !== false; m.receiveShadow = true;
    this.group.add(m); this.pickables.push(m);
    if (opts.collide) this.collide(x, z, r * 2, r * 2);
    return m;
  }
  sphere(r, color, x, y, z, opts) {
    opts = opts || {};
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 14), this.mat(color, opts.rough, opts.metal));
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
    this.group.add(m); this.pickables.push(m); return m;
  }
  collide(x, z, w, d, rotY) {
    // rotated boxes approximated by their bounding extent (good enough for walking)
    let hw = w / 2, hd = d / 2;
    if (rotY) { const c = Math.abs(Math.cos(rotY)), s = Math.abs(Math.sin(rotY)); const nw = w * c + d * s, nd = w * s + d * c; hw = nw / 2; hd = nd / 2; }
    this.colliders.push({ x, z, hw, hd });
  }
}

// ---- FURNITURE prefabs (cute, colourful) ----
function sofa(b, x, z, color, rotY) {
  const g = rotY || 0;
  const dx = Math.cos(g), dz = -Math.sin(g);
  b.box(2.6, 0.5, 1.1, color, x, 0.42, z, { rotY: g });             // base
  b.box(2.6, 0.6, 0.3, color, x - dz * 0.4, 0.8, z - dx * 0.4, { rotY: g, collide: false }); // back
  b.box(0.3, 0.7, 1.1, color, x + dx * 1.15, 0.75, z + dz * 1.15, { rotY: g, collide: false });
  b.box(0.3, 0.7, 1.1, color, x - dx * 1.15, 0.75, z - dz * 1.15, { rotY: g, collide: false });
}
function table(b, x, z, color, legColor) {
  b.box(1.6, 0.16, 1.0, color, x, 0.86, z, { collide: true });
  [[0.7, 0.42], [-0.7, 0.42], [0.7, -0.42], [-0.7, -0.42]].forEach((p) => b.box(0.12, 0.86, 0.12, legColor, x + p[0], 0.43, z + p[1], { collide: false }));
}
function shelf(b, x, z, color, rotY) {
  b.box(2.0, 2.4, 0.5, color, x, 1.2, z, { rotY });
  const booky = [0xd84b4b, 0x4b7bd8, 0xe6b93c, 0x53c08a, 0xb066c9, 0xe87fb0];
  const dx = Math.cos(rotY || 0), dz = -Math.sin(rotY || 0);
  for (let r = 0; r < 3; r++) for (let i = 0; i < 6; i++) {
    b.box(0.18, 0.5, 0.32, booky[(r + i) % booky.length], x - dx * 0.8 + dx * i * 0.32, 0.55 + r * 0.7, z - dz * 0.8 + dz * i * 0.32, { rotY, collide: false, cast: false });
  }
}
function lamp(b, x, z, scene, color) {
  b.cyl(0.12, 1.5, 0x6b5a44, x, 0.75, z, {});
  b.sphere(0.32, color, x, 1.7, z, { rough: 0.4 });
  const light = new THREE.PointLight(0xfff0d0, 8, 9, 2); light.position.set(x, 1.7, z); light.castShadow = false;
  b.group.add(light);
  return light;
}
function plant(b, x, z) {
  b.cyl(0.28, 0.5, 0xc77b4a, x, 0.25, z, { r2: 0.22, collide: true });
  b.sphere(0.55, 0x3f9d54, x, 0.95, z, { rough: 0.9 });
  b.sphere(0.4, 0x4cb364, x + 0.25, 1.2, z - 0.1, { rough: 0.9 });
  b.sphere(0.36, 0x357f44, x - 0.2, 1.15, z + 0.15, { rough: 0.9 });
}
function bed(b, x, z, color) {
  b.box(2.2, 0.5, 3.0, 0x6b4e3a, x, 0.4, z, {});
  b.box(2.0, 0.3, 2.8, color, x, 0.72, z, { collide: false, rough: 0.95 });
  b.box(2.0, 0.45, 0.6, 0xf3ece0, x, 0.85, z - 1.0, { collide: false, rough: 0.95 }); // pillows
}
function rug(b, x, z, color, w, d) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), b.mat(color, 0.95));
  m.rotation.x = -Math.PI / 2; m.position.set(x, 0.02, z); m.receiveShadow = true;
  b.group.add(m); b.pickables.push(m);
}

// =========================== MANSION ===========================
function buildMansion() {
  const b = new Builder();
  const r = rng(7);
  const W = 44, D = 36, WALL_H = 4;
  const half = { w: W / 2, d: D / 2 };

  // floors per zone (warm woods / tiles)
  const zones = [
    { x: -11, z: -9, w: 22, d: 18, color: 0xb78a5e, name: 'living' },   // living room
    { x: 11, z: -9, w: 22, d: 18, color: 0xd9cbb2, name: 'kitchen' },   // kitchen
    { x: -11, z: 9, w: 22, d: 18, color: 0x9c7b95, name: 'library' },   // library/study
    { x: 11, z: 9, w: 22, d: 18, color: 0xc98f86, name: 'bedroom' }     // bedroom
  ];
  zones.forEach((zn) => {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(zn.w, zn.d), b.mat(zn.color, 0.95));
    f.rotation.x = -Math.PI / 2; f.position.set(zn.x, 0, zn.z); f.receiveShadow = true;
    b.group.add(f); b.pickables.push(f);
  });

  // outer walls with shadow-receiving inner faces
  const wallCol = 0xf0e7d8;
  const wallMesh = (w, h, d, x, y, z) => { const m = b.box(w, h, d, wallCol, x, y, z, { rough: 0.92 }); return m; };
  wallMesh(W, WALL_H, 0.6, 0, WALL_H / 2, -half.d);
  wallMesh(W, WALL_H, 0.6, 0, WALL_H / 2, half.d);
  wallMesh(0.6, WALL_H, D, -half.w, WALL_H / 2, 0);
  wallMesh(0.6, WALL_H, D, half.w, WALL_H / 2, 0);

  // interior cross walls with doorways (gaps)
  // vertical divider at x=0 with two door gaps
  const vSeg = [[-half.d + 3.5, 7], [3.5, 7]]; // [centerZ, len]
  vSeg.forEach((s) => wallMesh(0.5, WALL_H, s[1], 0, WALL_H / 2, s[0]));
  // horizontal divider at z=0 with door gaps
  const hSeg = [[-half.w + 4, 8], [4, 8]];
  hSeg.forEach((s) => wallMesh(8, WALL_H, 0.5, s[0], WALL_H / 2, 0));

  // ---- LIVING ROOM (warm reds/teal) ----
  rug(b, -11, -9, 0x9c3b3b, 9, 7);
  sofa(b, -15, -9, 0x4f7d8c, Math.PI / 2);
  sofa(b, -11, -13.5, 0xc26b4a, 0);
  table(b, -11, -9, 0x8a5a36, 0x5e3d24);
  lamp(b, -18, -14, null, 0xffd98a);
  plant(b, -18, -3.5);
  b.box(1.2, 1.0, 0.5, 0x2e2e38, -11, 0.5, -16.6, {}); // TV stand
  b.box(2.4, 1.4, 0.16, 0x101016, -11, 1.7, -16.9, { collide: false, rough: 0.3, metal: 0.4 });

  // ---- KITCHEN (creams, fruit colours) ----
  rug(b, 11, -9, 0xd9b44a, 8, 6);
  b.box(5.5, 1.0, 1.0, 0xeae3d4, 14, 0.5, -16, {});       // counter
  b.box(5.5, 0.1, 1.0, 0x3a3a44, 14, 1.05, -16, { collide: false }); // worktop
  b.box(1.2, 1.8, 1.0, 0xd0d6dc, 18.5, 0.9, -16, { rough: 0.4, metal: 0.3 }); // fridge
  table(b, 12, -8, 0xb98b54, 0x7a5a34);
  [[10.5, -9.4], [13.5, -9.4], [10.5, -6.6], [13.5, -6.6]].forEach((p) => b.box(0.6, 1.0, 0.6, 0x6fae6f, p[0], 0.5, p[1], { collide: false })); // chairs
  // fruit bowl colours
  b.sphere(0.18, 0xe8483b, 12, 1.05, -8, {}); b.sphere(0.18, 0xffc23c, 12.4, 1.05, -8.2, {}); b.sphere(0.18, 0x8ac24a, 11.7, 1.05, -7.7, {});
  lamp(b, 16, -4, null, 0xfff0c0);

  // ---- LIBRARY / STUDY (purples, books) ----
  rug(b, -11, 9, 0x4b3b6e, 9, 7);
  shelf(b, -11, 16, 0x6e4f3a, 0);
  shelf(b, -19, 9, 0x6e4f3a, Math.PI / 2);
  table(b, -11, 9, 0x5a4068, 0x3a2a44);
  b.box(0.9, 1.0, 0.9, 0x9b59b6, -11, 0.5, 11.5, { collide: true }); // armchair-ish
  plant(b, -18, 15);
  lamp(b, -6, 14, null, 0xe6d2ff);

  // ---- BEDROOM (pinks, cozy) ----
  rug(b, 11, 9, 0xc06a86, 9, 7);
  bed(b, 9, 10, 0xe88fb0);
  b.box(1.0, 1.2, 0.6, 0xb98b54, 13.5, 0.6, 7.5, {}); // nightstand/dresser
  b.box(1.4, 2.0, 0.6, 0x7a5a34, 17, 1.0, 14, {});    // wardrobe
  plant(b, 17, 4);
  lamp(b, 13.8, 7.5, null, 0xffc6da);

  // scattered colourful crates (classic camo cover) across the halls
  const crateCol = [0xe8483b, 0x3a7bd5, 0xffc23c, 0x2ec4a6, 0x9b59b6, 0xff8a3d];
  for (let i = 0; i < 8; i++) {
    const x = (r() - 0.5) * (W - 8), z = (r() - 0.5) * (D - 8);
    const s = 0.8 + r() * 0.8;
    b.box(s, s, s, crateCol[i % crateCol.length], x, s / 2, z, {});
  }

  const spawns = [
    new THREE.Vector3(-15, 0, -6), new THREE.Vector3(15, 0, -6),
    new THREE.Vector3(-15, 0, 14), new THREE.Vector3(15, 0, 13),
    new THREE.Vector3(-6, 0, 9), new THREE.Vector3(6, 0, -9)
  ];

  return finalize(b, {
    mood: 'cozy', bounds: { minX: -half.w + 1, maxX: half.w - 1, minZ: -half.d + 1, maxZ: half.d - 1 },
    spawns, hunterSpawn: new THREE.Vector3(0, 0, 0),
    apply(scene, renderer, engine) {
      scene.background = new THREE.Color(0x2a2230);
      scene.fog = new THREE.FogExp2(0x2a2230, 0.012);
      const hemi = new THREE.HemisphereLight(0xffe9cf, 0x3a2e3a, 0.5); scene.add(hemi); this._lights.push(hemi);
      const sun = new THREE.DirectionalLight(0xffe7c0, 1.3);
      sun.position.set(14, 24, 10); sun.castShadow = true;
      sun.shadow.mapSize.set(renderer.shadowMap.enabled ? 2048 : 1024, 2048);
      sun.shadow.camera.near = 1; sun.shadow.camera.far = 80;
      sun.shadow.camera.left = -28; sun.shadow.camera.right = 28; sun.shadow.camera.top = 28; sun.shadow.camera.bottom = -28;
      sun.shadow.bias = -0.0004;
      scene.add(sun); scene.add(sun.target); this._lights.push(sun, sun.target); this.sun = sun;
      const pmrem = new THREE.PMREMGenerator(renderer);
      this._env = pmrem.fromScene(new RoomEnvironment(), 0.04);
      scene.environment = this._env.texture; pmrem.dispose();
    }
  });
}

// =========================== GARDEN ===========================
function buildGarden() {
  const b = new Builder();
  const r = rng(21); const W = 40, D = 40, half = { w: W / 2, d: D / 2 };
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(W, D), b.mat(0x6cbf4a, 1));
  grass.rotation.x = -Math.PI / 2; grass.receiveShadow = true; b.group.add(grass); b.pickables.push(grass);
  for (let gx = -half.w; gx < half.w; gx += 8) for (let gz = -half.d; gz < half.d; gz += 8) if (((gx + gz) / 8) % 2 === 0) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), b.mat(0x5aad3c, 1));
    p.rotation.x = -Math.PI / 2; p.position.set(gx + 4, 0.01, gz + 4); p.receiveShadow = true; b.group.add(p); b.pickables.push(p);
  }
  // hedges (perimeter)
  const hedge = 0x3f8f43;
  b.box(W, 1.8, 1, hedge, 0, 0.9, -half.d, { rough: 0.95 });
  b.box(W, 1.8, 1, hedge, 0, 0.9, half.d, { rough: 0.95 });
  b.box(1, 1.8, D, hedge, -half.w, 0.9, 0, { rough: 0.95 });
  b.box(1, 1.8, D, hedge, half.w, 0.9, 0, { rough: 0.95 });
  // colourful props
  const cols = [0xe8483b, 0x3a7bd5, 0xffc23c, 0xff8a3d, 0x9b59b6, 0x2ec4a6, 0xf25c9a];
  for (let i = 0; i < 16; i++) {
    const x = (r() - 0.5) * (W - 6), z = (r() - 0.5) * (D - 6);
    if (Math.hypot(x, z) < 5) continue;
    const s = 1 + r() * 2;
    if (r() < 0.4) plant(b, x, z); else b.box(s, s * (0.6 + r()), s, cols[i % cols.length], x, s / 2, z, {});
  }
  const spawns = [new THREE.Vector3(-12, 0, -12), new THREE.Vector3(12, 0, -12), new THREE.Vector3(-12, 0, 12), new THREE.Vector3(12, 0, 12), new THREE.Vector3(0, 0, -14), new THREE.Vector3(0, 0, 14)];
  return finalize(b, {
    mood: 'sunny', bounds: { minX: -half.w + 1.5, maxX: half.w - 1.5, minZ: -half.d + 1.5, maxZ: half.d - 1.5 },
    spawns, hunterSpawn: new THREE.Vector3(0, 0, 0),
    apply(scene, renderer) {
      scene.background = new THREE.Color(0x9ad0ff);
      scene.fog = new THREE.Fog(0x9ad0ff, 40, 90);
      const hemi = new THREE.HemisphereLight(0xdff1ff, 0x4f7a3a, 0.9); scene.add(hemi); this._lights.push(hemi);
      const sun = new THREE.DirectionalLight(0xfff6e0, 1.7); sun.position.set(18, 30, 12); sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.near = 1; sun.shadow.camera.far = 90;
      sun.shadow.camera.left = -28; sun.shadow.camera.right = 28; sun.shadow.camera.top = 28; sun.shadow.camera.bottom = -28; sun.shadow.bias = -0.0004;
      scene.add(sun); scene.add(sun.target); this._lights.push(sun, sun.target); this.sun = sun;
      const pmrem = new THREE.PMREMGenerator(renderer); this._env = pmrem.fromScene(new RoomEnvironment(), 0.04);
      scene.environment = this._env.texture; pmrem.dispose();
    }
  });
}

function finalize(b, props) {
  const map = Object.assign({
    group: b.group, colliders: b.colliders, pickables: b.pickables,
    _lights: [], sun: null, _env: null,
    dispose() {
      this._lights.forEach((l) => { if (l.parent) l.parent.remove(l); });
      if (this._env) this._env.dispose && this._env.dispose();
      b.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    }
  }, props);
  return map;
}

export const MAPS = [
  { id: 'mansion', name: 'The Mansion', mood: 'Cozy indoor', accent: '#c98f86', build: buildMansion },
  { id: 'garden', name: 'Sunset Garden', mood: 'Bright outdoor', accent: '#6cbf4a', build: buildGarden }
];
export function buildMap(id) { const m = MAPS.find((x) => x.id === id) || MAPS[0]; return m.build(); }
