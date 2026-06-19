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
    this.yaw = 0; this.pitch = 0.62; this.camDist = 9.5;
    this._tmp = new THREE.Vector3(); this._tmp2 = new THREE.Vector3();
    this._ref = new THREE.Color(); this._playerTarget = new THREE.Color(0x86c06a);
    this._ray = new THREE.Raycaster();
    this._tutTimers = []; this._roundTimers = [];
    this.coins = 0; this.survived = 0;
    this._minT = 0; this._stepT = 0;

    this.ui = new UI(canvas.parentElement, {
      click: () => { this.audio.resume(); this.audio.uiClick(); },
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
    this._teardownRound();
    this.mode = mode || 'classic'; this.mapId = mapId || 'mansion'; this.tutorial = !!tutorial;

    const map = buildMap(this.mapId);
    this.map = map; this.scene.add(map.group);
    map.apply(this.scene, this.engine.renderer, this.engine);

    this.world = new World(this.scene, map);
    this.manager = new EntityManager(this.world, this.audio);
    const hiders = 4 + Math.floor(Math.random() * 2);
    this.manager.spawn(this.mode, map, this._playerTarget.clone(), hiders);
    this.player = this.manager.player;
    this.player.cham.setColorTarget(this._playerTarget, true);
    this.ui.syncColor({ r: this._playerTarget.r, g: this._playerTarget.g, b: this._playerTarget.b });

    this.fx = new FX(this.scene, this.camera);

    // camera behind player
    this.yaw = 0; this.pitch = 0.62;
    this._snapCamera();

    this.coins = 0; this.survived = 0; this.over = false; this.won = false;
    this.phase = 'hide'; this.phaseTime = HIDE_TIME;
    this.ui.setCoins(0); this.ui.setActivePose('stand');
    this.ui.setPhase('HIDE — get camouflaged', '#7ee08a');
    this.ui.showScreen('hud'); this.ui.clearHints();
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
      [200, 'Move with WASD / arrow keys (or the on-screen stick)'],
      [4000, 'Drag the view to look around · poses are bottom-centre'],
      [8000, 'Press E to EYEDROP the colour right under your crosshair'],
      [12000, 'Now match a nearby surface so your CAMO meter fills'],
      [16000, 'STAY STILL to vanish — moving sends out a noise ring!']
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
    else if (a === 'pose_stand') this.setPose('stand');
    else if (a === 'pose_crouch') this.setPose('crouch');
    else if (a === 'pose_curl') this.setPose('curl');
    else if (a === 'pose_lie') this.setPose('lie');
  }

  setPose(p) {
    if (!this.player) return;
    this.player.cham.setPose(p); this.ui.setActivePose(p);
    this.audio.pose();
  }

  eyedrop() {
    if (!this.player || !this.world) return;
    // raycast from camera through the crosshair (screen centre) to the exact surface
    this._ray.setFromCamera({ x: 0, y: 0 }, this.camera);
    const res = this.world.pickColorRay(this._ray, this._ref);
    this._playerTarget.copy(res.color);
    this.player.cham.setColorTarget(this._playerTarget);
    this.player.cham.pulseAbsorb();
    this.ui.syncColor({ r: res.color.r, g: res.color.g, b: res.color.b });
    this.fx.paintSplash(res.point ? res.point : this.player.pos, res.color);
    this.audio.absorb();
    this.coins += 2; this.ui.setCoins(this.coins);
    this.ui.showHint('Absorbed ' + this._hex(res.color) + ' — now hold still!', 1800);
  }
  _hex(c) { const f = (x) => ('0' + Math.round(x * 255).toString(16)).slice(-2); return '#' + f(c.r) + f(c.g) + f(c.b); }

  /* ---------------- settings ---------------- */
  applySetting(k, v) {
    if (k === 'quality') { this.quality = v; this.engine.setQuality(v); }
    else if (k === 'mute') { this._muted = v; this.audio.setMuted(v); }
    else if (k === 'sfx') this.audio.setSfx(v);
  }

  /* ---------------- camera ---------------- */
  _camTarget(out) {
    const p = this.player.pos;
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    const ch = Math.cos(this.pitch);
    out.set(p.x - fx * this.camDist * ch, p.y + 1.2 + Math.sin(this.pitch) * this.camDist, p.z - fz * this.camDist * ch);
    return out;
  }
  _snapCamera() { if (!this.player) return; this._camTarget(this._tmp); this.camera.position.copy(this._tmp); this.camera.lookAt(this.player.pos.x, this.player.pos.y + 1.4, this.player.pos.z); }

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
    this.yaw -= inp.look.x; this.pitch = Math.max(0.12, Math.min(1.15, this.pitch + inp.look.y));

    // movement basis from camera yaw
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
    let wx = fx * (-inp.move.z) + rx * inp.move.x;
    let wz = fz * (-inp.move.z) + rz * inp.move.x;
    const mag = Math.hypot(wx, wz);
    const pose = this.player.cham.pose;
    let speed = this.input.run ? 8.5 : 6.2;
    if (pose === 'crouch') speed *= 0.5; else if (pose === 'curl' || pose === 'lie') speed *= 0.0;
    const moving = mag > 0.02 && speed > 0;
    if (mag > 0.02 && (pose === 'curl' || pose === 'lie')) { this.setPose('stand'); }
    if (moving) {
      const p = this.player.pos;
      p.x += (wx / mag) * speed * mag * dt; p.z += (wz / mag) * speed * mag * dt;
      this.world.clampBounds(p, 0.6); this.world.collide(p, 0.6);
      this.player.heading = Math.atan2(wx, wz);
      // footsteps + dust + noise ring
      this._stepT -= dt;
      if (this._stepT <= 0) { this._stepT = this.input.run ? 0.28 : 0.4; this.audio.footstep(); this.fx.dust(p); }
    }
    this.player.syncMesh();

    // camo evaluation
    this.world.surfaceColorAt(this.player.pos, this._ref);
    const cd = this._colorDist(this.player.cham.getColor(), this._ref);
    let match = Math.max(0, 1 - cd / 0.5);
    let blend = match;
    if (moving) { blend *= 0.3; this.fx.noiseRing(this.player.pos, Math.min(1, mag * (this.input.run ? 1.4 : 1))); }
    const sil = this.player.cham.silhouette();
    if (sil !== 'tall') blend = Math.min(1, blend + 0.14);
    blend = Math.max(0, Math.min(1, blend));
    this.player.exposure = Math.max(0.04, 1 - blend * 0.92);

    // animate player chameleon (eyes glance toward nearest hunter)
    const hunter = this._nearestHunter();
    let lookAt = null;
    if (hunter) { const a = Math.atan2(hunter.pos.x - this.player.pos.x, hunter.pos.z - this.player.pos.z) - this.player.heading; lookAt = Math.max(-0.6, Math.min(0.6, Math.sin(a))); }
    this.player.cham.update(dt, { moving, lookAt });

    // AI + hunters
    this.manager.update(dt, this.survived);
    this._handleEvents();

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
      this._camTarget(this._tmp);
      this.camera.position.lerp(this._tmp, this.paused ? 0.06 : 0.16);
      this.camera.lookAt(this.player.pos.x, this.player.pos.y + 1.4, this.player.pos.z);
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

  _clearTimers() { this._tutTimers.forEach(clearTimeout); this._tutTimers = []; this._roundTimers.forEach(clearTimeout); this._roundTimers = []; }

  dispose() {
    cancelAnimationFrame(this.raf);
    this._clearTimers();
    window.removeEventListener('resize', this._onResize);
    this._teardownRound();
    this.input.dispose(); this.audio.dispose(); this.ui.dispose(); this.engine.dispose();
    if (this._hostHint) this._hostHint.style.display = '';
  }
}
