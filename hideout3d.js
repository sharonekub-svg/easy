/* ===== EZ flagship — CHROMA HIDE (3D hide & seek) =====================
 * An original, polished third-person hide-and-seek. You are a color-shifting
 * chameleon sneaking through a bright, modern multi-room apartment to collect
 * glowing Chroma Orbs while evading a hovering Seeker bot. Blend your skin to
 * nearby surfaces, slip into wardrobes / boxes / under furniture, and break
 * line of sight to survive.
 *
 * All geometry, characters, materials and systems here are generated from
 * scratch — no external game's assets, maps, characters, textures or code.
 *
 * Pipeline: HDR ACES tone mapping, image-based environment reflections,
 * soft dynamic shadows, an UnrealBloom glow pass, GPU dust + pooled puff
 * particles, a collision-aware follow camera, an FSM seeker AI, and a clean
 * HUD with a live minimap.
 *
 * Registers as window.EZGames.hideout.mount(canvas, opts) -> controller.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

(function (root) {
  'use strict';

  var ACCENT = 0xCB2957;
  var HALF_X = 22, HALF_Z = 16, WALL_H = 6, WALL_T = 0.6;
  var DOOR = 3.6; // half-gap of central doorways

  // ---- small math helpers ----
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function damp(a, b, lambda, dt) { return lerp(a, b, 1 - Math.exp(-lambda * dt)); }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function angLerp(a, b, t) { var d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI; return a + d * t; }

  function mount(canvas, opts) {
    opts = opts || {};
    var parent = canvas.parentElement;

    /* ============================ RENDERER ============================ */
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setClearColor(0x0e1622, 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    var scene = new THREE.Scene();
    scene.background = new THREE.Color(0xbfe3f2);
    scene.fog = new THREE.Fog(0xbfe3f2, 58, 120);

    var pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    var camera = new THREE.PerspectiveCamera(58, 1, 0.1, 300);
    camera.position.set(0, 14, 22);

    /* ============================ LIGHTING =========================== */
    scene.add(new THREE.HemisphereLight(0xf3f8ff, 0x6a5f55, 0.85));
    var sun = new THREE.DirectionalLight(0xfff2da, 1.45);
    sun.position.set(26, 40, 18);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 5; sun.shadow.camera.far = 110;
    sun.shadow.camera.left = -40; sun.shadow.camera.right = 40;
    sun.shadow.camera.top = 34; sun.shadow.camera.bottom = -34;
    sun.shadow.bias = -0.00035; sun.shadow.normalBias = 0.02;
    scene.add(sun); scene.add(sun.target);

    var fill = new THREE.DirectionalLight(0xbcd2ff, 0.35);
    fill.position.set(-22, 18, -16); scene.add(fill);

    /* =========================== MATERIALS =========================== */
    function mat(color, rough, metal, opt) {
      opt = opt || {};
      return new THREE.MeshStandardMaterial({
        color: color, roughness: rough == null ? 0.7 : rough, metalness: metal || 0,
        envMapIntensity: opt.env == null ? 0.8 : opt.env,
        emissive: opt.emissive || 0x000000, emissiveIntensity: opt.emissiveIntensity || 0,
        transparent: !!opt.transparent, opacity: opt.opacity == null ? 1 : opt.opacity,
        flatShading: !!opt.flat
      });
    }

    var world = new THREE.Group(); scene.add(world);
    var colliders = [];   // {minX,maxX,minZ,maxZ}
    var occluders = [];   // meshes that block line of sight
    function addCollider(cx, cz, hx, hz) { colliders.push({ minX: cx - hx, maxX: cx + hx, minZ: cz - hz, maxZ: cz + hz }); }

    function box(w, h, d, material, x, y, z, ry) {
      var g = new THREE.BoxGeometry(w, h, d);
      var m = new THREE.Mesh(g, material);
      m.position.set(x, y, z); if (ry) m.rotation.y = ry;
      m.castShadow = true; m.receiveShadow = true;
      world.add(m); return m;
    }
    function cyl(rt, rb, h, seg, material, x, y, z) {
      var m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 20), material);
      m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; world.add(m); return m;
    }

    /* ===================== ROOM SHELL (floor/walls) ================== */
    // glossy wood floor with subtle environment reflection
    var floor = new THREE.Mesh(new THREE.PlaneGeometry(HALF_X * 2, HALF_Z * 2),
      mat(0xcaa06a, 0.38, 0.0, { env: 0.7 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; world.add(floor);
    // plank seams
    var seamMat = mat(0x9a7748, 0.5, 0);
    for (var px = -HALF_X + 2; px < HALF_X; px += 2.0) {
      var seam = new THREE.Mesh(new THREE.PlaneGeometry(0.05, HALF_Z * 2), seamMat);
      seam.rotation.x = -Math.PI / 2; seam.position.set(px, 0.011, 0); seam.receiveShadow = true; world.add(seam);
    }

    // ceiling (soft, no shadow receive needed)
    var ceil = new THREE.Mesh(new THREE.PlaneGeometry(HALF_X * 2, HALF_Z * 2), mat(0xf6f4ef, 0.95, 0));
    ceil.rotation.x = Math.PI / 2; ceil.position.y = WALL_H; world.add(ceil);

    var wallMat = mat(0xf1ebe0, 0.92, 0);
    var accentWalls = { living: 0x8fd9cf, bed: 0xf3b6c6, kitchen: 0xf6d98a, play: 0xc3b6e8 };

    function wallSeg(x1, z1, x2, z2, material, h) {
      h = h || WALL_H;
      var w = Math.abs(x2 - x1) || WALL_T, d = Math.abs(z2 - z1) || WALL_T;
      var m = box(w, h, d, material || wallMat, (x1 + x2) / 2, h / 2, (z1 + z2) / 2);
      addCollider((x1 + x2) / 2, (z1 + z2) / 2, Math.max(w, WALL_T) / 2, Math.max(d, WALL_T) / 2);
      occluders.push(m); return m;
    }
    // outer walls
    wallSeg(-HALF_X, -HALF_Z, HALF_X, -HALF_Z);
    wallSeg(-HALF_X, HALF_Z, HALF_X, HALF_Z);
    wallSeg(-HALF_X, -HALF_Z, -HALF_X, HALF_Z);
    wallSeg(HALF_X, -HALF_Z, HALF_X, HALF_Z);
    // interior vertical (X=0) with central doorway
    wallSeg(0, -HALF_Z, 0, -DOOR);
    wallSeg(0, DOOR, 0, HALF_Z);
    // interior horizontal (Z=0) with central doorway
    wallSeg(-HALF_X, 0, -DOOR, 0);
    wallSeg(DOOR, 0, HALF_X, 0);
    // door frames (visual lintels)
    var frameMat = mat(0xe7ddcc, 0.8, 0);
    box(WALL_T + 0.2, 1.0, DOOR * 2, frameMat, 0, WALL_H - 0.5, 0);
    box(DOOR * 2, 1.0, WALL_T + 0.2, frameMat, 0, WALL_H - 0.5, 0);

    // accent wall panels per room (paint the inner faces)
    function accentPanel(color, cx, cz, w, d) {
      var pmt = mat(color, 0.85, 0);
      // a thin slab hugging the two inner walls of a quadrant
      box(w, WALL_H - 0.4, 0.08, pmt, cx, (WALL_H - 0.4) / 2, cz < 0 ? -HALF_Z + 0.36 : HALF_Z - 0.36);
      box(0.08, WALL_H - 0.4, d, pmt, cx < 0 ? -HALF_X + 0.36 : HALF_X - 0.36, (WALL_H - 0.4) / 2, cz);
    }
    accentPanel(accentWalls.living, -11, -8, 18, 13);
    accentPanel(accentWalls.bed, 11, -8, 18, 13);
    accentPanel(accentWalls.kitchen, -11, 8, 18, 13);
    accentPanel(accentWalls.play, 11, 8, 18, 13);

    // windows: bright emissive panels + warm shafts (bloom)
    var skyMat = mat(0xeaf6ff, 0.4, 0, { emissive: 0xdff0ff, emissiveIntensity: 0.7 });
    function windowOn(side, cx, cz) {
      var w = side === 'h' ? 5 : 0.18, d = side === 'h' ? 0.18 : 5;
      box(w, 3.0, d, skyMat, cx, 3.4, cz);
    }
    windowOn('v', -HALF_X + 0.2, -8); windowOn('v', -HALF_X + 0.2, 8);
    windowOn('h', -11, -HALF_Z + 0.2); windowOn('h', 11, -HALF_Z + 0.2);

    /* ===================== FURNITURE / ROOMS ======================== */
    var hideSpots = [];     // {x,z,r,type,name,prompt,door,open,blocksTop}
    var interactables = []; // subset that need F

    function rug(color, cx, cz, w, d) {
      var r = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat(color, 0.95, 0));
      r.rotation.x = -Math.PI / 2; r.position.set(cx, 0.02, cz); r.receiveShadow = true; world.add(r);
      var r2 = new THREE.Mesh(new THREE.PlaneGeometry(w - 1.2, d - 1.2), mat(0xffffff, 0.95, 0, { opacity: 0.25, transparent: true }));
      r2.rotation.x = -Math.PI / 2; r2.position.set(cx, 0.03, cz); world.add(r2);
    }
    function lampLight(color, x, y, z, intensity, dist) {
      var L = new THREE.PointLight(color, intensity, dist || 22, 1.8); L.position.set(x, y, z); world.add(L); return L;
    }
    function plant(x, z, scale) {
      scale = scale || 1;
      cyl(0.45 * scale, 0.55 * scale, 0.7 * scale, 16, mat(0xd98a52, 0.7, 0), x, 0.35 * scale, z);
      var leaf = mat(0x4fae54, 0.6, 0, { flat: true });
      for (var i = 0; i < 6; i++) {
        var s = new THREE.Mesh(new THREE.SphereGeometry(rand(0.5, 0.8) * scale, 8, 6), leaf);
        s.position.set(x + rand(-0.4, 0.4) * scale, (1.0 + rand(0, 0.7)) * scale, z + rand(-0.4, 0.4) * scale);
        s.scale.y = 1.4; s.castShadow = true; world.add(s);
      }
      addCollider(x, z, 0.5 * scale, 0.5 * scale);
    }

    // ---------- LIVING ROOM (NW) ----------
    (function () {
      rug(0x6fcfd6, -11, -8, 12, 8);
      // sofa
      var sofaMat = mat(0xe9663f, 0.75, 0, { flat: true });
      var sx = -17, sz = -3.5;
      box(6.2, 1.0, 2.6, sofaMat, sx, 0.7, sz);
      box(6.2, 1.4, 0.6, sofaMat, sx, 1.4, sz - 1.0);
      box(0.6, 1.3, 2.6, sofaMat, sx - 2.8, 1.2, sz); box(0.6, 1.3, 2.6, sofaMat, sx + 2.8, 1.2, sz);
      [-1.9, 0, 1.9].forEach(function (o) { box(1.7, 0.4, 2.2, mat(0xf2855f, 0.8, 0, { flat: true }), sx + o, 1.25, sz + 0.1); });
      addCollider(sx, sz - 0.3, 3.2, 1.6); occluders.push(box(0.01, 0.01, 0.01, sofaMat, sx, 1.0, sz)); // dummy occ via real sofa: use big box
      hideSpots.push({ x: sx, z: sz + 2.4, r: 2.2, type: 'behind', name: 'behind the sofa', crouch: true });
      // coffee table (hide under)
      var ct = mat(0x8a5a32, 0.5, 0.1, { env: 0.7 });
      box(3.2, 0.25, 1.8, ct, -11, 1.0, -8);
      [[-1.4, -0.7], [1.4, -0.7], [-1.4, 0.7], [1.4, 0.7]].forEach(function (p) { box(0.18, 1.0, 0.18, ct, -11 + p[0], 0.5, -8 + p[1]); });
      hideSpots.push({ x: -11, z: -8, r: 1.7, type: 'under', name: 'under the table', crouch: true });
      // TV unit + glowing screen
      box(5, 1.1, 1.0, mat(0x2c2c34, 0.5, 0.2), -11, 0.55, -14.3);
      var screen = box(4.4, 2.4, 0.16, mat(0x101018, 0.3, 0.4, { emissive: 0x2bb6e0, emissiveIntensity: 1.3 }), -11, 2.6, -14.5);
      occluders.push(box(5, 2.0, 0.6, mat(0x2c2c34, 0.5, 0.2), -11, 1.5, -14.3));
      // bookshelf with colorful books
      var shelfMat = mat(0xb98a55, 0.6, 0);
      var bsx = -20.5, bsz = -12;
      box(0.6, 5.0, 4.2, shelfMat, bsx, 2.5, bsz); addCollider(bsx, bsz, 0.4, 2.1); occluders.push(box(0.6, 5, 4.2, shelfMat, bsx, 2.5, bsz));
      var bookCols = [0xCB2957, 0x2bb6e0, 0xf6c945, 0x59c26b, 0x9b6cf0, 0xf0884f];
      for (var sh = 0; sh < 3; sh++) for (var bk = 0; bk < 9; bk++) {
        box(0.35, rand(0.7, 1.0), 0.18, mat(bookCols[(sh + bk) % bookCols.length], 0.8, 0, { flat: true }),
          bsx + 0.18, 1.0 + sh * 1.5 + 0.45, bsz - 1.8 + bk * 0.42);
      }
      // floor lamp
      cyl(0.07, 0.07, 3.2, 10, mat(0x444, 0.4, 0.6), -6.5, 1.6, -13.5);
      var shade = cyl(0.7, 0.5, 0.9, 16, mat(0xfff3d0, 0.5, 0, { emissive: 0xffdf9a, emissiveIntensity: 1.4 }), -6.5, 3.4, -13.5);
      lampLight(0xffd591, -6.5, 3.3, -13.5, 14, 16);
      plant(-19.5, -3.5, 1.1);
    })();

    // ---------- BEDROOM (NE) ----------
    (function () {
      rug(0xf2a6c0, 11, -9, 12, 8);
      // bed (hide under)
      var frame = mat(0x9a6a3c, 0.6, 0), sheet = mat(0xf7f3ee, 0.85, 0, { flat: true }), blanket = mat(0x6c8ff0, 0.8, 0, { flat: true });
      var bx = 16.5, bz = -10;
      box(5.0, 0.7, 6.4, frame, bx, 0.35, bz);
      box(4.8, 0.5, 6.2, sheet, bx, 0.95, bz);
      box(4.8, 0.45, 3.6, blanket, bx, 1.05, bz + 1.2);
      box(5.0, 1.6, 0.4, frame, bx, 0.9, bz - 3.2); // headboard
      [-1.3, 1.3].forEach(function (o) { box(1.6, 0.5, 1.0, sheet, bx + o, 1.35, bz - 2.4); });
      addCollider(bx, bz, 2.5, 3.2);
      occluders.push(box(5, 1.1, 6.4, frame, bx, 0.55, bz));
      hideSpots.push({ x: bx, z: bz + 2.2, r: 2.4, type: 'under', name: 'under the bed', crouch: true });
      // wardrobe (openable, hide inside)
      var wm = mat(0xc98f5a, 0.55, 0.05, { env: 0.6 });
      var wx = 20.4, wz = -3;
      box(0.6, 4.6, 5.0, wm, wx, 2.3, wz); // back/body
      box(1.8, 4.6, 0.5, wm, wx - 1.0, 2.3, wz - 2.3); box(1.8, 4.6, 0.5, wm, wx - 1.0, 2.3, wz + 2.3);
      var doorL = new THREE.Group(), doorR = new THREE.Group();
      var dPanelL = box(0.18, 4.2, 2.3, mat(0xdda871, 0.55, 0.05), 0, 0, 0); dPanelL.position.set(0, 0, 0);
      doorL.add(dPanelL); doorL.position.set(wx - 1.9, 2.3, wz - 1.15);
      var dPanelR = box(0.18, 4.2, 2.3, mat(0xdda871, 0.55, 0.05), 0, 0, 0); doorR.add(dPanelR); doorR.position.set(wx - 1.9, 2.3, wz + 1.15);
      world.add(doorL); world.add(doorR);
      addCollider(wx, wz, 1.1, 2.5);
      occluders.push(box(0.6, 4.6, 5, wm, wx, 2.3, wz));
      hideSpots.push({ x: wx - 1.3, z: wz, r: 1.9, type: 'wardrobe', name: 'the wardrobe', door: { l: doorL, r: doorR, open: false } });
      // nightstand + lamp
      box(1.4, 1.2, 1.4, mat(0xb98a55, 0.6, 0), 13, 0.6, -13);
      cyl(0.45, 0.3, 0.7, 14, mat(0xfff0c8, 0.5, 0, { emissive: 0xffd98a, emissiveIntensity: 1.5 }), 13, 1.7, -13);
      lampLight(0xffce82, 13, 1.9, -13, 10, 12);
      // wall art
      box(2.4, 1.7, 0.1, mat(0x2bb6e0, 0.6, 0, { emissive: 0x1c7fa0, emissiveIntensity: 0.3 }), 8, 3.4, -HALF_Z + 0.3);
      plant(20, -13.5, 1.2);
    })();

    // ---------- KITCHEN (SW) ----------
    (function () {
      rug(0xf6d98a, -11, 9, 12, 7);
      var counter = mat(0xeef1f4, 0.35, 0.1, { env: 0.9 }), wood = mat(0xb07c44, 0.6, 0);
      // L counter
      box(11, 1.7, 2.0, counter, -15.5, 0.85, 14.4); addCollider(-15.5, 14.4, 5.5, 1.0); occluders.push(box(11, 1.7, 2, counter, -15.5, 0.85, 14.4));
      box(2.0, 1.7, 9, counter, -20.0, 0.85, 9.5); addCollider(-20.0, 9.5, 1.0, 4.5);
      // upper cabinets
      box(10, 1.6, 1.2, mat(0xdfe6ec, 0.5, 0.05), -15.5, 4.4, 15.2);
      // fridge
      box(2.4, 4.4, 2.2, mat(0xd8dde3, 0.3, 0.5, { env: 1.1 }), -21, 2.2, 3.6); addCollider(-21, 3.6, 1.2, 1.1); occluders.push(box(2.4, 4.4, 2.2, counter, -21, 2.2, 3.6));
      // sink (reflective)
      box(1.6, 0.2, 1.2, mat(0xb9c2cc, 0.12, 0.8, { env: 1.4 }), -13, 1.78, 14.4);
      // pendant lights
      [-8, -13].forEach(function (lx) {
        cyl(0.02, 0.02, 1.4, 6, mat(0x333, 0.4, 0.5), lx, WALL_H - 0.7, 8.5);
        cyl(0.4, 0.55, 0.6, 16, mat(0xffe9bf, 0.4, 0.1, { emissive: 0xffcf7a, emissiveIntensity: 1.7 }), lx, WALL_H - 1.5, 8.5);
        lampLight(0xffce82, lx, WALL_H - 1.6, 8.5, 12, 14);
      });
      // table + chairs (hide under)
      box(3.6, 0.25, 2.2, wood, -8, 1.45, 9); [[-1.5, -0.8], [1.5, -0.8], [-1.5, 0.8], [1.5, 0.8]].forEach(function (p) { box(0.2, 1.45, 0.2, wood, -8 + p[0], 0.72, 9 + p[1]); });
      hideSpots.push({ x: -8, z: 9, r: 1.9, type: 'under', name: 'under the kitchen table', crouch: true });
      [[-8, 11.4], [-8, 6.6]].forEach(function (c) { box(1.2, 0.2, 1.2, mat(0xe4894f, 0.7, 0, { flat: true }), c[0], 1.0, c[1]); box(1.2, 1.4, 0.2, mat(0xe4894f, 0.7, 0, { flat: true }), c[0], 1.7, c[1] + (c[1] > 9 ? 0.5 : -0.5)); });
    })();

    // ---------- PLAY / STUDY (SE) ----------
    (function () {
      rug(0xb9a8ef, 12, 9, 12, 8);
      var wood = mat(0xb98a55, 0.6, 0);
      // desk + glowing monitor
      box(4.4, 0.25, 2.0, wood, 18, 2.1, 5.4); [[-2, -0.8], [2, -0.8], [-2, 0.8], [2, 0.8]].forEach(function (p) { box(0.2, 2.1, 0.2, wood, 18 + p[0], 1.05, 5.4 + p[1]); });
      box(3.0, 1.7, 0.12, mat(0x0d0f16, 0.3, 0.4, { emissive: 0x39d0d8, emissiveIntensity: 1.4 }), 18, 3.2, 4.7);
      addCollider(18, 5.4, 2.2, 1.0); occluders.push(box(4.4, 1.2, 2, wood, 18, 1.5, 5.4));
      // shelves
      box(0.6, 4.0, 4.0, wood, 21.4, 2.0, 12); addCollider(21.4, 12, 0.4, 2.0); occluders.push(box(0.6, 4, 4, wood, 21.4, 2, 12));
      var toyCols = [0xCB2957, 0x2bb6e0, 0xf6c945, 0x59c26b, 0x9b6cf0];
      for (var t = 0; t < 8; t++) box(0.7, 0.7, 0.7, mat(toyCols[t % toyCols.length], 0.7, 0, { flat: true }), 21.2, 0.6 + Math.floor(t / 2) * 1.3, 10.5 + (t % 2) * 1.0);
      // bean bag
      var bb = new THREE.Mesh(new THREE.SphereGeometry(1.3, 16, 12), mat(0xf07fae, 0.8, 0, { flat: true }));
      bb.scale.set(1.2, 0.7, 1.2); bb.position.set(8, 0.9, 13); bb.castShadow = true; world.add(bb); addCollider(8, 13, 1.3, 1.3);
      // toy blocks pile (colorful)
      for (var c2 = 0; c2 < 10; c2++) box(rand(0.5, 0.8), rand(0.5, 0.8), rand(0.5, 0.8), mat(toyCols[c2 % toyCols.length], 0.7, 0, { flat: true }), rand(6, 10), 0.35, rand(5.5, 8.5), rand(0, 3));
      // cardboard hide box (interactable)
      var boxMat = mat(0xc79a5e, 0.85, 0, { flat: true });
      var hbx = 14, hbz = 13;
      var hbGroup = new THREE.Group();
      [[0, -0.9, 1.6, 0.12], [0, 0.9, 1.6, 0.12], [-0.9, 0, 0.12, 1.8], [0.9, 0, 0.12, 1.8]].forEach(function (s) {
        var w = box(s[2], 1.7, s[3], boxMat, hbx + s[0], 0.85, hbz + s[1]); hbGroup.add(w);
      });
      var lid = box(1.9, 0.12, 1.9, boxMat, hbx, 1.72, hbz); hbGroup.add(lid);
      addCollider(hbx, hbz, 0.95, 0.95);
      hideSpots.push({ x: hbx, z: hbz, r: 1.5, type: 'box', name: 'the cardboard box', lid: lid, baseLidY: 1.72 });
      plant(8, 5.5, 1.0);
    })();

    /* ====================== PLAYER (chameleon) ===================== */
    function buildChameleon() {
      var g = new THREE.Group();
      var skinMat = new THREE.MeshStandardMaterial({ color: 0x6fc24a, roughness: 0.55, metalness: 0.0, flatShading: true, envMapIntensity: 0.6 });
      var bellyMat = new THREE.MeshStandardMaterial({ color: 0xbfe59a, roughness: 0.6, flatShading: true });
      g.skinMats = [skinMat];
      // body
      var body = new THREE.Mesh(new THREE.SphereGeometry(0.7, 14, 12), skinMat);
      body.scale.set(1.1, 0.9, 1.45); body.position.y = 0.95; body.castShadow = true; g.add(body); g.body = body;
      var belly = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 10), bellyMat);
      belly.scale.set(1.0, 0.55, 1.35); belly.position.set(0, 0.78, 0.05); g.add(belly); g.skinMats.push(bellyMat);
      // crest fins
      var crestMat = new THREE.MeshStandardMaterial({ color: 0x4f9e3a, roughness: 0.6, flatShading: true });
      for (var i = 0; i < 5; i++) { var fin = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.32, 4), crestMat); fin.position.set(0, 1.5 - i * 0.04, -0.5 + i * 0.26); g.add(fin); }
      g.skinMats.push(crestMat);
      // head
      var head = new THREE.Group(); head.position.set(0, 1.12, 1.15); g.add(head); g.head = head;
      var skull = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 12), skinMat); skull.scale.set(1.0, 0.95, 1.1); skull.castShadow = true; head.add(skull);
      var jaw = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 8), bellyMat); jaw.scale.set(0.9, 0.5, 1.0); jaw.position.set(0, -0.22, 0.18); head.add(jaw);
      // turret eyes (independently swivel)
      g.eyes = [];
      [-1, 1].forEach(function (s) {
        var eye = new THREE.Group(); eye.position.set(s * 0.34, 0.12, 0.06); head.add(eye);
        var cone = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), skinMat); cone.scale.set(1, 1, 1.1); eye.add(cone);
        var ball = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshStandardMaterial({ color: 0xfff6e6, roughness: 0.3 })); ball.position.set(s * 0.05, 0, 0.18); eye.add(ball);
        var pup = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), new THREE.MeshStandardMaterial({ color: 0x111111 })); pup.position.set(s * 0.05, 0, 0.27); eye.add(pup);
        g.eyes.push(eye);
      });
      // legs
      var legMat = skinMat; g.legs = [];
      [[-0.55, -0.55], [0.55, -0.55], [-0.55, 0.55], [0.55, 0.55]].forEach(function (p) {
        var leg = new THREE.Group(); leg.position.set(p[0], 0.62, p[1]); g.add(leg);
        var upper = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.5, 8), legMat); upper.position.y = -0.22; upper.castShadow = true; leg.add(upper);
        var foot = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), legMat); foot.position.y = -0.5; leg.add(foot);
        g.legs.push(leg);
      });
      // curling tail (coils upward into a spiral)
      g.tail = [];
      var tailRoot = new THREE.Group(); tailRoot.position.set(0, 1.05, -0.95); g.add(tailRoot); g.tailRoot = tailRoot;
      var seg = tailRoot;
      for (var t = 0; t < 8; t++) {
        var s2 = new THREE.Group(); s2.position.set(0, 0, -0.2); s2.rotation.x = 0.52; // per-segment coil
        var r = Math.max(0.05, 0.19 - t * 0.018);
        var m2 = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), skinMat); m2.castShadow = true; s2.add(m2);
        seg.add(s2); g.tail.push(s2); seg = s2;
      }
      g.setSkin = function (col) { g.skinMats.forEach(function (mm) { mm.color.lerp(col, 0.18); }); };
      return g;
    }
    var player = buildChameleon(); world.add(player);
    var playerSkinColor = new THREE.Color(0x6fc24a);

    /* ========================= SEEKER (bot) ======================== */
    function buildSeeker() {
      var g = new THREE.Group();
      var shell = new THREE.MeshStandardMaterial({ color: 0xf2f4f8, roughness: 0.3, metalness: 0.5, envMapIntensity: 1.2, flatShading: false });
      var dark = new THREE.MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.4, metalness: 0.6 });
      var body = new THREE.Mesh(new THREE.SphereGeometry(1.0, 20, 16), shell); body.scale.set(1.0, 1.15, 1.0); body.castShadow = true; g.add(body);
      var collar = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.16, 12, 24), dark); collar.rotation.x = Math.PI / 2; collar.position.y = -0.2; g.add(collar);
      // glowing eye/visor
      var eyeMat = new THREE.MeshStandardMaterial({ color: 0x111418, roughness: 0.2, metalness: 0.3, emissive: 0xff4d4d, emissiveIntensity: 2.6 });
      g.eyeMat = eyeMat;
      var visor = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), eyeMat); visor.scale.set(1.3, 0.8, 0.5); visor.position.set(0, 0.15, 0.82); g.add(visor); g.visor = visor;
      var brow = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.16, 0.2), shell); brow.position.set(0, 0.55, 0.7); brow.rotation.x = 0.3; g.add(brow);
      // antenna
      var ant = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.6, 6), dark); ant.position.set(0, 1.35, 0); g.add(ant);
      var antTip = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), new THREE.MeshStandardMaterial({ color: 0xff5a5a, emissive: 0xff5a5a, emissiveIntensity: 2.2 })); antTip.position.set(0, 1.65, 0); g.add(antTip); g.antTip = antTip;
      // hover thruster ring (emissive)
      var ring = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.1, 10, 20), new THREE.MeshStandardMaterial({ color: 0x39d0d8, emissive: 0x39d0d8, emissiveIntensity: 2.0 }));
      ring.rotation.x = Math.PI / 2; ring.position.y = -0.95; g.add(ring); g.ring = ring;
      // vision cone
      var coneGeo = new THREE.ConeGeometry(1, 1, 28, 1, true);
      coneGeo.translate(0, -0.5, 0); coneGeo.rotateX(-Math.PI / 2);
      var coneMat = new THREE.MeshBasicMaterial({ color: 0x59c26b, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
      var cone = new THREE.Mesh(coneGeo, coneMat); cone.position.set(0, 0.1, 0.6); g.add(cone); g.cone = cone; g.coneMat = coneMat;
      return g;
    }
    var seeker = buildSeeker(); world.add(seeker);
    var seekerLight = new THREE.PointLight(0xff6a6a, 0.0, 16, 2); world.add(seekerLight);

    /* ===================== CHROMA ORBS (goal) ====================== */
    var orbs = [];
    var orbPositions = [[-16, -6], [-19, -12], [16, -6], [13, -13], [-13, 12], [-8, 9], [13, 12], [20, 6]];
    var orbMat = new THREE.MeshStandardMaterial({ color: 0x39d0d8, emissive: 0x39d0d8, emissiveIntensity: 2.4, roughness: 0.2, metalness: 0.2 });
    orbPositions.forEach(function (p, i) {
      var o = new THREE.Group(); o.position.set(p[0], 1.3, p[1]);
      var core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 0), orbMat); o.add(core);
      var halo = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 0), new THREE.MeshBasicMaterial({ color: 0x9ef3ff, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false })); o.add(halo);
      o.userData = { taken: false, phase: i * 0.7, core: core };
      world.add(o); orbs.push(o);
    });
    var TOTAL_ORBS = orbs.length;

    /* ========================= PARTICLES =========================== */
    // shared soft radial sprite texture
    var sprTex = (function () {
      var c = document.createElement('canvas'); c.width = c.height = 64; var x = c.getContext('2d');
      var grd = x.createRadialGradient(32, 32, 0, 32, 32, 32); grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.4, 'rgba(255,255,255,0.6)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = grd; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
    })();
    // dust motes
    var dustN = 320, dustPos = new Float32Array(dustN * 3);
    for (var di = 0; di < dustN; di++) { dustPos[di * 3] = rand(-HALF_X, HALF_X); dustPos[di * 3 + 1] = rand(0.5, WALL_H - 0.5); dustPos[di * 3 + 2] = rand(-HALF_Z, HALF_Z); }
    var dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    var dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ size: 0.09, map: sprTex, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffffff }));
    world.add(dust);
    // pooled puff sprites
    var puffs = []; var PUFF_N = 60;
    for (var pi = 0; pi < PUFF_N; pi++) {
      var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: sprTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
      sp.scale.set(0.4, 0.4, 0.4); sp.visible = false; world.add(sp);
      puffs.push({ sp: sp, life: 0, max: 1, vel: new THREE.Vector3() });
    }
    var puffI = 0;
    function burst(pos, color, n, spread, up) {
      for (var k = 0; k < n; k++) {
        var p = puffs[puffI = (puffI + 1) % PUFF_N];
        p.sp.position.copy(pos); p.sp.visible = true; p.sp.material.color.set(color); p.sp.material.opacity = 0.9;
        p.life = 0; p.max = rand(0.4, 0.8); p.scale0 = rand(0.3, 0.7);
        p.vel.set(rand(-spread, spread), rand(0.2, up), rand(-spread, spread));
      }
    }

    /* =========================== STATE ============================= */
    var keys = {};
    var time = 0, best = 0, over = false, won = false, paused = false, started = false, raf = 0, last = null;
    var crouch = false;
    var pVel = new THREE.Vector3(); var pHeading = 0;
    var hidden = false, hiddenSpot = null, inSpot = null;
    var camoMatch = 0;
    var collected = 0;
    var camYaw = 0, camYawTarget = Math.PI, manualYaw = 0;
    var detection = 0; // 0..1
    var ai = { state: 'patrol', wp: new THREE.Vector3(), last: new THREE.Vector3(), t: 0, bob: 0 };

    var raycaster = new THREE.Raycaster();
    var tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();

    function resolveCollision(pos, radius) {
      for (var pass = 0; pass < 2; pass++) for (var i = 0; i < colliders.length; i++) {
        var c = colliders[i];
        var hx = (c.maxX - c.minX) / 2 + radius, hz = (c.maxZ - c.minZ) / 2 + radius;
        var cx = (c.minX + c.maxX) / 2, cz = (c.minZ + c.maxZ) / 2;
        var dx = pos.x - cx, dz = pos.z - cz;
        if (Math.abs(dx) < hx && Math.abs(dz) < hz) {
          var ox = hx - Math.abs(dx), oz = hz - Math.abs(dz);
          if (ox < oz) pos.x = cx + (dx < 0 ? -hx : hx); else pos.z = cz + (dz < 0 ? -hz : hz);
        }
      }
      pos.x = clamp(pos.x, -HALF_X + 1, HALF_X - 1); pos.z = clamp(pos.z, -HALF_Z + 1, HALF_Z - 1);
    }

    // line of sight: clear if no occluder between a and b
    function losClear(ax, ay, az, bx, by, bz) {
      tmp.set(bx - ax, by - ay, bz - az); var dist = tmp.length(); tmp.normalize();
      raycaster.set(tmp2.set(ax, ay, az), tmp); raycaster.far = dist - 0.8;
      return raycaster.intersectObjects(occluders, false).length === 0;
    }

    /* ===================== START / RESET =========================== */
    function placeStart() {
      player.position.set(-13, 0, -5.5); player.rotation.y = Math.PI; pHeading = Math.PI; pVel.set(0, 0, 0);
      seeker.position.set(13, 1.3, 10); ai.state = 'patrol'; ai.t = 0; detection = 0; newWaypoint();
      camYaw = camYawTarget = 0; manualYaw = 0;
      hidden = false; inSpot = null; collected = 0;
      orbs.forEach(function (o) { o.userData.taken = false; o.visible = true; });
      // reset doors
      hideSpots.forEach(function (s) { if (s.door) { s.door.open = false; s.door.l.rotation.y = 0; s.door.r.rotation.y = 0; } if (s.lid) s.lid.position.y = s.baseLidY; });
      playerSkinColor.set(0x6fc24a); player.skinMats.forEach(function (m) { m.color.set(m === player.skinMats[1] ? 0xbfe59a : (m === player.skinMats[2] ? 0x4f9e3a : 0x6fc24a)); });
    }
    function reset() {
      time = 0; over = false; won = false; paused = false; crouch = false; started = true;
      placeStart(); hideOverlay(); updateHud(); if (opts.onScore) opts.onScore(0);
    }
    function newWaypoint() {
      var rooms = [[-11, -8], [11, -9], [-11, 9], [12, 9], [0, 0]];
      var r = rooms[Math.floor(Math.random() * rooms.length)];
      ai.wp.set(r[0] + rand(-5, 5), 1.3, r[1] + rand(-4, 4));
    }

    /* ===================== NEAREST SURFACE COLOR ================== */
    var grass = new THREE.Color(0xcaa06a); // floor as default backdrop
    function nearestSurfaceColor() {
      // sample nearest furniture/occluder material color within range
      var bestD = 4.2, col = floor.material.color;
      for (var i = 0; i < occluders.length; i++) {
        var o = occluders[i]; var d = Math.hypot(player.position.x - o.position.x, player.position.z - o.position.z);
        if (d < bestD && o.material && o.material.color) { bestD = d; col = o.material.color; }
      }
      return col;
    }
    function colorDist(a, b) { var dr = a.r - b.r, dg = a.g - b.g, db = a.b - b.b; return Math.sqrt(dr * dr + dg * dg + db * db); }

    /* =============================== UI ============================ */
    var ui = document.createElement('div');
    ui.style.cssText = 'position:absolute;inset:0;font-family:\'Space Grotesk\',sans-serif;pointer-events:none;z-index:5;overflow:hidden;';
    parent.appendChild(ui);
    function el(html) { var d = document.createElement('div'); d.innerHTML = html; return d.firstElementChild; }

    // top-left objective + timer
    var topLeft = el('<div style="position:absolute;top:14px;left:16px;display:flex;flex-direction:column;gap:8px;"></div>');
    topLeft.innerHTML =
      '<div style="display:flex;align-items:center;gap:8px;background:rgba(12,16,24,.5);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:8px 12px;">' +
      '<span style="font-family:\'Martian Mono\';font-size:10px;letter-spacing:1.5px;color:#9ef3ff;">CHROMA ORBS</span>' +
      '<span id="ch-orbs" style="font-family:\'Martian Mono\';font-weight:700;font-size:14px;color:#fff;">0 / ' + TOTAL_ORBS + '</span></div>' +
      '<div style="display:flex;align-items:center;gap:8px;background:rgba(12,16,24,.5);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:6px 12px;">' +
      '<span style="font-family:\'Martian Mono\';font-size:10px;letter-spacing:1.5px;color:rgba(255,255,255,.6);">SURVIVED</span>' +
      '<span id="ch-time" style="font-family:\'Martian Mono\';font-weight:700;font-size:13px;color:#fff;">0s</span></div>';
    ui.appendChild(topLeft);

    // top-center detection meter
    var det = el('<div style="position:absolute;top:14px;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:5px;"></div>');
    det.innerHTML =
      '<div id="ch-state" style="font-family:\'Martian Mono\';font-size:11px;font-weight:700;letter-spacing:2px;color:#9ef3ff;text-shadow:0 2px 8px rgba(0,0,0,.5);">HIDDEN</div>' +
      '<div style="width:210px;height:9px;background:rgba(0,0,0,.4);border:1px solid rgba(255,255,255,.25);border-radius:99px;overflow:hidden;">' +
      '<div id="ch-det" style="height:100%;width:0%;background:#59c26b;transition:width .1s linear,background .2s;"></div></div>';
    ui.appendChild(det);

    // bottom-center interaction prompt
    var prompt = el('<div style="position:absolute;bottom:74px;left:50%;transform:translateX(-50%);font-family:\'Martian Mono\';font-size:12px;font-weight:600;color:#fff;background:rgba(12,16,24,.6);border:1px solid rgba(255,255,255,.18);border-radius:10px;padding:7px 14px;opacity:0;transition:opacity .15s;"></div>');
    ui.appendChild(prompt);

    // bottom-left controls
    var ctrls = el('<div style="position:absolute;bottom:14px;left:16px;font-family:\'Martian Mono\';font-size:9.5px;line-height:1.7;color:rgba(255,255,255,.65);background:rgba(12,16,24,.4);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:8px 11px;"></div>');
    ctrls.innerHTML = '<b style="color:#9ef3ff">WASD</b> move &nbsp; <b style="color:#9ef3ff">SHIFT</b> sneak &nbsp; <b style="color:#9ef3ff">E</b> blend &nbsp; <b style="color:#9ef3ff">F</b> hide / grab &nbsp; <b style="color:#9ef3ff">drag</b> camera';
    ui.appendChild(ctrls);

    // minimap (bottom-right)
    var mapWrap = el('<div style="position:absolute;bottom:14px;right:14px;background:rgba(12,16,24,.55);border:1px solid rgba(255,255,255,.15);border-radius:12px;padding:7px;"></div>');
    var mapCv = document.createElement('canvas'); mapCv.width = 150; mapCv.height = 110; mapCv.style.cssText = 'display:block;border-radius:6px;';
    mapWrap.appendChild(mapCv); ui.appendChild(mapWrap); var mapCtx = mapCv.getContext('2d');

    // big overlay (start / win / lose / pause)
    var overlay = el('<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;text-align:center;background:radial-gradient(ellipse at center,rgba(8,12,20,.35),rgba(8,12,20,.75));pointer-events:auto;"></div>');
    ui.appendChild(overlay);
    function showOverlay(html) { overlay.innerHTML = html; overlay.style.display = 'flex'; wireOverlay(); }
    function hideOverlay() { overlay.style.display = 'none'; }
    function startCard() {
      return '<div style="font-family:\'Martian Mono\';font-size:11px;letter-spacing:4px;color:#9ef3ff;">EZ ORIGINAL · 3D HIDE &amp; SEEK</div>' +
        '<div style="font-family:\'Martian Mono\';font-weight:800;font-size:46px;color:#fff;text-shadow:0 0 30px rgba(57,208,216,.6);">CHROMA HIDE</div>' +
        '<div style="max-width:440px;font-size:14px;color:rgba(255,255,255,.8);line-height:1.55;">Collect all <b style="color:#9ef3ff">' + TOTAL_ORBS + ' Chroma Orbs</b> hidden across the apartment. Blend your skin into nearby surfaces, slip into hiding spots, and stay out of the <b style="color:#ff6a6a">Seeker\'s</b> sight.</div>' +
        '<button data-act="play" style="pointer-events:auto;cursor:pointer;margin-top:6px;font-family:\'Martian Mono\';font-weight:700;font-size:14px;letter-spacing:1px;color:#06121a;background:#39d0d8;border:0;border-radius:12px;padding:12px 30px;box-shadow:0 8px 30px rgba(57,208,216,.5);">▶ PLAY</button>';
    }
    function endCard(win) {
      return '<div style="font-family:\'Martian Mono\';font-weight:800;font-size:44px;color:' + (win ? '#59f0a8' : '#ff6a6a') + ';text-shadow:0 0 30px ' + (win ? 'rgba(89,240,168,.6)' : 'rgba(255,106,106,.55)') + ';">' + (win ? 'ALL ORBS FOUND!' : 'SPOTTED!') + '</div>' +
        '<div style="font-size:14px;color:rgba(255,255,255,.82);">' + (win ? 'You collected every orb in <b>' + Math.floor(time) + 's</b>.' : 'The Seeker caught you after <b>' + Math.floor(time) + 's</b> · ' + collected + '/' + TOTAL_ORBS + ' orbs.') + '</div>' +
        '<button data-act="play" style="pointer-events:auto;cursor:pointer;margin-top:6px;font-family:\'Martian Mono\';font-weight:700;font-size:14px;color:#06121a;background:#39d0d8;border:0;border-radius:12px;padding:11px 26px;">↻ PLAY AGAIN</button>';
    }
    function wireOverlay() {
      var b = overlay.querySelector('[data-act="play"]');
      if (b) b.addEventListener('click', function () { reset(); });
    }
    showOverlay(startCard());

    function updateHud() {
      var o = document.getElementById('ch-orbs'); if (o) o.textContent = collected + ' / ' + TOTAL_ORBS;
      var tt = document.getElementById('ch-time'); if (tt) tt.textContent = Math.floor(time) + 's';
    }

    /* ============================ INPUT =========================== */
    var keymap = { ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down', ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right' };
    function onKey(down) {
      return function (e) {
        var ae = document.activeElement; if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) return;
        if (!started || over) { if (down && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); reset(); } return; }
        if (down && (e.key === 'e' || e.key === 'E')) { e.preventDefault(); blendNow(); return; }
        if (down && (e.key === 'f' || e.key === 'F')) { e.preventDefault(); interact(); return; }
        if (e.key === 'Shift') { crouch = down; return; }
        var k = keymap[e.key]; if (!k) return; e.preventDefault(); keys[k] = down;
      };
    }
    var keyDown = onKey(true), keyUp = onKey(false);
    window.addEventListener('keydown', keyDown, true);
    window.addEventListener('keyup', keyUp, true);

    // drag to orbit camera
    var dragging = false, lastX = 0;
    function pd(e) { dragging = true; lastX = (e.touches ? e.touches[0].clientX : e.clientX); }
    function pm(e) { if (!dragging) return; var x = (e.touches ? e.touches[0].clientX : e.clientX); manualYaw -= (x - lastX) * 0.008; lastX = x; }
    function pu() { dragging = false; }
    canvas.addEventListener('mousedown', pd); window.addEventListener('mousemove', pm); window.addEventListener('mouseup', pu);
    canvas.addEventListener('touchstart', pd, { passive: true }); window.addEventListener('touchmove', pm, { passive: true }); window.addEventListener('touchend', pu);

    function blendNow() {
      var c = nearestSurfaceColor(); playerSkinColor.copy(c);
      burst(tmp.set(player.position.x, 1.1, player.position.z), '#' + c.getHexString(), 12, 1.4, 2.2);
    }
    function interact() {
      if (!inSpot) return;
      if (inSpot.type === 'wardrobe') {
        inSpot.door.open = !inSpot.door.open;
      } else if (inSpot.type === 'box') {
        inSpot.engaged = !inSpot.engaged;
      }
    }

    /* ============================ RESIZE ========================== */
    var composer, bloom;
    function buildComposer() {
      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.42, 0.7, 0.9);
      composer.addPass(bloom);
      composer.addPass(new OutputPass());
    }
    buildComposer();
    function resize() {
      var r = canvas.getBoundingClientRect(); if (r.width < 4 || r.height < 4) return;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      renderer.setPixelRatio(dpr); renderer.setSize(r.width, r.height, false);
      composer.setPixelRatio(dpr); composer.setSize(r.width, r.height); bloom.setSize(r.width, r.height);
      camera.aspect = r.width / r.height; camera.updateProjectionMatrix();
    }
    window.addEventListener('resize', resize);

    /* ============================ UPDATE ========================== */
    function update(dt) {
      if (!started || over || paused) return;
      time += dt;

      // ---- movement (camera-relative) ----
      var ix = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      var iz = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
      var moving = (ix || iz) ? 1 : 0;
      // camera basis on ground
      var fwd = tmp.set(player.position.x - camera.position.x, 0, player.position.z - camera.position.z);
      if (fwd.lengthSq() < 0.001) fwd.set(0, 0, -1); fwd.normalize();
      var rightV = tmp2.set(fwd.z, 0, -fwd.x);
      var wishX = fwd.x * (-iz) + rightV.x * ix;
      var wishZ = fwd.z * (-iz) + rightV.z * ix;
      var wl = Math.hypot(wishX, wishZ); if (wl > 0) { wishX /= wl; wishZ /= wl; }
      var engagedBox = inSpot && inSpot.type === 'box' && inSpot.engaged;
      var speed = crouch ? 4.2 : (engagedBox ? 2.6 : 8.2);
      var accel = moving ? 11 : 16;
      pVel.x = damp(pVel.x, wishX * speed, accel, dt);
      pVel.z = damp(pVel.z, wishZ * speed, accel, dt);
      player.position.x += pVel.x * dt; player.position.z += pVel.z * dt;
      resolveCollision(player.position, 0.7);
      var moveMag = Math.hypot(pVel.x, pVel.z);
      if (moveMag > 0.4) { pHeading = Math.atan2(pVel.x, pVel.z); }
      player.rotation.y = angLerp(player.rotation.y, pHeading, 1 - Math.exp(-10 * dt));
      var crouchY = crouch ? -0.28 : 0;
      player.position.y = lerp(player.position.y, crouchY, 1 - Math.exp(-12 * dt));

      // ---- player animation ----
      var gait = time * (6 + moveMag * 0.6);
      var sw = moveMag > 0.4 ? Math.sin(gait) * 0.5 : 0;
      player.legs[0].rotation.x = sw; player.legs[3].rotation.x = sw;
      player.legs[1].rotation.x = -sw; player.legs[2].rotation.x = -sw;
      player.body.rotation.z = Math.sin(gait) * 0.04 * (moveMag > 0.4 ? 1 : 0);
      player.body.scale.y = 0.9 + Math.sin(time * 2.2) * 0.02; // breathe
      // tail sway (layered over the fixed coil pitch)
      for (var ti = 0; ti < player.tail.length; ti++) { player.tail[ti].rotation.y = Math.sin(time * 2.5 + ti * 0.55) * 0.1; }
      // eyes dart toward seeker occasionally
      var toSeek = Math.atan2(seeker.position.x - player.position.x, seeker.position.z - player.position.z) - player.rotation.y;
      player.eyes[0].rotation.y = lerp(player.eyes[0].rotation.y, clamp(toSeek, -0.7, 0.7), 0.05);
      player.eyes[1].rotation.y = lerp(player.eyes[1].rotation.y, Math.sin(time * 0.7) * 0.5, 0.04);

      // ---- camo blend ----
      var ref = nearestSurfaceColor();
      var cd = colorDist(playerSkinColor, ref);
      camoMatch = clamp(1 - cd / 0.6, 0, 1);
      player.setSkin(playerSkinColor);

      // ---- hiding spots ----
      inSpot = null; var promptText = '';
      for (var hi = 0; hi < hideSpots.length; hi++) {
        var s = hideSpots[hi]; var d = Math.hypot(player.position.x - s.x, player.position.z - s.z);
        if (d < s.r) {
          inSpot = s;
          if (s.type === 'wardrobe') promptText = 'F · ' + (s.door.open ? 'close ' : 'open ') + s.name;
          else if (s.type === 'box') promptText = 'F · ' + (s.engaged ? 'leave ' : 'hide in ') + s.name;
          else promptText = (crouch ? 'hidden ' : 'SHIFT to crouch ') + s.name;
          break;
        }
      }
      // animate wardrobe doors + box lid
      hideSpots.forEach(function (s) {
        if (s.door) { var t = s.door.open ? -1.25 : 0; s.door.l.rotation.y = lerp(s.door.l.rotation.y, t, 0.18); s.door.r.rotation.y = lerp(s.door.r.rotation.y, -t, 0.18); }
        if (s.lid) { var ly = (s.engaged ? s.baseLidY + 0.5 : s.baseLidY); s.lid.position.y = lerp(s.lid.position.y, ly, 0.18); }
      });
      // determine hidden status
      hidden = false;
      if (inSpot) {
        if (inSpot.type === 'wardrobe') hidden = inSpot.door.open === false && Math.hypot(player.position.x - inSpot.x, player.position.z - inSpot.z) < 1.4; // hidden when doors shut & inside
        else if (inSpot.type === 'wardrobe') hidden = false;
        else if (inSpot.type === 'box') hidden = !!inSpot.engaged;
        else if (inSpot.crouch) hidden = crouch;
      }
      // wardrobe: you must be inside, then it counts as hidden whether open/closed if inside deep
      if (inSpot && inSpot.type === 'wardrobe' && Math.hypot(player.position.x - inSpot.x, player.position.z - inSpot.z) < 1.3) hidden = true;

      // prompt UI
      if (promptText) { prompt.textContent = promptText; prompt.style.opacity = '1'; } else prompt.style.opacity = '0';

      // ---- collect orbs ----
      for (var oi = 0; oi < orbs.length; oi++) {
        var ob = orbs[oi]; if (ob.userData.taken) continue;
        ob.position.y = 1.3 + Math.sin(time * 2 + ob.userData.phase) * 0.18;
        ob.rotation.y += dt * 1.4; ob.userData.core.rotation.x += dt * 0.9;
        if (Math.hypot(player.position.x - ob.position.x, player.position.z - ob.position.z) < 1.3) {
          ob.userData.taken = true; ob.visible = false; collected++;
          burst(tmp.set(ob.position.x, ob.position.y, ob.position.z), '#9ef3ff', 18, 2.0, 3.0);
          updateHud();
          if (collected >= TOTAL_ORBS) { won = true; over = true; showOverlay(endCard(true)); if (opts.onState) opts.onState('over'); }
        }
      }

      // ---- seeker AI ----
      updateSeeker(dt, moveMag);

      // ---- score ----
      var sc = Math.floor(time);
      if (opts.onScore) opts.onScore(sc);
      if (sc > best) { best = sc; if (opts.onBest) opts.onBest(best); }
      if ((Math.floor(time * 2) % 2) === 0) updateHud();
    }

    function updateSeeker(dt, playerMove) {
      ai.t += dt; ai.bob += dt;
      // vision parameters, reduced by camo/stealth
      var stealth = camoMatch * (playerMove > 0.4 ? 0.35 : 1.0) * (crouch ? 1.2 : 1.0);
      var baseRange = 17, range = baseRange * (1 - clamp(stealth, 0, 0.85) * 0.8);
      var fov = 0.66; // half-angle cos compare via dot
      var ex = seeker.position.x, ez = seeker.position.z;
      var dx = player.position.x - ex, dz = player.position.z - ez; var pd = Math.hypot(dx, dz);
      var facing = seeker.rotation.y;
      var toDot = (Math.sin(facing) * dx + Math.cos(facing) * dz) / (pd || 1);
      var inCone = toDot > Math.cos(fov);
      var noise = playerMove * (crouch ? 0.25 : 1.0); // movement noise
      var heard = pd < 6.5 * (crouch ? 0.5 : 1.0) && noise > 0.5;
      var sees = !hidden && pd < range && inCone && losClear(ex, 1.4, ez, player.position.x, 1.0, player.position.z);

      if (sees) detection = clamp(detection + dt * (1.4 + (1 - pd / range) * 1.6), 0, 1);
      else detection = clamp(detection - dt * (ai.state === 'chase' ? 0.25 : 0.55), 0, 1);

      // state transitions
      if (detection >= 1) { ai.state = 'chase'; ai.last.copy(player.position); ai.lostT = 0; }
      else if (ai.state === 'chase') { ai.lostT = (ai.lostT || 0) + dt; if (ai.lostT > 2.2) { ai.state = 'search'; ai.t = 0; } }
      else if ((sees || heard) && detection > 0.25) { ai.state = 'alert'; ai.last.copy(player.position); ai.t = 0; }
      else if (ai.state === 'alert' && ai.t > 3.0) { ai.state = 'patrol'; newWaypoint(); }
      else if (ai.state === 'search' && ai.t > 3.5) { ai.state = 'patrol'; newWaypoint(); }

      var target, sSpeed;
      if (ai.state === 'chase') { target = player.position; sSpeed = 9.0; if (sees) ai.last.copy(player.position); else target = ai.last; }
      else if (ai.state === 'alert') { target = ai.last; sSpeed = 6.2; }
      else if (ai.state === 'search') { target = ai.last; sSpeed = 4.0; }
      else { target = ai.wp; sSpeed = 4.6; if (Math.hypot(ex - ai.wp.x, ez - ai.wp.z) < 2) newWaypoint(); }

      var sdx = target.x - ex, sdz = target.z - ez; var sl = Math.hypot(sdx, sdz);
      if (sl > 0.1) {
        sdx /= sl; sdz /= sl;
        seeker.position.x += sdx * sSpeed * dt; seeker.position.z += sdz * sSpeed * dt;
        resolveCollision(seeker.position, 0.9);
        seeker.rotation.y = angLerp(seeker.rotation.y, Math.atan2(sdx, sdz), 1 - Math.exp(-7 * dt));
      }
      seeker.position.y = 1.45 + Math.sin(ai.bob * 2.4) * 0.12;
      seeker.children && (seeker.ring.rotation.z += dt * 3);

      // visuals: eye/cone color by state
      var col = ai.state === 'chase' ? 0xff4d4d : (ai.state === 'patrol' ? 0x59c26b : 0xffc73a);
      seeker.eyeMat.color.setHex(0x111418); seeker.eyeMat.emissive.setHex(col);
      seeker.coneMat.color.setHex(col); seeker.coneMat.opacity = 0.10 + detection * 0.12;
      // scale cone to range
      seeker.cone.scale.set(range * Math.tan(fov), range * Math.tan(fov), range);
      seekerLight.position.set(seeker.position.x, seeker.position.y + 0.2, seeker.position.z);
      seekerLight.color.setHex(col); seekerLight.intensity = ai.state === 'chase' ? 2.2 : 0.6;

      // catch
      if (ai.state === 'chase' && pd < 1.8 && !hidden) {
        over = true; burst(tmp.set(player.position.x, 1.2, player.position.z), '#ff6a6a', 22, 2.4, 3.2);
        showOverlay(endCard(false)); if (opts.onState) opts.onState('over');
      }
    }

    /* ====================== PARTICLE UPDATE ======================= */
    function updateParticles(dt) {
      // dust drift
      var a = dustGeo.attributes.position.array;
      for (var i = 0; i < dustN; i++) {
        a[i * 3 + 1] += Math.sin(time * 0.5 + i) * 0.002 + 0.004;
        if (a[i * 3 + 1] > WALL_H - 0.3) a[i * 3 + 1] = 0.5;
      }
      dustGeo.attributes.position.needsUpdate = true;
      dust.rotation.y += dt * 0.01;
      // puffs
      for (var p = 0; p < puffs.length; p++) {
        var pf = puffs[p]; if (!pf.sp.visible) continue;
        pf.life += dt; var k = pf.life / pf.max;
        if (k >= 1) { pf.sp.visible = false; pf.sp.material.opacity = 0; continue; }
        pf.vel.y -= dt * 1.6;
        pf.sp.position.x += pf.vel.x * dt; pf.sp.position.y += pf.vel.y * dt; pf.sp.position.z += pf.vel.z * dt;
        var sc = pf.scale0 * (0.5 + k * 1.4); pf.sp.scale.set(sc, sc, sc);
        pf.sp.material.opacity = (1 - k) * 0.9;
      }
    }

    /* ============================ CAMERA ========================== */
    var camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), desired = new THREE.Vector3();
    function updateCamera(dt) {
      // auto-follow behind movement heading, plus manual drag offset
      if (Math.hypot(pVel.x, pVel.z) > 1.2) camYawTarget = pHeading + Math.PI;
      camYaw = angLerp(camYaw, camYawTarget, 1 - Math.exp(-2.6 * dt));
      var yaw = camYaw + manualYaw;
      var dist = 8.0, height = 7.0, minD = 4.2;
      desired.set(player.position.x + Math.sin(yaw) * dist, player.position.y + height, player.position.z + Math.cos(yaw) * dist);
      // keep camera inside the apartment
      desired.x = clamp(desired.x, -HALF_X + 1.2, HALF_X - 1.2);
      desired.z = clamp(desired.z, -HALF_Z + 1.2, HALF_Z - 1.2);
      // pull in (and lift) if a wall blocks the view of the player
      tmp.set(desired.x - player.position.x, 0, desired.z - player.position.z); var dlen = tmp.length(); tmp.normalize();
      raycaster.set(tmp2.set(player.position.x, 1.4, player.position.z), tmp); raycaster.far = dlen;
      var hit = raycaster.intersectObjects(occluders, false);
      if (hit.length) {
        var hd = Math.max(minD, hit[0].distance - 0.7);
        desired.set(player.position.x + tmp.x * hd, player.position.y + height + (1 - hd / dist) * 2.0, player.position.z + tmp.z * hd);
      }
      // push the camera out of any wall/furniture box so it never clips inside one
      for (var ci = 0; ci < colliders.length; ci++) {
        var c = colliders[ci]; var hx = (c.maxX - c.minX) / 2 + 0.9, hz = (c.maxZ - c.minZ) / 2 + 0.9;
        var cx = (c.minX + c.maxX) / 2, cz = (c.minZ + c.maxZ) / 2; var dx = desired.x - cx, dz = desired.z - cz;
        if (Math.abs(dx) < hx && Math.abs(dz) < hz) { var ox = hx - Math.abs(dx), oz = hz - Math.abs(dz); if (ox < oz) desired.x = cx + (dx < 0 ? -hx : hx); else desired.z = cz + (dz < 0 ? -hz : hz); }
      }
      camPos.lerp(desired, 1 - Math.exp(-7 * dt)); camera.position.copy(camPos);
      camLook.lerp(tmp.set(player.position.x, player.position.y + 1.2, player.position.z), 1 - Math.exp(-9 * dt));
      camera.lookAt(camLook);
    }

    /* ============================ MINIMAP ========================= */
    function drawMap() {
      var W = mapCv.width, H = mapCv.height; mapCtx.clearRect(0, 0, W, H);
      function mx(x) { return (x + HALF_X) / (HALF_X * 2) * W; }
      function mz(z) { return (z + HALF_Z) / (HALF_Z * 2) * H; }
      // room fills
      mapCtx.fillStyle = 'rgba(255,255,255,.06)'; mapCtx.fillRect(0, 0, W, H);
      // walls
      mapCtx.strokeStyle = 'rgba(255,255,255,.5)'; mapCtx.lineWidth = 1;
      mapCtx.strokeRect(1, 1, W - 2, H - 2);
      mapCtx.beginPath(); mapCtx.moveTo(mx(0), 0); mapCtx.lineTo(mx(0), mz(-DOOR)); mapCtx.moveTo(mx(0), mz(DOOR)); mapCtx.lineTo(mx(0), H);
      mapCtx.moveTo(0, mz(0)); mapCtx.lineTo(mx(-DOOR), mz(0)); mapCtx.moveTo(mx(DOOR), mz(0)); mapCtx.lineTo(W, mz(0)); mapCtx.stroke();
      // orbs
      orbs.forEach(function (o) { if (o.userData.taken) return; mapCtx.fillStyle = '#39d0d8'; mapCtx.beginPath(); mapCtx.arc(mx(o.position.x), mz(o.position.z), 2.2, 0, 7); mapCtx.fill(); });
      // seeker + cone
      var col = ai.state === 'chase' ? '#ff4d4d' : (ai.state === 'patrol' ? '#59c26b' : '#ffc73a');
      mapCtx.fillStyle = col; mapCtx.beginPath(); mapCtx.arc(mx(seeker.position.x), mz(seeker.position.z), 3, 0, 7); mapCtx.fill();
      // player
      mapCtx.save(); mapCtx.translate(mx(player.position.x), mz(player.position.z)); mapCtx.rotate(-player.rotation.y);
      mapCtx.fillStyle = hidden ? '#9ef3ff' : '#fff'; mapCtx.beginPath(); mapCtx.moveTo(0, -4); mapCtx.lineTo(3, 3); mapCtx.lineTo(-3, 3); mapCtx.closePath(); mapCtx.fill(); mapCtx.restore();
    }

    /* =========================== HUD COLORS ======================= */
    function updateDetUI() {
      var fill = document.getElementById('ch-det'), st = document.getElementById('ch-state'); if (!fill) return;
      fill.style.width = Math.round(detection * 100) + '%';
      var label, color;
      if (ai.state === 'chase') { label = 'SPOTTED — RUN!'; color = '#ff4d4d'; }
      else if (detection > 0.55) { label = 'SUSPICIOUS'; color = '#ffc73a'; }
      else if (hidden) { label = 'HIDDEN'; color = '#9ef3ff'; }
      else if (camoMatch > 0.6 && Math.hypot(pVel.x, pVel.z) < 0.5) { label = 'BLENDED'; color = '#59f0a8'; }
      else { label = 'EXPOSED'; color = '#9ef3ff'; }
      fill.style.background = color; st.textContent = label; st.style.color = color;
    }

    /* ============================ RENDER ========================== */
    function frame(now) {
      if (last == null) last = now; var dt = Math.min(0.05, (now - last) / 1000); last = now;
      update(dt);
      updateParticles(dt);
      updateCamera(dt);
      updateDetUI();
      drawMap();
      composer.render();
      raf = requestAnimationFrame(frame);
    }

    placeStart();
    resize(); raf = requestAnimationFrame(frame);

    /* ========================== CONTROLLER ======================== */
    return {
      reset: reset,
      isPaused: function () { return paused; },
      pause: function () { paused = true; if (started && !over) showOverlay('<div style="font-family:\'Martian Mono\';font-weight:800;font-size:38px;color:#fff;">PAUSED</div>'); },
      resume: function () { paused = false; if (started && !over) hideOverlay(); last = null; },
      togglePause: function () { if (paused) this.resume(); else this.pause(); return paused; },
      resize: resize,
      dispose: function () {
        cancelAnimationFrame(raf);
        window.removeEventListener('keydown', keyDown, true);
        window.removeEventListener('keyup', keyUp, true);
        window.removeEventListener('resize', resize);
        canvas.removeEventListener('mousedown', pd); window.removeEventListener('mousemove', pm); window.removeEventListener('mouseup', pu);
        canvas.removeEventListener('touchstart', pd); window.removeEventListener('touchmove', pm); window.removeEventListener('touchend', pu);
        if (ui.parentElement) ui.parentElement.removeChild(ui);
        composer.dispose(); pmrem.dispose(); renderer.dispose();
      }
    };
  }

  (root.EZGames || (root.EZGames = {})).hideout = { mount: mount };
})(window);
