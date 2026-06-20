/* ===== EZ game — MECCHA CHAMELEON (browser replica) =====
 * A browser/WebGL take on the Steam hit: a 3D hide & seek where you survive a
 * roaming hunter by CAMOUFLAGING — paint your body to match nearby surfaces so
 * the hunter literally can't see you. Move or mismatch and you get exposed.
 * Registers as window.EZGames.hideout.mount(canvas, opts) -> controller.
 *
 * STEP 1 upgrade (assets + audio): procedural PBR textures + normal maps, an
 * environment map for grounded reflections, a charming rounded chameleon
 * character with smooth colour-morph, and a fully synthesized Web Audio layer
 * (ambient, footsteps, absorb blip, proximity heartbeat, spotted/caught stings).
 * Everything is generated in-browser — no asset downloads, no network.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';

// warm cinematic colour grade + gentle vignette (operates in linear space)
var GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    warmth: { value: 0.06 },      // push highlights warm, shadows cool
    saturation: { value: 1.12 },
    vignette: { value: 0.5 },
    lift: { value: 0.015 }
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: [
    'uniform sampler2D tDiffuse; uniform float warmth; uniform float saturation; uniform float vignette; uniform float lift; varying vec2 vUv;',
    'void main(){',
    '  vec4 c = texture2D(tDiffuse, vUv);',
    '  vec3 col = c.rgb + lift;',
    '  float l = dot(col, vec3(0.2126,0.7152,0.0722));',     // luma
    '  col = mix(vec3(l), col, saturation);',                  // saturation
    '  col.r += warmth * l; col.b -= warmth * l * 0.8;',       // warm grade
    '  vec2 d = vUv - 0.5; float v = 1.0 - dot(d,d) * vignette;', // vignette
    '  col *= clamp(v, 0.0, 1.0);',
    '  gl_FragColor = vec4(max(col, 0.0), c.a);',
    '}'
  ].join('\n')
};

(function (root) {
  'use strict';

  // ---------- procedural texture helpers (no external assets) ----------
  function mkCanvas(size) { var c = document.createElement('canvas'); c.width = c.height = size; return c; }
  function colorTex(size, draw) {
    var c = mkCanvas(size); draw(c.getContext('2d'), size);
    var t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  }
  function grayTex(size, draw) {
    var c = mkCanvas(size); draw(c.getContext('2d'), size);
    var t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  }
  // build a tangent-space normal map from a grayscale height drawing
  function normalTex(size, drawHeight, strength) {
    var h = mkCanvas(size), hc = h.getContext('2d');
    hc.fillStyle = '#808080'; hc.fillRect(0, 0, size, size); drawHeight(hc, size);
    var src = hc.getImageData(0, 0, size, size).data;
    var out = mkCanvas(size), oc = out.getContext('2d');
    var img = oc.createImageData(size, size), d = img.data;
    function H(x, y) { x = (x + size) % size; y = (y + size) % size; return src[(y * size + x) * 4] / 255; }
    for (var y = 0; y < size; y++) for (var x = 0; x < size; x++) {
      var dx = (H(x - 1, y) - H(x + 1, y)) * strength;
      var dy = (H(x, y - 1) - H(x, y + 1)) * strength;
      var l = Math.hypot(dx, dy, 1), i = (y * size + x) * 4;
      d[i] = (dx / l * 0.5 + 0.5) * 255; d[i + 1] = (dy / l * 0.5 + 0.5) * 255;
      d[i + 2] = (1 / l * 0.5 + 0.5) * 255; d[i + 3] = 255;
    }
    oc.putImageData(img, 0, 0);
    var t = new THREE.CanvasTexture(out); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
  }
  function speckle(ctx, size, n, sz, alpha, hueFn) {
    for (var i = 0; i < n; i++) {
      ctx.globalAlpha = alpha * (0.4 + Math.random() * 0.6);
      ctx.fillStyle = hueFn();
      var r = sz * (0.4 + Math.random());
      ctx.beginPath(); ctx.arc(Math.random() * size, Math.random() * size, r, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function buildTextures() {
    var T = {};
    // grass: mottled green albedo + soft bumpy normal
    T.grassMap = colorTex(256, function (ctx, s) {
      ctx.fillStyle = '#5fae3a'; ctx.fillRect(0, 0, s, s);
      speckle(ctx, s, 1400, 2.2, 0.5, function () {
        var g = 120 + ((Math.random() * 90) | 0); return 'rgb(' + (40 + (Math.random() * 50 | 0)) + ',' + g + ',' + (40 + (Math.random() * 40 | 0)) + ')';
      });
    });
    T.grassNormal = normalTex(128, function (ctx, s) {
      speckle(ctx, s, 700, 2.5, 0.6, function () { return Math.random() > 0.5 ? '#fff' : '#000'; });
    }, 2.2);
    // plaster wall: warm off-white with fine grain
    T.wallMap = colorTex(256, function (ctx, s) {
      ctx.fillStyle = '#efe6d4'; ctx.fillRect(0, 0, s, s);
      speckle(ctx, s, 2200, 1.4, 0.10, function () { return Math.random() > 0.5 ? '#fff' : '#cdbfa3'; });
    });
    T.wallNormal = normalTex(128, function (ctx, s) {
      speckle(ctx, s, 1200, 1.6, 0.35, function () { return Math.random() > 0.5 ? '#fff' : '#000'; });
    }, 1.0);
    // painted-wood crate: plank seams + grain + scratches (grayscale detail, tinted per-crate)
    T.crateMap = grayTex(256, function (ctx, s) {
      ctx.fillStyle = '#b9b9b9'; ctx.fillRect(0, 0, s, s);
      for (var p = 0; p < 4; p++) { // plank seams
        var yy = (p + 1) * s / 4; ctx.strokeStyle = 'rgba(60,60,60,.55)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(s, yy); ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(255,255,255,.10)'; // grain
      for (var g = 0; g < 60; g++) {
        ctx.lineWidth = 0.6; var y0 = Math.random() * s;
        ctx.beginPath(); ctx.moveTo(0, y0); ctx.bezierCurveTo(s / 3, y0 + (Math.random() - .5) * 6, 2 * s / 3, y0 + (Math.random() - .5) * 6, s, y0); ctx.stroke();
      }
      speckle(ctx, s, 90, 1.4, 0.25, function () { return Math.random() > .5 ? '#fff' : '#3a3a3a'; }); // scratches
    });
    T.crateNormal = normalTex(256, function (ctx, s) {
      ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
      for (var p = 0; p < 4; p++) { var yy = (p + 1) * s / 4; ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(s, yy); ctx.stroke(); }
      speckle(ctx, s, 220, 1.6, 0.5, function () { return Math.random() > .5 ? '#fff' : '#000'; });
    }, 1.6);
    return T;
  }

  // ---------- synthesized audio (Web Audio, no files) ----------
  function createAudio() {
    var AC = window.AudioContext || window.webkitAudioContext;
    var api = { muted: false, ready: false };
    if (!AC) { api.unlock = api.foot = api.blip = api.sting = api.poof = api.win = function () {}; api.setTension = function () {}; api.dispose = function () {}; return api; }
    var ctx, master, ambGain, heartTimer = 0;
    function ensure() {
      if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
      ctx = new AC(); master = ctx.createGain(); master.gain.value = api.muted ? 0 : 0.55; master.connect(ctx.destination);
      startAmbient(); api.ready = true;
    }
    function noiseBuf(dur) {
      var n = ctx.sampleRate * dur, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
      for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; return b;
    }
    function startAmbient() {
      ambGain = ctx.createGain(); ambGain.gain.value = 0.06; ambGain.connect(master);
      [110, 110.4, 164.8].forEach(function (f, i) {
        var o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
        var g = ctx.createGain(); g.gain.value = i === 2 ? 0.4 : 1;
        var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600;
        o.connect(g); g.connect(lp); lp.connect(ambGain); o.start();
        var lfo = ctx.createOscillator(); lfo.frequency.value = 0.05 + i * 0.03;
        var lg = ctx.createGain(); lg.gain.value = 0.3; lfo.connect(lg); lg.connect(g.gain); lfo.start();
      });
    }
    function env(node, peak, a, d, t) { t = t || ctx.currentTime; node.gain.cancelScheduledValues(t); node.gain.setValueAtTime(0.0001, t); node.gain.exponentialRampToValueAtTime(peak, t + a); node.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
    api.unlock = ensure;
    api.foot = function (soft) {
      if (!ctx) return; var src = ctx.createBufferSource(); src.buffer = noiseBuf(0.12);
      var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 320; bp.Q.value = 1.2;
      var g = ctx.createGain(); src.connect(bp); bp.connect(g); g.connect(master);
      env(g, soft ? 0.05 : 0.12, 0.005, 0.1); src.start();
    };
    api.blip = function () {
      if (!ctx) return; var o = ctx.createOscillator(); o.type = 'sine';
      var g = ctx.createGain(); o.connect(g); g.connect(master);
      var t = ctx.currentTime; o.frequency.setValueAtTime(520, t); o.frequency.exponentialRampToValueAtTime(1320, t + 0.16);
      env(g, 0.22, 0.01, 0.18, t); o.start(t); o.stop(t + 0.25);
    };
    api.sting = function () { // spotted!
      if (!ctx) return; var o = ctx.createOscillator(); o.type = 'sawtooth';
      var g = ctx.createGain(), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
      o.connect(lp); lp.connect(g); g.connect(master); var t = ctx.currentTime;
      o.frequency.setValueAtTime(440, t); o.frequency.exponentialRampToValueAtTime(150, t + 0.5);
      env(g, 0.3, 0.01, 0.55, t); o.start(t); o.stop(t + 0.6);
    };
    api.poof = function () { // caught
      if (!ctx) return; var src = ctx.createBufferSource(); src.buffer = noiseBuf(0.4);
      var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; var g = ctx.createGain();
      src.connect(lp); lp.connect(g); g.connect(master); var t = ctx.currentTime;
      lp.frequency.setValueAtTime(2200, t); lp.frequency.exponentialRampToValueAtTime(180, t + 0.4);
      env(g, 0.35, 0.005, 0.42, t); src.start(t);
    };
    api.win = function () {
      if (!ctx) return; [523, 659, 784, 1046].forEach(function (f, i) {
        var o = ctx.createOscillator(); o.type = 'triangle'; var g = ctx.createGain();
        o.connect(g); g.connect(master); var t = ctx.currentTime + i * 0.09; o.frequency.value = f;
        env(g, 0.2, 0.01, 0.22, t); o.start(t); o.stop(t + 0.3);
      });
    };
    // tension 0..1 drives a heartbeat; call every frame from update
    api.setTension = function (tension, dt) {
      if (!ctx || tension <= 0.02) { heartTimer = 0; return; }
      heartTimer -= dt; if (heartTimer > 0) return;
      heartTimer = 1.05 - tension * 0.7; // faster when closer
      var t = ctx.currentTime;
      [0, 0.16].forEach(function (off, k) {
        var o = ctx.createOscillator(); o.type = 'sine'; var g = ctx.createGain();
        o.connect(g); g.connect(master); var tt = t + off; o.frequency.setValueAtTime(70, tt);
        o.frequency.exponentialRampToValueAtTime(38, tt + 0.12);
        env(g, (k ? 0.18 : 0.28) * (0.5 + tension * 0.5), 0.005, 0.14, tt); o.start(tt); o.stop(tt + 0.2);
      });
    };
    api.setMuted = function (m) { api.muted = m; if (master) master.gain.value = m ? 0 : 0.55; };
    api.dispose = function () { if (ctx) ctx.close(); };
    return api;
  }

  function mount(canvas, opts) {
    opts = opts || {};
    var parent = canvas.parentElement;
    var TEX = buildTextures();
    var audio = createAudio();

    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setClearColor(0x9ad0ff, 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    var scene = new THREE.Scene();
    scene.background = new THREE.Color(0x9ad0ff);
    scene.fog = new THREE.Fog(0x9ad0ff, 55, 110);

    // environment map -> grounded PBR reflections (generated, no asset file)
    var pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    var camera = new THREE.PerspectiveCamera(55, 1, 0.1, 300);

    scene.add(new THREE.HemisphereLight(0xdff1ff, 0x4f7a3a, 0.7));
    var sun = new THREE.DirectionalLight(0xfff6e0, 1.6);
    sun.position.set(18, 30, 12); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 90;
    sun.shadow.camera.left = -34; sun.shadow.camera.right = 34;
    sun.shadow.camera.top = 34; sun.shadow.camera.bottom = -34;
    sun.shadow.bias = -0.0004; scene.add(sun); scene.add(sun.target);
    // soft warm fill from the opposite side fakes bounced light (baked feel)
    var fill = new THREE.DirectionalLight(0xffe6c0, 0.35); fill.position.set(-16, 14, -10); scene.add(fill);

    var ARENA = 34;
    var GRASS = 0x69bf48;
    TEX.grassMap.repeat.set(16, 16); TEX.grassNormal.repeat.set(16, 16);
    var floor = new THREE.Mesh(new THREE.PlaneGeometry(ARENA * 2, ARENA * 2),
      new THREE.MeshStandardMaterial({ color: 0xbfe6a8, map: TEX.grassMap, normalMap: TEX.grassNormal, roughness: 1 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

    var wallMat = new THREE.MeshStandardMaterial({ color: 0xf0e6d2, map: TEX.wallMap, normalMap: TEX.wallNormal, roughness: 0.92 });
    [[0, -ARENA], [0, ARENA], [-ARENA, 0], [ARENA, 0]].forEach(function (p, i) {
      var horiz = i < 2;
      var wall = new THREE.Mesh(new THREE.BoxGeometry(horiz ? ARENA * 2 : 1, 2.4, horiz ? 1 : ARENA * 2), wallMat);
      wall.position.set(p[0], 1.2, p[1]); wall.castShadow = true; wall.receiveShadow = true; scene.add(wall);
    });

    // colorful crates (cover + the palette you can blend into) — now textured wood
    var crateColors = [0xe8483b, 0x3a7bd5, 0xffc23c, 0xff8a3d, 0x9b59b6, 0x2ec4a6, 0xf25c9a, 0xf0e6d2];
    var blocks = [];
    function rand(a, b) { return a + Math.random() * (b - a); }
    for (var b = 0; b < 16; b++) {
      var s = rand(2, 4.5), hgt = rand(1.6, 3.4);
      var col = crateColors[b % crateColors.length];
      var crate = new THREE.Mesh(new THREE.BoxGeometry(s, hgt, s),
        new THREE.MeshStandardMaterial({ color: col, map: TEX.crateMap, normalMap: TEX.crateNormal, roughness: 0.65, metalness: 0.04 }));
      crate.position.set(rand(-ARENA + 5, ARENA - 5), hgt / 2, rand(-ARENA + 5, ARENA - 5));
      if (Math.hypot(crate.position.x, crate.position.z) < 6) crate.position.x += 9;
      crate.castShadow = true; crate.receiveShadow = true;
      crate.userData.color = new THREE.Color(col);
      scene.add(crate); blocks.push(crate);
    }

    // ---- charming chameleon avatar (rounded body, turret eyes, curled tail) ----
    function avatar(bodyCol, isSeeker) {
      var g = new THREE.Group();
      g.bodyParts = [];
      function body(geo, color, y, x, z) {
        var m = new THREE.MeshStandardMaterial({ color: color, roughness: 0.55, metalness: 0.0 });
        var mesh = new THREE.Mesh(geo, m); mesh.position.set(x || 0, y, z || 0);
        mesh.castShadow = true; g.add(mesh); var rec = { mesh: mesh, mat: m }; g.bodyParts.push(rec); return rec;
      }
      function plain(geo, color, y, x, z, rough, metal) {
        var m = new THREE.MeshStandardMaterial({ color: color, roughness: rough == null ? 0.4 : rough, metalness: metal || 0 });
        var mesh = new THREE.Mesh(geo, m); mesh.position.set(x || 0, y, z || 0); mesh.castShadow = true; g.add(mesh); return mesh;
      }
      // egg-shaped torso
      g.torso = body(new THREE.SphereGeometry(0.7, 20, 16), bodyCol, 1.25);
      g.torso.mesh.scale.set(1.0, 0.95, 1.35);
      // head
      g.head = body(new THREE.SphereGeometry(0.5, 18, 14), bodyCol, 1.55, 0, 0.95);
      g.head.mesh.scale.set(1.0, 0.92, 1.05);
      // crest along the back
      var crest = body(new THREE.ConeGeometry(0.18, 0.5, 8), bodyCol, 1.95, 0, 0.1); crest.mesh.rotation.z = 0;
      // legs (4) — kept as g.limbs so the gait animator can swing them
      g.limbs = [];
      var legGeo = new THREE.CapsuleGeometry(0.14, 0.5, 4, 8);
      [[-0.45, 0.55], [0.45, 0.55], [-0.45, -0.45], [0.45, -0.45]].forEach(function (p) {
        var leg = body(legGeo, bodyCol, 0.55, p[0], p[1]); g.limbs.push(leg);
      });
      // curled tail (segments) — animated as a wag
      g.tail = [];
      var seg = bodyCol, ty = 1.2, tz = -0.7, scale = 0.34;
      for (var i = 0; i < 5; i++) {
        var t = body(new THREE.SphereGeometry(scale, 12, 10), seg, ty, 0, tz);
        g.tail.push(t); tz -= scale * 1.4; ty += i > 2 ? scale * 0.7 : 0; scale *= 0.82;
      }
      // turret eyes (not recoloured) — bulgy with dark pupils
      g.eyes = [];
      [-0.34, 0.34].forEach(function (ex) {
        var e = plain(new THREE.SphereGeometry(0.22, 14, 12), 0xfff4e0, 1.72, ex, 1.05, 0.35);
        var p = plain(new THREE.SphereGeometry(0.09, 10, 8), 0x111111, 1.72, ex, 1.24, 0.2, 0.1);
        g.eyes.push({ ball: e, pupil: p, base: ex });
      });
      if (isSeeker) { // hunter reads as a stalking predator: spikier crest, deeper tone
        crest.mesh.scale.set(1.3, 1.6, 1.3);
        g.scale.setScalar(1.12);
      }
      g.setColor = function (c) { g.bodyParts.forEach(function (pp) { pp.mat.color.copy(c); }); };
      g.anim = makeAnimator(g);
      return g;
    }

    // multi-state animator: blends idle / walk / crouch with an "alert" overlay,
    // adding squash-&-stretch, gait, and tail follow-through (real authored
    // motion, eased between states — not a single raw sine wave).
    function makeAnimator(g) {
      var torsoBaseY = g.torso.mesh.position.y, torsoBaseScale = g.torso.mesh.scale.clone();
      var headBaseY = g.head.mesh.position.y, tail = g.tail;
      var w = { idle: 1, walk: 0, crouch: 0 }, alert = 0, want = 'idle', wantAlert = 0;
      function ease(cur, target, dt, rate) { return cur + (target - cur) * Math.min(1, dt * rate); }
      return {
        set: function (name) { want = name; },
        setAlert: function (a) { wantAlert = a; },
        update: function (dt, t) {
          w.idle = ease(w.idle, want === 'idle' ? 1 : 0, dt, 8);
          w.walk = ease(w.walk, want === 'walk' ? 1 : 0, dt, 8);
          w.crouch = ease(w.crouch, want === 'crouch' ? 1 : 0, dt, 8);
          alert = ease(alert, wantAlert, dt, 6);
          var phase = t * 10;
          // gait: alternating diagonal leg swing, fading with the walk weight
          var s = Math.sin(phase) * w.walk * 0.6, splay = w.crouch * 0.45;
          g.limbs[0].mesh.rotation.x = s; g.limbs[1].mesh.rotation.x = -s;
          g.limbs[2].mesh.rotation.x = -s; g.limbs[3].mesh.rotation.x = s;
          g.limbs.forEach(function (l, i) { l.mesh.rotation.z = splay * ((i % 2 === 0) ? -1 : 1); });
          // body: bounce on footfalls (walk), breathing (idle), squash-&-stretch
          var bounce = w.walk * Math.abs(Math.sin(phase)) * 0.06;
          var breath = w.idle * Math.sin(t * 2) * 0.03;
          g.torso.mesh.position.y = torsoBaseY + bounce + alert * 0.15;
          g.torso.mesh.scale.set(
            torsoBaseScale.x * (1 + w.crouch * 0.2 - bounce * 0.5),
            torsoBaseScale.y * (1 - w.crouch * 0.28 + breath - bounce * 0.3),
            torsoBaseScale.z * (1 + bounce * 0.3));
          g.torso.mesh.rotation.x = -alert * 0.35;            // rears up when alert
          g.head.mesh.position.y = headBaseY + alert * 0.2 + bounce;
          // tail follow-through (lags the body) + lift when alert
          var amp = 0.18 * (0.4 + w.walk + w.idle * 0.3) + alert * 0.25;
          for (var i = 0; i < tail.length; i++) {
            tail[i].mesh.rotation.y = Math.sin(phase * 0.4 - i * 0.5) * amp * (i + 1) / tail.length;
            tail[i].mesh.rotation.x = alert * 0.2 * (i + 1) / tail.length;
          }
        }
      };
    }

    var player = avatar(0xffffff, false); scene.add(player);
    var seeker = avatar(0xd6342a, true); scene.add(seeker);
    var playerColor = new THREE.Color(0xffffff);   // target colour
    var shownColor = new THREE.Color(0xffffff);     // displayed (morphs toward target)
    function setPlayerColor(c) { playerColor.copy(c); flashSplash(c); refreshPalette(); audio.blip(); }

    // ---- state ----
    var keys = {};
    var raycaster = new THREE.Raycaster();
    var tmp = new THREE.Vector3();
    var time = 0, best = 0, over = false, paused = false, raf = 0, last = null;
    var crouch = false, blend = 0, stepT = 0;
    var seek = { mode: 'roam', wp: new THREE.Vector3(), lostT: 0 };

    function newWaypoint() { seek.wp.set(rand(-ARENA + 5, ARENA - 5), 0, rand(-ARENA + 5, ARENA - 5)); }
    function placeStart() {
      player.position.set(0, 0, 0); player.rotation.y = 0;
      seeker.position.set(0, 0, -ARENA + 6); seeker.rotation.y = 0;
      seek.mode = 'roam'; seek.lostT = 0; newWaypoint();
      playerColor.set(0xffffff); shownColor.set(0xffffff); player.setColor(shownColor);
      refreshPalette();
    }
    function reset() { time = 0; over = false; paused = false; crouch = false; placeStart(); hideOverlay(); if (opts.onScore) opts.onScore(0); }

    function canSee(from, to) {
      tmp.copy(to).sub(from); var dist = tmp.length(); tmp.normalize();
      raycaster.set(from.clone().setY(1.4), tmp); raycaster.far = dist - 0.6;
      return raycaster.intersectObjects(blocks, false).length === 0;
    }
    function clampArena(v) { var lim = ARENA - 1.5; v.x = Math.max(-lim, Math.min(lim, v.x)); v.z = Math.max(-lim, Math.min(lim, v.z)); }
    function collideBlocks(pos, radius) {
      for (var i = 0; i < blocks.length; i++) {
        var bx = blocks[i]; var hw = bx.geometry.parameters.width / 2 + radius, hd = bx.geometry.parameters.depth / 2 + radius;
        var dx = pos.x - bx.position.x, dz = pos.z - bx.position.z;
        if (Math.abs(dx) < hw && Math.abs(dz) < hd) {
          var ox = hw - Math.abs(dx), oz = hd - Math.abs(dz);
          if (ox < oz) pos.x = bx.position.x + (dx < 0 ? -hw : hw); else pos.z = bx.position.z + (dz < 0 ? -hd : hd);
        }
      }
    }
    function lookEyes(g, target) {
      if (!g.eyes) return;
      g.eyes.forEach(function (e) {
        tmp.copy(target).sub(g.position); var ang = Math.atan2(tmp.x, tmp.z) - g.rotation.y;
        e.pupil.position.x = e.base + Math.sin(ang) * 0.06;
        e.pupil.position.z = 1.18 + Math.cos(ang) * 0.04;
      });
    }

    // nearest cover colour (what you should blend into); grass if in the open
    var grassColor = new THREE.Color(GRASS);
    function nearestCover() {
      var best = null, bd = 5.0;
      for (var i = 0; i < blocks.length; i++) {
        var d = Math.hypot(player.position.x - blocks[i].position.x, player.position.z - blocks[i].position.z) - blocks[i].geometry.parameters.width / 2;
        if (d < bd) { bd = d; best = blocks[i]; }
      }
      return best ? best.userData.color : grassColor;
    }
    function colorDist(a, c) { var dr = a.r - c.r, dg = a.g - c.g, db = a.b - c.b; return Math.sqrt(dr * dr + dg * dg + db * db); }

    // eyedropper: absorb the colour of the nearest crate (or grass)
    function eyedrop() { setPlayerColor(nearestCover().clone()); flash('ABSORBED'); }

    function update(dt) {
      if (over || paused) return;
      time += dt;

      // smooth colour-morph toward target (no snapping when you repaint)
      shownColor.lerp(playerColor, Math.min(1, dt * 6));
      player.setColor(shownColor);

      var mx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      var mz = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
      var len = Math.hypot(mx, mz);
      var speed = crouch ? 5.5 : 10.5;
      if (len > 0) { mx /= len; mz /= len; }
      player.position.x += mx * speed * dt; player.position.z += mz * speed * dt;
      clampArena(player.position); collideBlocks(player.position, 0.6);
      if (len > 0) player.rotation.y = Math.atan2(mx, mz);
      player.position.y = crouch ? -0.45 : 0;
      player.anim.set(crouch ? 'crouch' : (len > 0 ? 'walk' : 'idle'));
      player.anim.update(dt, time);
      lookEyes(player, seeker.position);

      // footstep audio timed to gait
      if (len > 0) { stepT -= dt; if (stepT <= 0) { stepT = crouch ? 0.42 : 0.30; audio.foot(crouch); } } else stepT = 0;

      // ---- camouflage (uses the displayed colour so the morph matters) ----
      var ref = nearestCover();
      var cd = colorDist(shownColor, ref);            // 0 = perfect match
      var match = Math.max(0, 1 - cd / 0.55);         // how well colour matches
      var moving = len > 0;
      blend = match;
      if (moving) blend *= 0.32;                       // motion gives you away
      if (crouch) blend = Math.min(1, blend + 0.12);   // crouching helps
      blend = Math.max(0, Math.min(1, blend));

      // seeker AI with camo-aware sight
      var toP = tmp.copy(player.position).sub(seeker.position); var dP = toP.length();
      var sight = 19 * (1 - blend * 0.82);             // blended+still -> tiny sight radius
      var sees = dP < Math.max(2.6, sight) && canSee(seeker.position, player.position);
      if (sees) { seek.mode = 'chase'; seek.lostT = 0; }
      else if (seek.mode === 'chase') { seek.lostT += dt; if (seek.lostT > 1.5) { seek.mode = 'roam'; newWaypoint(); } }

      var target, sSpeed;
      if (seek.mode === 'chase') { target = player.position; sSpeed = 8.6; }
      else { target = seek.wp; sSpeed = 5.0; if (seeker.position.distanceTo(seek.wp) < 2) newWaypoint(); }
      var sd = tmp.copy(target).sub(seeker.position); sd.y = 0;
      if (sd.length() > 0.001) {
        sd.normalize();
        seeker.position.x += sd.x * sSpeed * dt; seeker.position.z += sd.z * sSpeed * dt;
        clampArena(seeker.position); collideBlocks(seeker.position, 0.6);
        seeker.rotation.y = Math.atan2(sd.x, sd.z);
      }
      seeker.anim.set('walk'); seeker.anim.setAlert(seek.mode === 'chase' ? 1 : 0);
      seeker.anim.update(dt, time * 1.1);
      lookEyes(seeker, player.position);

      // proximity heartbeat: rises as the hunter closes in
      var tension = seek.mode === 'chase' ? 1 : Math.max(0, 1 - dP / 16);
      audio.setTension(tension, dt);

      if (dP < 1.7) caught();

      updateCamoHud(blend, seek.mode === 'chase');
      var sc = Math.floor(time);
      if (opts.onScore) opts.onScore(sc);
      if (sc > best) { best = sc; if (opts.onBest) opts.onBest(best); }
    }

    function caught() { over = true; audio.sting(); audio.poof(); showOverlay('SPOTTED!', 'survived ' + Math.floor(time) + 's · press space to retry', '#d6342a'); if (opts.onState) opts.onState('over'); }

    // ---- HUD: overlay + camo meter + colour palette ----
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;gap:8px;font-family:\'Martian Mono\',monospace;text-align:center;pointer-events:none;z-index:4;';
    parent.appendChild(overlay);
    function showOverlay(t, s, c) {
      overlay.innerHTML = '<div style="font-size:42px;font-weight:800;color:' + c + ';text-shadow:0 3px 0 rgba(0,0,0,0.25)">' + t + '</div>' +
        (s ? '<div style="font-family:\'Space Grotesk\',sans-serif;font-size:14px;color:#fff;text-shadow:0 2px 6px rgba(0,0,0,0.5)">' + s + '</div>' : '');
      overlay.style.display = 'flex';
    }
    function hideOverlay() { overlay.style.display = 'none'; }

    var camo = document.createElement('div');
    camo.style.cssText = 'position:absolute;top:14px;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:5px;font-family:\'Martian Mono\',monospace;z-index:4;pointer-events:none;';
    camo.innerHTML = '<div id="camo-label" style="font-size:10px;font-weight:700;letter-spacing:2px;color:#fff;text-shadow:0 1px 4px rgba(0,0,0,.6)">CAMO</div>' +
      '<div style="width:170px;height:8px;background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.5);border-radius:999px;overflow:hidden"><div id="camo-fill" style="height:100%;width:0%;background:#2ec4a6;transition:width .12s,background .2s"></div></div>';
    parent.appendChild(camo);

    // mute toggle (audio is a Step-1 feature, give players control)
    var muteBtn = document.createElement('button');
    muteBtn.style.cssText = 'position:absolute;top:12px;right:12px;width:34px;height:34px;border-radius:9px;border:1px solid rgba(255,255,255,.25);background:rgba(0,0,0,.4);color:#fff;font-size:15px;cursor:pointer;z-index:6;';
    muteBtn.textContent = '🔊';
    muteBtn.addEventListener('click', function () { audio.unlock(); audio.setMuted(!audio.muted); muteBtn.textContent = audio.muted ? '🔇' : '🔊'; });
    parent.appendChild(muteBtn);

    var flashEl = document.createElement('div');
    flashEl.style.cssText = 'position:absolute;top:46px;left:50%;transform:translateX(-50%);font-family:\'Martian Mono\';font-size:11px;font-weight:700;color:#fff;text-shadow:0 1px 4px rgba(0,0,0,.6);opacity:0;transition:opacity .2s;z-index:4;pointer-events:none;';
    parent.appendChild(flashEl);
    var flashT;
    function flash(t) { flashEl.textContent = t; flashEl.style.opacity = '1'; clearTimeout(flashT); flashT = setTimeout(function () { flashEl.style.opacity = '0'; }, 700); }

    // paint-splash ping when you absorb/repaint
    var splashEl = document.createElement('div');
    splashEl.style.cssText = 'position:absolute;left:50%;top:60%;width:24px;height:24px;border-radius:50%;transform:translate(-50%,-50%) scale(0);opacity:0;pointer-events:none;z-index:5;';
    parent.appendChild(splashEl);
    var splashT;
    function flashSplash(c) {
      splashEl.style.background = '#' + c.getHexString();
      splashEl.style.transition = 'none'; splashEl.style.transform = 'translate(-50%,-50%) scale(0.4)'; splashEl.style.opacity = '0.85';
      void splashEl.offsetWidth;
      splashEl.style.transition = 'transform .5s ease-out,opacity .5s ease-out';
      splashEl.style.transform = 'translate(-50%,-50%) scale(4)'; splashEl.style.opacity = '0';
      clearTimeout(splashT); splashT = setTimeout(function () {}, 500);
    }

    function updateCamoHud(blend, chased) {
      var fill = document.getElementById('camo-fill'), lbl = document.getElementById('camo-label');
      if (!fill) return;
      fill.style.width = Math.round(blend * 100) + '%';
      var hidden = blend > 0.6 && !chased;
      fill.style.background = chased ? '#e8483b' : (blend > 0.6 ? '#2ec4a6' : (blend > 0.3 ? '#ffc23c' : '#e8483b'));
      lbl.textContent = chased ? 'SPOTTED — RUN!' : (hidden ? 'HIDDEN' : 'EXPOSED');
      lbl.style.color = chased ? '#ffb0a8' : (hidden ? '#bff5e8' : '#fff');
    }

    // colour palette (eyedropper essence): click a swatch to paint yourself
    var palette = document.createElement('div');
    palette.style.cssText = 'position:absolute;bottom:14px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:7px;background:rgba(0,0,0,.4);border:1px solid rgba(255,255,255,.18);border-radius:12px;padding:8px 10px;z-index:5;';
    var swatchEls = [];
    var paletteColors = [0xffffff].concat(crateColors, [GRASS]);
    paletteColors.forEach(function (col) {
      var sw = document.createElement('button');
      sw.style.cssText = 'width:22px;height:22px;border-radius:6px;border:2px solid rgba(255,255,255,.3);cursor:pointer;padding:0;background:#' + ('000000' + col.toString(16)).slice(-6);
      sw.addEventListener('click', function () { audio.unlock(); setPlayerColor(new THREE.Color(col)); });
      palette.appendChild(sw); swatchEls.push({ el: sw, col: col });
    });
    var eyeHint = document.createElement('span');
    eyeHint.style.cssText = 'font-family:\'Martian Mono\';font-size:10px;color:rgba(255,255,255,.7);margin-left:4px;';
    eyeHint.textContent = 'press E to eyedrop';
    palette.appendChild(eyeHint);
    parent.appendChild(palette);
    function refreshPalette() {
      swatchEls.forEach(function (s) {
        var match = colorDist(playerColor, new THREE.Color(s.col)) < 0.02;
        s.el.style.borderColor = match ? '#fff' : 'rgba(255,255,255,.3)';
        s.el.style.transform = match ? 'scale(1.18)' : 'scale(1)';
      });
    }

    var keymap = { ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down',
      ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right' };
    function onKey(down) {
      return function (e) {
        var ae = document.activeElement; if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) return;
        if (down) audio.unlock();
        if (over && down && (e.key === ' ' || keymap[e.key])) { e.preventDefault(); reset(); return; }
        if (down && (e.key === 'e' || e.key === 'E')) { e.preventDefault(); eyedrop(); return; }
        if (e.key === 'Shift') { crouch = down; return; }
        var k = keymap[e.key]; if (!k) return; e.preventDefault(); keys[k] = down;
      };
    }
    var keyDown = onKey(true), keyUp = onKey(false);
    window.addEventListener('keydown', keyDown, true);
    window.addEventListener('keyup', keyUp, true);

    // ---- post-processing: contact-shadow AO + subtle bloom + cinematic grade ----
    var composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    var gtao = new GTAOPass(scene, camera, 1, 1, undefined,
      { radius: 0.5, distanceExponent: 1.0, thickness: 1.0, scale: 1.0, samples: 16, distanceFallOff: 1.0, screenSpaceRadius: false });
    gtao.blendIntensity = 0.9; composer.addPass(gtao);
    var bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.35, 0.6, 0.85); composer.addPass(bloom);
    composer.addPass(new ShaderPass(GradeShader));
    composer.addPass(new OutputPass());
    composer.addPass(new SMAAPass(1, 1));

    function resize() {
      var r = canvas.getBoundingClientRect(); if (r.width < 4 || r.height < 4) return;
      var pr = Math.min(window.devicePixelRatio || 1, 2);
      renderer.setPixelRatio(pr);
      renderer.setSize(r.width, r.height, false);
      composer.setPixelRatio(pr);
      composer.setSize(r.width, r.height);
      camera.aspect = r.width / r.height; camera.updateProjectionMatrix();
    }
    window.addEventListener('resize', resize);

    var camPos = new THREE.Vector3();
    function render() {
      camPos.set(player.position.x, 11, player.position.z + 13);
      camera.position.lerp(camPos, 0.12);
      camera.lookAt(player.position.x, 1.5, player.position.z - 2);
      sun.target.position.copy(player.position);
      composer.render();
    }
    function frame(now) {
      if (last == null) last = now; var dt = Math.min(0.05, (now - last) / 1000); last = now;
      update(dt); render(); raf = requestAnimationFrame(frame);
    }

    resize(); reset(); refreshPalette(); raf = requestAnimationFrame(frame);

    return {
      reset: reset,
      isPaused: function () { return paused; },
      pause: function () { paused = true; if (!over) showOverlay('PAUSED', '', '#ffffff'); },
      resume: function () { paused = false; if (!over) hideOverlay(); last = null; },
      togglePause: function () { if (paused) this.resume(); else this.pause(); return paused; },
      resize: resize,
      dispose: function () {
        cancelAnimationFrame(raf);
        window.removeEventListener('keydown', keyDown, true);
        window.removeEventListener('keyup', keyUp, true);
        window.removeEventListener('resize', resize);
        [overlay, camo, flashEl, splashEl, palette, muteBtn].forEach(function (el) { if (el.parentElement) el.parentElement.removeChild(el); });
        audio.dispose(); pmrem.dispose(); composer.dispose(); renderer.dispose();
      }
    };
  }

  (root.EZGames || (root.EZGames = {})).hideout = { mount: mount };
})(window);
