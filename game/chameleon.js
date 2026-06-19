/* ===== Meccha Chameleon — Avatar =====
 * A rounded, charming chameleon: soft egg body, turret eyes, a curl tail and a
 * little crest. The skin colour MORPHS smoothly toward a target (we lerp every
 * material each frame ~0.3s) instead of snapping, and poses (STAND / CROUCH /
 * CURL / LIE) blend with squash & stretch so the silhouette reads clearly.
 */
import * as THREE from 'three';

const POSES = {
  stand:  { sy: 1.0,  sxz: 1.0,  y: 0.0,   tuck: 0.0, head: 1.0, tilt: 0.0,  legs: 1.0, sil: 'tall' },
  crouch: { sy: 0.62, sxz: 1.12, y: -0.28, tuck: 0.3, head: 0.7, tilt: 0.0,  legs: 0.5, sil: 'low' },
  curl:   { sy: 0.95, sxz: 1.18, y: -0.05, tuck: 1.0, head: 0.0, tilt: 0.0,  legs: 0.0, sil: 'ball' },
  lie:    { sy: 0.4,  sxz: 1.25, y: -0.45, tuck: 0.5, head: 0.5, tilt: 1.0,  legs: 0.2, sil: 'flat' }
};

export class Chameleon {
  constructor(opts) {
    opts = opts || {};
    this.group = new THREE.Group();
    this.skinMats = [];
    this.color = new THREE.Color(opts.color || 0x86c06a);
    this.target = this.color.clone();
    this.pose = 'stand';
    this._cur = Object.assign({}, POSES.stand);
    this._t = 0;
    this._absorb = 0;
    this.isAI = !!opts.isAI;

    const skin = (geo, x, y, z, rough) => {
      const m = new THREE.MeshStandardMaterial({ color: this.color.clone(), roughness: rough == null ? 0.55 : rough, metalness: 0.0 });
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.set(x || 0, y || 0, z || 0);
      mesh.castShadow = true; mesh.receiveShadow = true;
      this.skinMats.push(m);
      return mesh;
    };

    // pivot so the whole chameleon scales/squashes from its feet
    this.pivot = new THREE.Group();
    this.group.add(this.pivot);

    // body — egg shaped
    const body = skin(new THREE.SphereGeometry(0.62, 24, 18), 0, 0.62, 0);
    body.scale.set(1.0, 1.05, 1.25);
    this.body = body; this.pivot.add(body);
    body.userData.pickColor = this.color; // so the eyedropper can read a chameleon too

    // belly patch (slightly lighter, also morphs)
    const belly = skin(new THREE.SphereGeometry(0.5, 20, 14), 0, 0.5, 0.18, 0.6);
    belly.scale.set(0.9, 0.8, 0.95);
    this.belly = belly; belly._tint = 1.35; this.pivot.add(belly);

    // crest ridge
    this.crest = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const c = skin(new THREE.ConeGeometry(0.07, 0.16 - i * 0.018, 6), 0, 1.12 - i * 0.02, -0.1 - i * 0.12, 0.6);
      c._tint = 0.8; this.crest.add(c);
    }
    this.pivot.add(this.crest);

    // head
    this.head = new THREE.Group(); this.head.position.set(0, 0.78, 0.55);
    const headMesh = skin(new THREE.SphereGeometry(0.42, 20, 16), 0, 0, 0);
    headMesh.scale.set(1.0, 0.95, 1.1); this.head.add(headMesh);
    // snout
    const snout = skin(new THREE.SphereGeometry(0.2, 14, 10), 0, -0.05, 0.34, 0.5);
    snout.scale.set(0.9, 0.7, 1.1); this.head.add(snout);
    this.pivot.add(this.head);

    // turret eyes (cute) — skin turret + glossy ball, pupil and a catch-light;
    // the ball group blinks by squashing in Y.
    this.eyes = [];
    [-1, 1].forEach((s) => {
      const eye = new THREE.Group(); eye.position.set(0.26 * s, 0.12, 0.04);
      const cone = skin(new THREE.SphereGeometry(0.2, 16, 12), 0, 0, 0, 0.5); eye.add(cone); cone._tint = 0.92;
      const ball = new THREE.Group(); ball.position.set(0.06 * s, 0.02, 0.08); eye.add(ball);
      const white = new THREE.Mesh(new THREE.SphereGeometry(0.115, 16, 14), new THREE.MeshStandardMaterial({ color: 0xfff7ec, roughness: 0.18, metalness: 0.0 }));
      ball.add(white);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.058, 14, 12), new THREE.MeshStandardMaterial({ color: 0x0c0a10, roughness: 0.1 }));
      pupil.position.set(0.03 * s, 0.0, 0.085); ball.add(pupil);
      const glint = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      glint.position.set(0.055 * s, 0.04, 0.1); ball.add(glint);
      this.head.add(eye); this.eyes.push({ g: eye, ball, pupil, cone });
    });
    this._blink = 0; this._nextBlink = 1.5 + Math.random() * 3;

    // tongue (darts out occasionally / when absorbing)
    this.tongue = new THREE.Group(); this.tongue.position.set(0, -0.05, 0.5);
    const tMat = new THREE.MeshStandardMaterial({ color: 0xe06a8a, roughness: 0.4 });
    const tStalk = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 1, 8), tMat); tStalk.rotation.x = Math.PI / 2; tStalk.position.z = 0.5; this.tongue.add(tStalk);
    const tTip = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), tMat); tTip.position.z = 1.0; this.tongue.add(tTip);
    this.tongue.scale.z = 0.001; this.head.add(this.tongue);
    this._tongue = 0; this._nextTongue = 3 + Math.random() * 5;
    this._hop = 0; this._lean = 0;

    // tail — tapering curl
    this.tail = new THREE.Group(); this.tail.position.set(0, 0.5, -0.65);
    let px = 0, py = 0, pz = 0, ang = 0;
    for (let i = 0; i < 6; i++) {
      const r = 0.18 - i * 0.022;
      const seg = skin(new THREE.SphereGeometry(Math.max(0.05, r), 10, 8), px, py, pz, 0.6);
      seg._tint = 0.9; this.tail.add(seg);
      ang += 0.5 + i * 0.15; px += Math.sin(ang) * 0.16; pz -= 0.14; py += Math.sin(i) * 0.02 + 0.03;
    }
    this.pivot.add(this.tail);

    // little legs
    this.legs = [];
    [[-0.42, 0.42], [0.42, 0.42], [-0.4, -0.3], [0.4, -0.3]].forEach((p, i) => {
      const leg = new THREE.Group(); leg.position.set(p[0], 0.28, p[1]);
      const l = skin(new THREE.CapsuleGeometry(0.1, 0.22, 4, 8), 0, -0.12, 0, 0.6); l._tint = 0.85; leg.add(l);
      this.pivot.add(leg); this.legs.push({ g: leg, phase: i * Math.PI * 0.5, base: p });
    });

    this.setColorTarget(this.color, true);
  }

  setColorTarget(c, instant) {
    this.target.copy(c);
    if (instant) { this.color.copy(c); this._applyColor(); }
  }
  getColor() { return this.color; }

  _applyColor() {
    this.body.userData.pickColor = this.color;
    for (const m of this.skinMats) {
      const tint = m.userData && m.userData.tint;
      m.color.copy(this.color);
    }
    // belly/tail/legs tinting handled by storing _tint on mesh: re-derive
    this.body.material.color.copy(this.color);
  }

  pulseAbsorb() { this._absorb = 1; this._tongueDrive = 1; }
  hop() { this._launch = 1; }
  land() { this._land = 1; this._tongueDrive = Math.max(this._tongueDrive || 0, 0); }

  setPose(name) { if (POSES[name]) this.pose = name; }

  silhouette() { return POSES[this.pose].sil; }

  update(dt, st) {
    st = st || {};
    this._t += dt;
    // colour morph (~0.3s)
    const k = Math.min(1, dt * 8);
    this.color.lerp(this.target, k);
    // apply with per-part tint
    const apply = (mesh) => {
      const t = mesh._tint || 1;
      mesh.material.color.setRGB(
        Math.min(1, this.color.r * t), Math.min(1, this.color.g * t), Math.min(1, this.color.b * t));
      if (this._absorb > 0.01) { mesh.material.emissive.setRGB(this._absorb * 0.4, this._absorb * 0.4, this._absorb * 0.4); }
      else mesh.material.emissive.setRGB(0, 0, 0);
    };
    this.body.userData.pickColor = this.color;
    this.body.material.color.copy(this.color);
    if (this._absorb > 0.01) this.body.material.emissive.setScalar(this._absorb * 0.4); else this.body.material.emissive.setScalar(0);
    apply(this.belly);
    this.crest.children.forEach(apply);
    this.tail.children.forEach(apply);
    this.legs.forEach((l) => l.g.children.forEach(apply));
    this.head.children.forEach((m) => { if (this.skinMats.includes(m.material)) { m.material.color.copy(this.color); if (this._absorb > 0.01) m.material.emissive.setScalar(this._absorb * 0.3); else m.material.emissive.setScalar(0); } });
    this._absorb = Math.max(0, this._absorb - dt * 3);

    // pose blend
    const P = POSES[this.pose], c = this._cur, pk = Math.min(1, dt * 9);
    for (const key in P) if (typeof P[key] === 'number') c[key] += (P[key] - c[key]) * pk;

    // jump squash/stretch envelopes
    this._launch = Math.max(0, (this._launch || 0) - dt * 4);
    this._land = Math.max(0, (this._land || 0) - dt * 5);
    const launch = this._launch, land = this._land;

    // movement lean (body tips into travel)
    const leanTarget = Math.min(1, (st.speed || 0) / 9) * (st.moving ? 1 : 0);
    this._lean += (leanTarget - this._lean) * Math.min(1, dt * 8);

    // squash & stretch on movement / breathing
    const breathe = Math.sin(this._t * 2.2) * 0.02;
    const moving = st.moving;
    const gallop = moving ? Math.abs(Math.sin(this._t * 12)) * 0.05 : 0;
    this.pivot.scale.set(
      c.sxz - gallop * 0.4 - launch * 0.14 + land * 0.2,
      c.sy + breathe + gallop + launch * 0.26 - land * 0.28,
      c.sxz - gallop * 0.4 - launch * 0.14 + land * 0.2);
    this.pivot.position.y = c.y;
    this.pivot.rotation.x = c.tilt * Math.PI * 0.46 + this._lean * 0.18;

    // head tuck for curl
    this.head.scale.setScalar(Math.max(0.001, c.head));
    this.head.position.y = 0.78 - (1 - c.head) * 0.3 + c.tuck * -0.1;
    this.head.position.z = 0.55 - c.tuck * 0.5;
    // blink timer
    this._nextBlink -= dt;
    if (this._nextBlink <= 0 && this._blink === 0) { this._blink = 0.0001; }
    if (this._blink > 0) { this._blink += dt * 7; if (this._blink >= 2) { this._blink = 0; this._nextBlink = 1.8 + Math.random() * 4; } }
    const lid = this._blink > 0 ? Math.max(0.08, 1 - Math.sin(Math.min(Math.PI, this._blink * Math.PI / 2)) * 0.92) : 1;

    // eyes look around independently (chameleon!) / toward danger
    const look = st.lookAt;
    this.eyes.forEach((e, i) => {
      const wobble = Math.sin(this._t * 1.1 + i * 2.3) * 0.28;
      e.g.rotation.y = (look != null ? look * (i ? 1 : 0.7) : wobble);
      e.g.rotation.x = Math.sin(this._t * 0.8 + i) * 0.12;
      e.ball.scale.y = lid;
      e.cone.material.color.setRGB(Math.min(1, this.color.r * 0.92), Math.min(1, this.color.g * 0.92), Math.min(1, this.color.b * 0.92));
    });

    // tongue flick (timer or on absorb)
    this._nextTongue -= dt;
    if (this._nextTongue <= 0) { this._tongueDrive = 1; this._nextTongue = 4 + Math.random() * 6; }
    if (this._tongueDrive > 0) { this._tongue += dt * 6; if (this._tongue >= 2) { this._tongue = 0; this._tongueDrive = 0; } }
    const tExt = this._tongue > 0 ? Math.sin(Math.min(Math.PI, this._tongue * Math.PI / 2)) : 0;
    this.tongue.scale.z = Math.max(0.001, tExt * 1.3);
    this.tongue.visible = this.pose !== 'curl';

    // tail curl tightens in ball pose
    this.tail.scale.setScalar(1 - c.tuck * 0.3);
    this.tail.rotation.x = c.tuck * 0.6;

    // legs walk cycle
    this.legs.forEach((l) => {
      const amp = moving ? 0.6 : 0.04;
      l.g.rotation.x = Math.sin(this._t * 12 + l.phase) * amp * c.legs;
      l.g.scale.setScalar(Math.max(0.001, c.legs));
    });
  }

  dispose() {
    this.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  }
}
