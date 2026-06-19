/* ===== Meccha Chameleon — Game controller =====
 * The state machine (MENU → HIDE → HUNT → RESULTS, + PAUSE) and per-frame loop.
 * Owns the player: orbit camera, movement, camo evaluation, the precise
 * eyedropper, poses, onboarding, scoring and all the juice. Everything else
 * (engine, AI, maps, UI, fx, audio) is a module it drives.
 */
import * as THREE from 'three';
import { Engine } from './engine.js';
import { Input } from './input.js';
import { Audio } from './audio.js';
import { UI } from './ui.js';
import { FX } from './fx.js';
import { World, EntityManager } from './entities.js';
import { buildMap } from './maps.js';

const HIDE_TIME = 12;
const HUNT_TIME = 90;

export class Game {
  constructor(canvas, opts) {
    this.canvas = canvas; this.opts = opts || {};
    this.quality = 'high';
    this.engine = new Engine(canvas, this.quality);
    this.scene = this.engine.scene; this.camera = this.engine.camera;
    this.input = new Input(canvas);
    this.audio = new Audio();
    this.best = parseFloat(localStorage.getItem('mc_best') || '0') || 0;

    this.state = 'menu';
    this.yaw = 0; this.pitch = 0.42; this.camDist = 8.0; this.fov = 56; this.camera.fov = 56;
    this.camShoulder = 0.55;
    // movement physics state
    this._vx = 0; this._vz = 0; this._vy = 0; this._onGround = true; this._slide = 0; this._slideDir = { x: 0, z: 0 };
    this._stamina = 1; this._clock = 0; this._camPos = new THREE.Vector3(); this._camLook = new THREE.Vector3();
    this._tmp = new THREE.Vector3(); this._tmp2 = new THREE.Vector3();
    this._ref = new THREE.Color(); this._playerTarget = new THREE.Color(0x86c06a);
    this._ray = new THREE.Raycaster();
    this._tutTimers = []; this._roundTimers = [];
    this.coins = 0; this.survived = 0;
    this._minT = 0; this._stepT = 0;

    this.ui = new UI(canvas.parentElement, {
      click: () => { this.audio.resume(); this.audio.uiClick(); },
      hover: () => this.audio.uiHover(),
      start: (mode, map, tut) => this.startRound(mode, map, tut),
      pose: (p) => this.setPose(p),
      eyedrop: () => this.eyedrop(),
      setColor: (rgb) => { this._playerTarget.setRGB(rgb.r, rgb.g, rgb.b); if (this.player) this.player.cham.setColorTarget(this._playerTarget); },
      setting: (k, v) => this.applySetting(k, v),
      resume: () => this.resume(),
      again: () => this.startRound(this.mode, this.mapId, false),
      menu: () => this.toMenu()
    });
    this.ui.setBest(this.best);

    this.input.onAction((a) => this.onAction(a));

    // hide the EZ preview hint chrome while our own UI is up
    this._hostHint = canvas.parentElement.querySelector('.hint');
    if (this._hostHint) this._hostHint.style.display = 'none';

    this._onResize = () => this.engine.resize();
    window.addEventListener('resize', this._onResize);

    this.last = null; this.paused = false;
    this._loop = (t) => this.frame(t);
    this.raf = requestAnimationFrame(this._loop);
  }

  /* ---------------- round lifecycle ---------------- */
  startRound(mode, mapId, tutorial) {
    this.audio.resume();
    this._clearTimers();
    // show the loading screen instantly, then build on the next frames so it paints
    this.state = 'loading';
    this.ui.showLoading('ENTERING ' + (mapId === 'garden' ? 'THE GARDEN…' : mapId === 'toyroom' ? "ANDY'S ROOM…" : 'THE MANSION…'));
    clearTimeout(this._buildT);
    this._buildT = setTimeout(() => this._doStartRound(mode, mapId, tutorial), 50);
  }

  _doStartRound(mode, mapId, tutorial) {
    this._teardownRound();
    this.mode = mode || 'classic'; this.mapId = mapId || 'mansion'; this.tutorial = !!tutorial;

    const map = buildMap(this.mapId);
    this.map = map; this.scene.add(map.group);
    map.apply(this.scene, this.engine.renderer, this.engine);

    this.world = new World(this.scene, map);
    this.manager = new EntityManager(this.world, this.audio);
    const hiders = 4 + Math.floor(Math.random() * 2);
    const scaleOpts = map.castScale || { hiderScale: 0.62, hunterScale: 1.7 };
    this.manager.spawn(this.mode, map, this._playerTarget.clone(), hiders, scaleOpts);
    this.player = this.manager.player;
    this.player.cham.setColorTarget(this._playerTarget, true);
    this.ui.syncColor({ r: this._playerTarget.r, g: this._playerTarget.g, b: this._playerTarget.b });

    this.fx = new FX(this.scene, this.camera);

    // reset movement physics
    this._vx = this._vz = this._vy = 0; this._onGround = true; this._slide = 0; this._stamina = 1; this._clock = 0; this._noiseBoost = 0;

    // camera framing scales with how small the player is (little toy = closer, lower)
    this.playerScale = this.player.scale || 1;
    this._focusH = 0.95 * this.playerScale + 0.35;
    this.camDist = 3.4 + 5.6 * this.playerScale;
    this.camShoulder = 0.55 * this.playerScale;
    this.yaw = 0; this.pitch = 0.40; this.fov = 58; this.camera.fov = 58; this.camera.updateProjectionMatrix();
    this._focusPoint(this._camLook);
    this._snapCamera();

    this.coins = 0; this.survived = 0; this.over = false; this.won = false;
    this.phase = 'hide'; this.phaseTime = HIDE_TIME;
    this.ui.setCoins(0); this.ui.setActivePose('stand');
    this.ui.setPhase('HIDE — get camouflaged', '#7ee08a');
    this.ui.showScreen('hud'); this.ui.clearHints();
    this.ui.armEyedrop(true); // crosshair always visible so you can aim the brush
    this.input.setEnabled(true);

    this.audio.startAmbient(map.mood === 'cozy' ? 'cozy' : 'spooky');
    this.audio.stinger('hide');
    this.state = 'hide';
    this.opts.onScore && this.opts.onScore(0);

    if (this.tutorial) this._runTutorial();
    else this.ui.showHint('HIDE PHASE — blend into a surface before the hunter wakes!', 4000);
  }

  _runTutorial() {
    const seq = [
      [200, 'Move with W A S D · hold SHIFT to sprint · SPACE to hop'],
      [3800, 'Aim at any object with the crosshair, press E to PAINT yourself its colour'],
      [7600, 'The brush sweeps the colour over your body — match a nearby toy'],
      [11400, 'STAY STILL on matching cover so your CAMO meter fills and you vanish'],
      [15200, 'Moving makes noise — the giant hunter can HEAR you!']
    ];
    seq.forEach((s) => this._tutTimers.push(setTimeout(() => this.ui.showHint(s[1], 3800), s[0])));
  }

  _beginHunt() {
    this.phase = 'hunt'; this.phaseTime = HUNT_TIME;
    if (this.mode === 'double') this.manager.flipToHunt(); else this.manager.wakeHunters();
    this.ui.setPhase('HUNT — survive!', '#e8483b');
    this.ui.showHint('The hunt is on. Hold still and stay matched!', 3500);
    this.audio.stinger('start');
    this.state = 'hunt';
  }

  _endRound(win, title, subtitle) {
    if (this.over) return; this.over = true; this.won = win;
    this.input.setEnabled(false);
    this.audio.stopAmbient();
    this.audio.stinger(win ? 'win' : 'lose');
    if (this.survived > this.best) { this.best = this.survived; localStorage.setItem('mc_best', String(this.best)); }
    this.ui.setBest(this.best); this.opts.onBest && this.opts.onBest(Math.floor(this.best));
    this.state = 'results';
    setTimeout(() => this.ui.showResults({
      win, title, subtitle, survived: this.survived, coins: this.coins, best: this.best
    }), win ? 400 : 900);
  }

  _teardownRound() {
    if (this.manager) this.manager.clear();
    if (this.fx) { this.fx.dispose(); this.fx = null; }
    if (this.map) { this.scene.remove(this.map.group); this.map.dispose(); this.map = null; }
    this.scene.environment = null;
    this.player = null; this.world = null; this.manager = null;
  }

  toMenu() {
    this._clearTimers(); this.audio.stopAmbient();
    this._teardownRound();
    this.state = 'menu'; this.paused = false;
    this.input.setEnabled(false);
    this.ui.showScreen('menu');
    this.opts.onScore && this.opts.onScore(0);
  }

  /* ---------------- actions ---------------- */
  onAction(a) {
    if (a === 'pause') { this.togglePause(); return; }
    if (a === 'mute') { this._muted = !this._muted; this.audio.setMuted(this._muted); return; }
    if (this.state !== 'hide' && this.state !== 'hunt') return;
    if (a === 'eyedrop') this.eyedrop();
    else if (a === 'jump') this.jump();
    else if (a === 'pose_stand') this.setPose('stand');
    else if (a === 'pose_crouch') this._crouchOrSlide();
    else if (a === 'pose_curl') this.setPose('curl');
    else if (a === 'pose_lie') this.setPose('lie');
  }

  jump() {
    if (!this.player || !this._onGround) return;
    this._onGround = false; this._vy = 7.2; this._noiseBoost = 0.9;
    this.player.cham.hop(); this.audio.jump();
    this.fx.noiseRing(this.player.pos, 0.7);
  }
  _crouchOrSlide() {
    if (!this.player) return;
    const speedNow = Math.hypot(this._vx, this._vz);
    // sprinting + moving fast -> slide; otherwise crouch
    if (this._onGround && speedNow > 6 && this._slide <= 0 && this.player.cham.pose === 'stand') {
      this._slide = 0.55; const n = speedNow || 1; this._slideDir = { x: this._vx / n, z: this._vz / n }; this._noiseBoost = 1;
      this.setPose('crouch'); this.audio.slide(); this.fx.dust(this.player.pos); this.fx.noiseRing(this.player.pos, 0.9);
    } else this.setPose(this.player.cham.pose === 'crouch' ? 'stand' : 'crouch');
  }

  setPose(p) {
    if (!this.player) return;
    this.player.cham.setPose(p); this.ui.setActivePose(p);
    this.audio.pose();
  }

  // Pick a colour from the world, then actively PAINT yourself with it.
  // You aim at an object with the crosshair (or stand on a surface) and press;
  // the chameleon lifts a brush and the colour sweeps up its body.
  eyedrop() {
    if (!this.player || !this.world) return;
    // 1) the exact surface under the crosshair (the object you're pointing at)
    this._ray.setFromCamera({ x: 0, y: 0 }, this.camera);
    let res = this.world.pickColorRay(this._ray, this._ref);
    // 2) fall back to the surface you're standing on ("come out on it")
    if (!res.hit) { this.world.surfaceColorAt(this.player.pos, this._ref); res = { color: this._ref, point: this.player.pos, hit: true }; }
    this._playerTarget.copy(res.color);
    this.player.cham.paintSelf(this._playerTarget, 0.7);  // brush + bottom-up sweep
    this.ui.syncColor({ r: res.color.r, g: res.color.g, b: res.color.b });
    // splatter at the source AND over the chameleon as it paints
    this.fx.paintSplash(res.point ? res.point : this.player.pos, res.color);
    this.fx.paintSplash(this.player.pos, res.color);
    this.audio.absorb();
    this.coins += 2; this.ui.setCoins(this.coins);
    this.ui.showHint('Painting yourself ' + this._hex(res.color) + ' — hold still to vanish!', 1900);
  }
  _hex(c) { const f = (x) => ('0' + Math.round(x * 255).toString(16)).slice(-2); return '#' + f(c.r) + f(c.g) + f(c.b); }

  /* ---------------- settings ---------------- */
  applySetting(k, v) {
    if (k === 'quality') { this.quality = v; this.engine.setQuality(v); }
    else if (k === 'mute') { this._muted = v; this.audio.setMuted(v); }
    else if (k === 'sfx') this.audio.setSfx(v);
  }

  /* ---------------- camera ---------------- */
  // focus point: chest height, nudged ahead in travel, with a slight shoulder offset
  _focusPoint(out) {
    const p = this.player.pos; const h = this._focusH || 1.35;
    const sx = Math.cos(this.yaw) * this.camShoulder, sz = -Math.sin(this.yaw) * this.camShoulder;
    out.set(p.x + this._vx * 0.1 + sx, p.y + h, p.z + this._vz * 0.1 + sz);
    return out;
  }
  // desired (unclamped) camera position behind/above the player, over the shoulder
  _camDesired(out) {
    const p = this.player.pos; const h = this._focusH || 1.35;
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw), ch = Math.cos(this.pitch);
    const sx = Math.cos(this.yaw) * this.camShoulder, sz = -Math.sin(this.yaw) * this.camShoulder;
    out.set(p.x - fx * this.camDist * ch + sx, p.y + h + Math.sin(this.pitch) * this.camDist, p.z - fz * this.camDist * ch + sz);
    return out;
  }
  // collision-resolved camera position (never clips through walls)
  _camResolved(out) {
    const focus = this._focusPoint(this._tmp2);
    const desired = this._camDesired(out);
    const frac = this.world ? this.world.cameraHitFrac(focus, desired, 2.2) : 1;
    if (frac < 1) { out.lerpVectors(focus, desired, Math.max(0.25, frac * 0.92)); }
    if (out.y < 0.4) out.y = 0.4; // never dip below the floor
    return out;
  }
  _snapCamera() {
    if (!this.player) return;
    this._camResolved(this.camera.position);
    this._focusPoint(this._camLook); this.camera.lookAt(this._camLook);
  }

  /* ---------------- per-frame ---------------- */
  frame(now) {
    if (this.last == null) this.last = now;
    let dt = (now - this.last) / 1000; this.last = now;
    dt = Math.min(0.05, dt);

    let tick = 0;
    if ((this.state === 'hide' || this.state === 'hunt') && !this.paused) {
      this.update(dt);
      tick = (this.phase === 'hunt' && this.phaseTime < 10) ? (1 - this.phaseTime / 10) : 0;
    }
    this.renderScene(dt, tick);
    this.raf = requestAnimationFrame(this._loop);
  }

  update(dt) {
    const inp = this.input.sample();
    // look
    this.yaw -= inp.look.x; this.pitch = Math.max(0.06, Math.min(1.05, this.pitch + inp.look.y));

    // movement basis from camera yaw
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
    let wx = fx * (-inp.move.z) + rx * inp.move.x;
    let wz = fz * (-inp.move.z) + rz * inp.move.x;
    const inMag = Math.min(1, Math.hypot(wx, wz));
    const pose = this.player.cham.pose;
    const p = this.player.pos;

    // sprint + stamina (long-lasting, generous regen so it stays fun)
    const wantSprint = this.input.run && inMag > 0.1 && this._stamina > 0.05 && pose === 'stand' && this._slide <= 0;
    this._stamina = Math.max(0, Math.min(1, this._stamina + (wantSprint ? -dt * 0.16 : dt * 0.3)));
    let maxSpeed = wantSprint ? 11.0 : 6.8;
    if (pose === 'crouch') maxSpeed = 3.4; else if (pose === 'curl' || pose === 'lie') maxSpeed = 0;
    if (inMag > 0.05 && (pose === 'curl' || pose === 'lie')) { this.setPose('stand'); }

    // desired horizontal velocity, reached with snappy accel and quick stop
    let desX = 0, desZ = 0;
    if (inMag > 0.02 && maxSpeed > 0) { const n = Math.hypot(wx, wz) || 1; desX = wx / n * maxSpeed * inMag; desZ = wz / n * maxSpeed * inMag; }
    if (this._slide > 0) {
      // slide: committed momentum, minimal steering, low profile
      this._slide -= dt;
      desX = this._slideDir.x * (this._slide * 20 + 2); desZ = this._slideDir.z * (this._slide * 20 + 2);
      const accelS = Math.min(1, dt * 3);
      this._vx += (desX - this._vx) * accelS; this._vz += (desZ - this._vz) * accelS;
      if (this._slide <= 0 && pose === 'crouch') this.setPose('stand');
    } else {
      // accelerate fast, decelerate even faster (responsive, no float/ice feel)
      const accel = (inMag > 0.02 ? (this._onGround ? 19 : 6) : (this._onGround ? 22 : 4));
      const k = Math.min(1, dt * accel);
      this._vx += (desX - this._vx) * k; this._vz += (desZ - this._vz) * k;
    }
    const speedNow = Math.hypot(this._vx, this._vz);
    const moving = speedNow > 0.4;

    // integrate horizontal
    p.x += this._vx * dt; p.z += this._vz * dt;
    const pr = this.player.radius || 0.4;
    this.world.clampBounds(p, pr); this.world.collide(p, pr);
    if (moving) {
      const target = Math.atan2(this._vx, this._vz);
      let d = target - this.player.heading; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
      this.player.heading += d * Math.min(1, dt * 16); // responsive but not snappy
    }

    // vertical (jump) integration
    if (!this._onGround) {
      this._vy -= 22 * dt; p.y += this._vy * dt;
      if (p.y <= 0) { p.y = 0; this._onGround = true; this._vy = 0; this.player.cham.land(); this.audio.land(); this.fx.dust(p); this.fx.noiseRing(p, 0.8); }
    } else p.y = (pose === 'curl' || pose === 'lie') ? p.y : 0;
    this.player.syncMesh();

    // footsteps + dust + noise ring (scaled by real speed)
    if (moving && this._onGround) {
      this._stepT -= dt * (0.6 + speedNow / 9);
      if (this._stepT <= 0) {
        this._stepT = 0.42; this.world.surfaceColorAt(p, this._ref);
        const luma = this._ref.r * 0.3 + this._ref.g * 0.6 + this._ref.b * 0.1;
        this.audio.footstep(luma); this.fx.dust(p);
      }
    }

    // camo evaluation
    this.world.surfaceColorAt(this.player.pos, this._ref);
    const cd = this._colorDist(this.player.cham.getColor(), this._ref);
    let match = Math.max(0, 1 - cd / 0.5);
    let blend = match;
    const motion = Math.min(1, speedNow / 9);
    if (moving) { blend *= (1 - motion * 0.75); this.fx.noiseRing(this.player.pos, 0.4 + motion * (this.input.run ? 1.0 : 0.7)); }
    if (!this._onGround) blend *= 0.4;                 // jumping is very revealing
    const sil = this.player.cham.silhouette();
    if (sil !== 'tall') blend = Math.min(1, blend + 0.14);
    blend = Math.max(0, Math.min(1, blend));
    this.player.exposure = Math.max(0.04, 1 - blend * 0.92);
    // noise the hunter can HEAR: movement + a decaying spike from jumps/slides
    this._noiseBoost = Math.max(0, (this._noiseBoost || 0) - dt * 1.6);
    this.player._noise = Math.max(moving ? motion * (this.input.run ? 1 : 0.7) : 0, this._noiseBoost);
    this.player._moving = moving;

    // animate player chameleon (eyes glance toward nearest hunter)
    const hunter = this._nearestHunter();
    let lookAt = null;
    if (hunter) { const a = Math.atan2(hunter.pos.x - this.player.pos.x, hunter.pos.z - this.player.pos.z) - this.player.heading; lookAt = Math.max(-0.6, Math.min(0.6, Math.sin(a))); }
    this.player.cham.update(dt, { moving, lookAt, speed: speedNow });

    // AI + hunters
    this.manager.update(dt, this.survived);
    this._handleEvents();

    // animated map detail (fireplace flicker, chandelier sway, dust, fountain)
    this._clock += dt;
    if (this.map && this.map.update) this.map.update(dt, this._clock);

    // camo HUD state
    let state = 'HIDDEN';
    const chased = hunter && this.phase === 'hunt' && this.manager.sees(hunter, this.player);
    if (chased) state = 'SPOTTED';
    else if (blend < 0.4 || (hunter && this._hunterLooking(hunter) > 0.5)) state = 'SUSPICIOUS';
    this.ui.setCamo(state, blend);

    // hunter direction arrow + heartbeat
    if (hunter && this.phase === 'hunt') {
      const dist = hunter.pos.distanceTo(this.player.pos);
      const look = this._hunterLooking(hunter);
      const ang = Math.atan2(hunter.pos.x - this.player.pos.x, hunter.pos.z - this.player.pos.z);
      this.ui.setHunterArrow(-ang - this.yaw, look * Math.max(0.2, 1 - dist / 26));
      this.audio.setHeartbeat(Math.max(0, 1 - dist / 12) * (chased ? 1 : 0.6));
    } else { this.ui.setHunterArrow(0, 0); this.audio.setHeartbeat(0); }

    // timers
    this.phaseTime -= dt;
    if (this.phase === 'hide') {
      this.ui.setTimer(this.phaseTime);
      if (this.phaseTime <= 0) this._beginHunt();
    } else {
      this.survived += dt; this.coins += dt * 1.5;
      this.ui.setTimer(this.phaseTime);
      this.opts.onScore && this.opts.onScore(Math.floor(this.survived));
      this.ui.setCoins(Math.floor(this.coins));
      if (this.phaseTime <= 0) this._endRound(true, 'YOU SURVIVED!', 'You out-blended the hunter.');
    }

    // minimap (throttled)
    this._minT -= dt;
    if (this._minT <= 0) { this._minT = 0.1; this._drawMini(); }

    this.fx.update(dt);
  }

  _handleEvents() {
    const ev = this.manager.events;
    for (let i = 0; i < ev.length; i++) {
      const e = ev[i];
      if (e.type === 'catch') {
        this.fx.poof(e.target.pos);
        this.audio.stinger('caught');
        if (e.isPlayer) { this._endRound(false, 'CAUGHT!', 'The hunter found you. Try blending sooner.'); }
        else { this.coins += 5; this.ui.showHint('A hider was caught!', 1500); }
      } else if (e.type === 'infect') {
        this.ui.showHint(e.target.name + ' joined the hunters!', 1800);
      }
    }
  }

  _nearestHunter() {
    if (!this.manager) return null;
    const hs = this.manager.hunters(); let best = null, bd = Infinity;
    for (const h of hs) { if (h.dormant) continue; const d = h.pos.distanceTo(this.player.pos); if (d < bd) { bd = d; best = h; } }
    return best;
  }
  _hunterLooking(h) {
    const d = this._tmp.copy(this.player.pos).sub(h.pos); const ang = Math.atan2(d.x, d.z);
    let diff = Math.abs(ang - h.heading); diff = Math.min(diff, Math.PI * 2 - diff);
    return Math.max(0, 1 - diff / 1.4);
  }
  _colorDist(a, c) { const dr = a.r - c.r, dg = a.g - c.g, db = a.b - c.b; return Math.sqrt(dr * dr + dg * dg + db * db); }

  _drawMini() {
    if (!this.manager) return;
    const hiders = this.manager.hiders().filter((a) => !a.isPlayer && a.group.visible).map((a) => a.pos);
    const hunters = this.manager.hunters().filter((h) => !h.dormant).map((h) => h.pos);
    this.ui.drawMinimap({ bounds: this.world.bounds, player: this.player.pos, hiders, hunters });
    // virtual stick visual
    if (this.input.vstick.active && this.ui.stickEl) {
      this.ui.stickEl.style.left = (this.input.vstick.ox - this.canvas.getBoundingClientRect().left - 60) + 'px';
      this.ui.stickEl.style.top = (this.input.vstick.oy - this.canvas.getBoundingClientRect().top - 60) + 'px';
      this.ui.stickNub.style.transform = `translate(${this.input.vstick.dx}px,${this.input.vstick.dy}px)`;
    } else if (this.ui.stickNub) { this.ui.stickNub.style.transform = 'translate(0,0)'; }
  }

  renderScene(dt, tick) {
    if (this.player) {
      // smooth, collision-resolved follow with a touch of frame-rate independence
      this._camResolved(this._camPos);
      const s = 1 - Math.pow(0.001, dt); // ~time-constant smoothing
      this.camera.position.lerp(this._camPos, this.paused ? s * 0.4 : Math.min(1, s * 1.4));
      this._focusPoint(this._tmp);
      this._camLook.lerp(this._tmp, Math.min(1, s * 1.6));
      this.camera.lookAt(this._camLook);
      // dynamic FOV: widen on sprint / slide for a sense of speed
      const speedNow = Math.hypot(this._vx, this._vz);
      const fovTarget = 58 + (this.input.run && speedNow > 6 ? 8 : 0) + (this._slide > 0 ? 6 : 0);
      this.fov += (fovTarget - this.fov) * Math.min(1, dt * 6);
      if (Math.abs(this.camera.fov - this.fov) > 0.01) { this.camera.fov = this.fov; this.camera.updateProjectionMatrix(); }
      if (this.map && this.map.sun) this.map.sun.target.position.copy(this.player.pos);
      if (this.fx) this.fx.applyShake(this.camera);
    }
    this.engine.render(dt, tick);
  }

  /* ---------------- pause / control surface ---------------- */
  togglePause() {
    if (this.state !== 'hide' && this.state !== 'hunt' && !this.paused) return this.paused;
    if (this.paused) this.resume(); else this.pause();
    return this.paused;
  }
  pause() {
    if (this.state !== 'hide' && this.state !== 'hunt') return;
    this.paused = true; this.input.setEnabled(false);
    this.ui.showScreen('pause');
  }
  resume() {
    if (!this.paused) return;
    this.paused = false; this.input.setEnabled(true);
    this.ui.showScreen('hud'); this.last = null;
  }
  reset() { if (this.mode) this.startRound(this.mode, this.mapId, false); else this.toMenu(); }
  isPaused() { return this.paused; }

  resize() { this.engine.resize(); }

  _clearTimers() { clearTimeout(this._buildT); this._tutTimers.forEach(clearTimeout); this._tutTimers = []; this._roundTimers.forEach(clearTimeout); this._roundTimers = []; }

  dispose() {
    cancelAnimationFrame(this.raf);
    this._clearTimers();
    window.removeEventListener('resize', this._onResize);
    this._teardownRound();
    this.input.dispose(); this.audio.dispose(); this.ui.dispose(); this.engine.dispose();
    if (this._hostHint) this._hostHint.style.display = '';
  }
}
