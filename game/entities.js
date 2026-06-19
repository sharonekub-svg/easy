/* ===== Meccha Chameleon — Entities & AI =====
 * World wraps map collision / LOS / colour sampling so the player and every AI
 * share one physics + perception model. Agents are chameleons with a team and
 * an "exposure" (how visible they are). Hunters hunt; hiders camouflage & flee.
 * The manager owns the roster and drives Classic / Infection / Double modes.
 */
import * as THREE from 'three';
import { Chameleon } from './chameleon.js';

export class World {
  constructor(scene, mapDesc) {
    this.scene = scene;
    this.map = mapDesc;
    this.colliders = mapDesc.colliders;
    this.bounds = mapDesc.bounds;
    this.pickables = mapDesc.pickables;
    this.ray = new THREE.Raycaster();
    this._tmp = new THREE.Vector3();
    this._down = new THREE.Vector3(0, -1, 0);
  }
  clampBounds(p, pad) {
    pad = pad || 0.5; const b = this.bounds;
    p.x = Math.max(b.minX + pad, Math.min(b.maxX - pad, p.x));
    p.z = Math.max(b.minZ + pad, Math.min(b.maxZ - pad, p.z));
  }
  collide(p, radius) {
    for (let i = 0; i < this.colliders.length; i++) {
      const c = this.colliders[i];
      const hw = c.hw + radius, hd = c.hd + radius;
      const dx = p.x - c.x, dz = p.z - c.z;
      if (Math.abs(dx) < hw && Math.abs(dz) < hd) {
        const ox = hw - Math.abs(dx), oz = hd - Math.abs(dz);
        if (ox < oz) p.x = c.x + (dx < 0 ? -hw : hw); else p.z = c.z + (dz < 0 ? -hd : hd);
      }
    }
  }
  losBlocked(from, to) {
    const d = this._tmp.copy(to).sub(from); d.y = 0; const dist = d.length(); if (dist < 0.001) return false;
    d.normalize();
    // sample colliders as boxes along the segment (fast, no mesh raycast)
    for (let i = 0; i < this.colliders.length; i++) {
      const c = this.colliders[i];
      if (c.hw < 0.4 && c.hd < 0.4) continue; // ignore tiny props for sight
      // ray-box (2D) slab test
      const minx = c.x - c.hw, maxx = c.x + c.hw, minz = c.z - c.hd, maxz = c.z + c.hd;
      let tmin = 0, tmax = dist;
      for (const ax of ['x', 'z']) {
        const o = from[ax], dd = d[ax], mn = ax === 'x' ? minx : minz, mx = ax === 'x' ? maxx : maxz;
        if (Math.abs(dd) < 1e-6) { if (o < mn || o > mx) { tmin = Infinity; break; } }
        else { let t1 = (mn - o) / dd, t2 = (mx - o) / dd; if (t1 > t2) { const t = t1; t1 = t2; t2 = t; } tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2); }
      }
      if (tmin <= tmax && tmin > 0.4 && tmin < dist - 0.4) return true;
    }
    return false;
  }
  // fraction (0..1) along from->to before a TALL collider (wall) is hit; 1 = clear.
  // Used to pull the camera in so it never clips through walls.
  cameraHitFrac(from, to, minH) {
    const d = this._tmp.copy(to).sub(from); const dist = d.length(); if (dist < 0.001) return 1; d.normalize();
    let best = 1; minH = minH || 2.2; const pad = 0.35;
    for (let i = 0; i < this.colliders.length; i++) {
      const c = this.colliders[i]; if ((c.h || 1) < minH) continue;
      const minx = c.x - c.hw - pad, maxx = c.x + c.hw + pad, minz = c.z - c.hd - pad, maxz = c.z + c.hd + pad;
      let tmin = 0, tmax = dist, miss = false;
      for (const ax of ['x', 'z']) {
        const o = from[ax], dd = d[ax], mn = ax === 'x' ? minx : minz, mx = ax === 'x' ? maxx : maxz;
        if (Math.abs(dd) < 1e-6) { if (o < mn || o > mx) { miss = true; break; } }
        else { let t1 = (mn - o) / dd, t2 = (mx - o) / dd; if (t1 > t2) { const t = t1; t1 = t2; t2 = t; } tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2); }
      }
      if (!miss && tmin <= tmax && tmin > 0 && tmin < dist) best = Math.min(best, tmin / dist);
    }
    return best;
  }
  // colour of the surface directly under / nearest to a position (for camo)
  surfaceColorAt(pos, out) {
    out = out || new THREE.Color();
    this.ray.set(this._tmp.set(pos.x, 3, pos.z), this._down); this.ray.far = 6;
    const hits = this.ray.intersectObjects(this.pickables, false);
    if (hits.length) { const m = hits[0].object.material; if (m && m.color) { out.copy(m.color); return out; } }
    // fallback: nearest prop colour
    let best = null, bd = 4;
    for (let i = 0; i < this.pickables.length; i++) {
      const o = this.pickables[i]; if (!o.material || !o.material.color) continue;
      const d = Math.hypot(pos.x - o.position.x, pos.z - o.position.z);
      if (d < bd) { bd = d; best = o; }
    }
    if (best) out.copy(best.material.color); else out.setRGB(0.4, 0.5, 0.3);
    return out;
  }
  // raycast from a screen-projected ray for the precise eyedropper
  pickColorRay(raycaster, out) {
    out = out || new THREE.Color();
    const hits = raycaster.intersectObjects(this.pickables, false);
    if (hits.length && hits[0].object.material && hits[0].object.material.color) { out.copy(hits[0].object.material.color); return { color: out, point: hits[0].point, hit: true }; }
    return { color: out.setRGB(0.5, 0.5, 0.5), point: null, hit: false };
  }
}

function colorDist(a, c) { const dr = a.r - c.r, dg = a.g - c.g, db = a.b - c.b; return Math.sqrt(dr * dr + dg * dg + db * db); }

export class Agent {
  constructor(opts) {
    this.cham = new Chameleon({ color: opts.color, isAI: !opts.isPlayer });
    this.group = this.cham.group;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.team = opts.team || 'hider';
    this.isPlayer = !!opts.isPlayer;
    this.alive = true;
    this.exposure = 1;
    this.heading = 0;
    this.name = opts.name || 'Hider';
    this._wp = new THREE.Vector3();
    this._wpT = 0;
    this._eyeT = 1 + Math.random() * 2;
    this._ref = new THREE.Color();
    this._moving = false;
    this._caughtFx = 0;
  }
  setPos(v) { this.pos.copy(v); this.group.position.copy(v); }
  syncMesh() { this.group.position.set(this.pos.x, this.pos.y, this.pos.z); this.group.rotation.y = this.heading; }
}

export class EntityManager {
  constructor(world, audio) {
    this.world = world; this.audio = audio;
    this.agents = [];
    this.player = null;
    this.mode = 'classic';
    this.events = [];
    this._tmp = new THREE.Vector3();
  }
  add(a) { this.agents.push(a); this.world.scene.add(a.group); return a; }
  clear() { this.agents.forEach((a) => { if (a.group.parent) a.group.parent.remove(a.group); a.cham.dispose(); }); this.agents = []; this.player = null; }

  spawn(mode, mapDesc, playerColor, hiderCount) {
    this.mode = mode; this.clear();
    const spawns = mapDesc.spawns.slice();
    // player
    const p = new Agent({ color: playerColor, team: mode === 'double' ? 'hider' : 'hider', isPlayer: true, name: 'You' });
    const ps = spawns.shift() || mapDesc.hunterSpawn;
    p.setPos(ps); this.player = p; this.add(p);

    // AI hiders
    const palette = [0x7ec850, 0xe6b93c, 0x4f9dd8, 0xe0739a, 0x9b6fd0, 0x55c0a0];
    const n = hiderCount || 4;
    for (let i = 0; i < n; i++) {
      const a = new Agent({ color: palette[i % palette.length], team: 'hider', name: 'Hider ' + (i + 1) });
      const sp = spawns[i % spawns.length] || mapDesc.hunterSpawn;
      a.setPos(new THREE.Vector3(sp.x + (Math.random() - 0.5) * 4, 0, sp.z + (Math.random() - 0.5) * 4));
      a._newWaypoint = true; this.add(a);
    }

    // hunter (not in double's hide phase)
    const h = new Agent({ color: 0xd6342a, team: 'hunter', name: 'Hunter' });
    h.cham.setColorTarget(new THREE.Color(0xd6342a), true);
    h.setPos(mapDesc.hunterSpawn.clone());
    h._isHunter = true; this.hunterAgent = h; this.add(h);
    h.dormant = true; // hunters sleep through the HIDE phase; wake at HUNT
  }

  hiders() { return this.agents.filter((a) => a.team === 'hider' && a.alive); }
  hunters() { return this.agents.filter((a) => a.team === 'hunter' && a.alive); }

  // hunter perception: can a hunter currently see target?
  sees(hunter, target) {
    if (!target.alive) return false;
    const d = this._tmp.copy(target.pos).sub(hunter.pos); const dist = d.length();
    const range = 22 * (0.25 + target.exposure * 0.95);
    if (dist > Math.max(3, range)) return false;
    // FOV cone (hunters have ~130° vision)
    const fwd = Math.atan2(Math.sin(hunter.heading), Math.cos(hunter.heading));
    const ang = Math.atan2(d.x, d.z);
    let diff = Math.abs(ang - hunter.heading); diff = Math.min(diff, Math.PI * 2 - diff);
    if (dist > 3 && diff > 1.25) return false;
    if (this.world.losBlocked(hunter.pos, target.pos)) return false;
    return true;
  }

  update(dt, time) {
    this.events.length = 0;
    const world = this.world;
    // update AI hiders
    for (const a of this.agents) {
      if (a.isPlayer || a.team === 'hunter') continue;
      this._updateHider(a, dt);
    }
    // update hunters
    for (const h of this.hunters()) this._updateHunter(h, dt, time);
    // sync meshes + chameleon animation done by caller for player; AI here
    return this.events;
  }

  _moveAgent(a, dir, speed, dt, radius) {
    if (dir.lengthSq() > 0.0001) {
      dir.normalize();
      a.pos.x += dir.x * speed * dt; a.pos.z += dir.z * speed * dt;
      this.world.clampBounds(a.pos, radius); this.world.collide(a.pos, radius);
      a.heading = Math.atan2(dir.x, dir.z); a._moving = true;
    } else a._moving = false;
  }

  _updateHider(a, dt) {
    const world = this.world; const hunter = this.hunterAgent;
    // perceive nearest hunter
    let danger = null, dDist = Infinity;
    for (const h of this.hunters()) { if (h.dormant) continue; const dd = h.pos.distanceTo(a.pos); if (dd < dDist) { dDist = dd; danger = h; } }
    const dir = this._tmp.set(0, 0, 0);
    let speed = 3.2, fleeing = false;
    if (danger && dDist < 11 && !world.losBlocked(danger.pos, a.pos)) {
      // flee away from hunter toward cover
      dir.copy(a.pos).sub(danger.pos); dir.y = 0; fleeing = true; speed = 6.2;
      a.cham.setPose('stand');
    } else {
      // wander to waypoints, occasionally hide & crouch
      a._wpT -= dt;
      if (a._wpT <= 0 || a._newWaypoint || a.pos.distanceTo(a._wp) < 1.5) {
        const b = world.bounds;
        a._wp.set(b.minX + Math.random() * (b.maxX - b.minX), 0, b.minZ + Math.random() * (b.maxZ - b.minZ));
        a._wpT = 3 + Math.random() * 4; a._newWaypoint = false;
        a._willHide = Math.random() < 0.5;
      }
      if (a._willHide && a.pos.distanceTo(a._wp) < 3) { speed = 0; a.cham.setPose(Math.random() < 0.5 ? 'crouch' : 'curl'); }
      else { dir.copy(a._wp).sub(a.pos); dir.y = 0; a.cham.setPose('stand'); }
    }
    this._moveAgent(a, dir, speed, dt, 0.6);

    // AI camouflage: periodically eyedrop nearest surface colour
    a._eyeT -= dt;
    if (a._eyeT <= 0) { a._eyeT = 1.5 + Math.random() * 2.5; world.surfaceColorAt(a.pos, a._ref); a.cham.setColorTarget(a._ref); a.cham.pulseAbsorb(); }

    // exposure = how visible (mismatch + motion); used by hunter perception
    world.surfaceColorAt(a.pos, a._ref);
    const match = Math.max(0, 1 - colorDist(a.cham.getColor(), a._ref) / 0.5);
    let blend = match; if (a._moving) blend *= 0.35; if (a.cham.silhouette() !== 'tall') blend = Math.min(1, blend + 0.12);
    a.exposure = Math.max(0.05, 1 - blend * 0.9);

    a.syncMesh();
    a.cham.update(dt, { moving: a._moving });
    if (a._caughtFx > 0) a._caughtFx -= dt;
  }

  _updateHunter(h, dt, time) {
    if (h.dormant) { h.cham.update(dt, {}); h.syncMesh(); return; }
    const world = this.world;
    // pick best visible target (player + hiders)
    const targets = [this.player].concat(this.hiders()).filter((t) => t && t.alive && t !== h);
    let prey = null, pd = Infinity;
    for (const t of targets) { if (this.sees(h, t)) { const d = t.pos.distanceTo(h.pos); if (d < pd) { pd = d; prey = t; } } }

    const dir = this._tmp.set(0, 0, 0); let speed = 5.2;
    if (prey) { h._chase = prey; h._lost = 0; dir.copy(prey.pos).sub(h.pos); dir.y = 0; speed = 8.2; }
    else if (h._chase && h._lost < 2.2) { h._lost += dt; dir.copy(h._chase.pos).sub(h.pos); dir.y = 0; speed = 7; if (h.pos.distanceTo(h._chase.pos) < 1.5) { h._lost = 3; } }
    else {
      h._chase = null;
      h._wpT -= dt;
      if (h._wpT <= 0 || h.pos.distanceTo(h._wp) < 2) { const b = world.bounds; h._wp.set(b.minX + Math.random() * (b.maxX - b.minX), 0, b.minZ + Math.random() * (b.maxZ - b.minZ)); h._wpT = 3 + Math.random() * 3; }
      dir.copy(h._wp).sub(h.pos); dir.y = 0;
    }
    this._moveAgent(h, dir, speed, dt, 0.6);

    // catch detection
    for (const t of targets) {
      if (t.pos.distanceTo(h.pos) < 1.5 && t.alive && this.sees(h, t)) {
        this._catch(t, h);
      }
    }
    h.syncMesh(); h.cham.update(dt, { moving: h._moving });
  }

  _catch(target, hunter) {
    if (!target.alive) return;
    target.alive = false; target._caughtFx = 1;
    this.events.push({ type: 'catch', target, hunter, isPlayer: target.isPlayer });
    if (this.mode === 'infection' && !target.isPlayer) {
      // convert to hunter
      target.alive = true; target.team = 'hunter'; target._isHunter = true; target._chase = null; target._wpT = 0;
      target.cham.setColorTarget(new THREE.Color(0xd6342a));
      this.events.push({ type: 'infect', target });
    } else if (!target.isPlayer) {
      // remove caught hider after a beat
      target.group.visible = false;
    }
  }

  wakeHunters() { this.hunters().forEach((h) => h.dormant = false); if (this.hunterAgent) this.hunterAgent.dormant = false; }
  // for DOUBLE mode: flip every surviving hider into a hunter
  flipToHunt() { this.hiders().forEach((a) => { if (!a.isPlayer) { a.team = 'hunter'; a._chase = null; } }); this.wakeHunters(); }
}
