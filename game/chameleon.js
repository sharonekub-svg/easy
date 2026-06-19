/* ===== Meccha Chameleon — Avatar =====
 * A rounded, charming chameleon: soft egg body, turret eyes, a curl tail and a
 * little crest. Colour is applied by PAINTING: when you pick a colour the
 * chameleon lifts a brush and the new colour sweeps up the body (you actively
 * paint yourself — it does not just snap). Poses (STAND / CROUCH / CURL / LIE)
 * blend with squash & stretch; the avatar blinks, darts its eyes, flicks its
 * tongue, leans into movement and squashes on landing. Scale is set externally
 * (small toy hiders, a towering hunter).
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
    this.parts = [];                 // every paintable skin mesh: {mat,tint,yNorm}
    this.color = new THREE.Color(opts.color || 0x86c06a);
    this.target = this.color.clone();
    this.pose = 'stand';
    this._cur = Object.assign({}, POSES.stand);
    this._t = Math.random() * 10;
    this._absorb = 0;
    this.isAI = !!opts.isAI;
    // paint state
    this._painting = false; this._paintProg = 1; this._paintDur = 0.6;
    this._paintFrom = this.color.clone();

    // record a paintable skin mesh with a vertical rank (0 feet .. 1 head)
    const skin = (geo, x, y, z, rough, tint, yNorm) => {
      const m = new THREE.MeshStandardMaterial({ color: this.color.clone(), roughness: rough == null ? 0.5 : rough, metalness: 0.0 });
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.set(x || 0, y || 0, z || 0); mesh.castShadow = true; mesh.receiveShadow = true;
      this.parts.push({ mesh: mesh, mat: m, tint: tint == null ? 1 : tint, yNorm: yNorm == null ? 0.5 : yNorm });
      return mesh;
    };

    this.pivot = new THREE.Group(); this.group.add(this.pivot);

    // body — egg shaped
    const body = skin(new THREE.SphereGeometry(0.62, 28, 20), 0, 0.62, 0, 0.45, 1, 0.6);
    body.scale.set(1.0, 1.05, 1.25); this.body = body; this.pivot.add(body);
    body.userData.pickColor = this.color;

    // belly patch
    const belly = skin(new THREE.SphereGeometry(0.5, 22, 16), 0, 0.5, 0.18, 0.55, 1.32, 0.42);
    belly.scale.set(0.9, 0.8, 0.95); this.pivot.add(belly);

    // crest ridge
    this.crest = new THREE.Group();
    for (let i = 0; i < 6; i++) { const c = skin(new THREE.ConeGeometry(0.075, 0.18 - i * 0.016, 7), 0, 1.14 - i * 0.02, -0.05 - i * 0.13, 0.5, 0.82, 0.85); this.crest.add(c); }
    this.pivot.add(this.crest);

    // head
    this.head = new THREE.Group(); this.head.position.set(0, 0.78, 0.55);
    const headMesh = skin(new THREE.SphereGeometry(0.42, 22, 18), 0, 0, 0, 0.45, 1, 0.9); headMesh.scale.set(1.0, 0.95, 1.1); this.head.add(headMesh);
    const snout = skin(new THREE.SphereGeometry(0.2, 16, 12), 0, -0.05, 0.34, 0.5, 1.05, 0.88); snout.scale.set(0.9, 0.7, 1.1); this.head.add(snout);
    // smile
    const smileMat = new THREE.MeshStandardMaterial({ color: 0x3a2a30, roughness: 0.6 });
    const smile = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.02, 6, 14, Math.PI), smileMat); smile.position.set(0, -0.12, 0.52); smile.rotation.set(Math.PI, 0, 0); this.head.add(smile);
    this.pivot.add(this.head);

    // turret eyes
    this.eyes = [];
    [-1, 1].forEach((s) => {
      const eye = new THREE.Group(); eye.position.set(0.26 * s, 0.12, 0.04);
      const cone = skin(new THREE.SphereGeometry(0.2, 16, 12), 0, 0, 0, 0.5, 0.92, 0.92); eye.add(cone);
      const ball = new THREE.Group(); ball.position.set(0.06 * s, 0.02, 0.08); eye.add(ball);
      const white = new THREE.Mesh(new THREE.SphereGeometry(0.115, 16, 14), new THREE.MeshStandardMaterial({ color: 0xfff7ec, roughness: 0.16 })); ball.add(white);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.058, 14, 12), new THREE.MeshStandardMaterial({ color: 0x0c0a10, roughness: 0.1 })); pupil.position.set(0.03 * s, 0, 0.085); ball.add(pupil);
      const glint = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffffff })); glint.position.set(0.055 * s, 0.04, 0.1); ball.add(glint);
      this.head.add(eye); this.eyes.push({ g: eye, ball, pupil, cone });
    });
    this._blink = 0; this._nextBlink = 1.5 + Math.random() * 3;

    // tongue
    this.tongue = new THREE.Group(); this.tongue.position.set(0, -0.05, 0.5);
    const tMat = new THREE.MeshStandardMaterial({ color: 0xe06a8a, roughness: 0.4 });
    const tStalk = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 1, 8), tMat); tStalk.rotation.x = Math.PI / 2; tStalk.position.z = 0.5; this.tongue.add(tStalk);
    const tTip = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), tMat); tTip.position.z = 1.0; this.tongue.add(tTip);
    this.tongue.scale.z = 0.001; this.head.add(this.tongue);
    this._tongue = 0; this._nextTongue = 3 + Math.random() * 5;
    this._hop = 0; this._lean = 0; this._launch = 0; this._land = 0;

    // tail — tapering curl
    this.tail = new THREE.Group(); this.tail.position.set(0, 0.5, -0.65);
    let px = 0, py = 0, pz = 0, ang = 0;
    for (let i = 0; i < 7; i++) { const r = 0.2 - i * 0.022; const seg = skin(new THREE.SphereGeometry(Math.max(0.05, r), 12, 9), px, py, pz, 0.55, 0.9, 0.35); this.tail.add(seg); ang += 0.5 + i * 0.15; px += Math.sin(ang) * 0.16; pz -= 0.14; py += Math.sin(i) * 0.02 + 0.03; }
    this.pivot.add(this.tail);

    // legs
    this.legs = [];
    [[-0.42, 0.42], [0.42, 0.42], [-0.4, -0.3], [0.4, -0.3]].forEach((p, i) => {
      const leg = new THREE.Group(); leg.position.set(p[0], 0.28, p[1]);
      const l = skin(new THREE.CapsuleGeometry(0.1, 0.24, 4, 8), 0, -0.12, 0, 0.55, 0.85, 0.12); leg.add(l);
      const foot = skin(new THREE.SphereGeometry(0.12, 8, 6), 0, -0.26, 0.05, 0.6, 0.8, 0.06); foot.scale.set(1.1, 0.6, 1.3); leg.add(foot);
      this.pivot.add(leg); this.legs.push({ g: leg, phase: i * Math.PI * 0.5, base: p });
    });

    // BRUSH the chameleon paints itself with (hidden until painting)
    this.brush = new THREE.Group();
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.7, 8), new THREE.MeshStandardMaterial({ color: 0xc89b5a, roughness: 0.5 })); handle.position.y = 0.35; this.brush.add(handle);
    const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.12, 8), new THREE.MeshStandardMaterial({ color: 0xbfc3c8, roughness: 0.3, metalness: 0.6 })); ferrule.position.y = 0.04; this.brush.add(ferrule);
    this.brushTip = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 })); this.brushTip.position.y = -0.13; this.brushTip.rotation.x = Math.PI; this.brush.add(this.brushTip);
    this.brush.visible = false; this.brush.scale.setScalar(0.9); this.group.add(this.brush);

    this._applyColorInstant();
  }

  // ---- colour / painting ----
  setColorTarget(c, instant) {
    this.target.copy(c);
    if (instant) { this.color.copy(c); this._paintFrom.copy(c); this._paintProg = 1; this._painting = false; this._applyColorInstant(); }
    // otherwise the steady colour eases toward target in update() (used by the
    // wheel + AI). The deliberate brush paint is triggered via paintSelf().
  }
  // begin actively painting the body with colour c (brush + bottom-up sweep)
  paintSelf(c, dur) {
    this.target.copy(c);
    this._paintFrom.copy(this.color);
    this._paintProg = 0; this._painting = true; this._paintDur = dur || 0.6;
    this.brush.visible = true; this.brushTip.material.color.copy(c);
    this._absorb = 1;
  }
  getColor() { return this.color; }
  pulseAbsorb() { this._absorb = 1; this._tongueDrive = 1; }
  hop() { this._launch = 1; }
  land() { this._land = 1; }
  setPose(name) { if (POSES[name]) this.pose = name; }
  silhouette() { return POSES[this.pose].sil; }

  _applyColorInstant() {
    const c = this.color;
    for (const p of this.parts) p.mat.color.setRGB(Math.min(1, c.r * p.tint), Math.min(1, c.g * p.tint), Math.min(1, c.b * p.tint));
    this.body.userData.pickColor = this.color;
  }

  update(dt, st) {
    st = st || {};
    this._t += dt;

    // ---- paint progression ----
    if (this._painting) {
      this._paintProg += dt / this._paintDur;
      // effective colour for camo tracks the sweep
      this.color.lerpColors(this._paintFrom, this.target, Math.min(1, this._paintProg));
      if (this._paintProg >= 1) { this._painting = false; this._paintProg = 1; this.color.copy(this.target); this.brush.visible = false; }
    } else {
      // settle toward target (manual wheel changes still ease in)
      this.color.lerp(this.target, Math.min(1, dt * 8));
    }

    // paint each part: bottom-up wipe while painting, else flat colour
    const from = this._paintFrom, to = this.target, prog = this._paintProg, band = 0.16;
    for (const p of this.parts) {
      let r, g, bch;
      if (this._painting) {
        const tt = Math.max(0, Math.min(1, (prog - (p.yNorm - band)) / (band * 2)));
        r = from.r + (to.r - from.r) * tt; g = from.g + (to.g - from.g) * tt; bch = from.b + (to.b - from.b) * tt;
      } else { r = this.color.r; g = this.color.g; bch = this.color.b; }
      p.mat.color.setRGB(Math.min(1, r * p.tint), Math.min(1, g * p.tint), Math.min(1, bch * p.tint));
      if (this._absorb > 0.01) p.mat.emissive.setScalar(this._absorb * 0.3); else p.mat.emissive.setScalar(0);
    }
    this.body.userData.pickColor = this.color;
    this._absorb = Math.max(0, this._absorb - dt * 2.2);

    // ---- jump squash envelopes ----
    this._launch = Math.max(0, this._launch - dt * 4);
    this._land = Math.max(0, this._land - dt * 5);
    const launch = this._launch, land = this._land;

    // movement lean
    const leanTarget = Math.min(1, (st.speed || 0) / 9) * (st.moving ? 1 : 0);
    this._lean += (leanTarget - this._lean) * Math.min(1, dt * 8);

    // pose blend
    const P = POSES[this.pose], c = this._cur, pk = Math.min(1, dt * 9);
    for (const key in P) if (typeof P[key] === 'number') c[key] += (P[key] - c[key]) * pk;

    // squash & stretch / breathing / gallop
    const breathe = Math.sin(this._t * 2.2) * 0.02;
    const moving = st.moving;
    const gallop = moving ? Math.abs(Math.sin(this._t * 12)) * 0.05 : 0;
    this.pivot.scale.set(c.sxz - gallop * 0.4 - launch * 0.14 + land * 0.2, c.sy + breathe + gallop + launch * 0.26 - land * 0.28, c.sxz - gallop * 0.4 - launch * 0.14 + land * 0.2);
    this.pivot.position.y = c.y;
    this.pivot.rotation.x = c.tilt * Math.PI * 0.46 + this._lean * 0.18;

    // head tuck
    this.head.scale.setScalar(Math.max(0.001, c.head));
    this.head.position.y = 0.78 - (1 - c.head) * 0.3 + c.tuck * -0.1;
    this.head.position.z = 0.55 - c.tuck * 0.5;

    // blink
    this._nextBlink -= dt;
    if (this._nextBlink <= 0 && this._blink === 0) this._blink = 0.0001;
    if (this._blink > 0) { this._blink += dt * 7; if (this._blink >= 2) { this._blink = 0; this._nextBlink = 1.8 + Math.random() * 4; } }
    const lid = this._blink > 0 ? Math.max(0.08, 1 - Math.sin(Math.min(Math.PI, this._blink * Math.PI / 2)) * 0.92) : 1;

    // eyes
    const look = st.lookAt;
    this.eyes.forEach((e, i) => {
      const wobble = Math.sin(this._t * 1.1 + i * 2.3) * 0.28;
      e.g.rotation.y = (look != null ? look * (i ? 1 : 0.7) : wobble);
      e.g.rotation.x = Math.sin(this._t * 0.8 + i) * 0.12;
      e.ball.scale.y = lid;
    });

    // tongue
    this._nextTongue -= dt;
    if (this._nextTongue <= 0) { this._tongueDrive = 1; this._nextTongue = 4 + Math.random() * 6; }
    if (this._tongueDrive > 0) { this._tongue += dt * 6; if (this._tongue >= 2) { this._tongue = 0; this._tongueDrive = 0; } }
    const tExt = this._tongue > 0 ? Math.sin(Math.min(Math.PI, this._tongue * Math.PI / 2)) : 0;
    this.tongue.scale.z = Math.max(0.001, tExt * 1.3);
    this.tongue.visible = this.pose !== 'curl';

    // tail
    this.tail.scale.setScalar(1 - c.tuck * 0.3);
    this.tail.rotation.x = c.tuck * 0.6 + Math.sin(this._t * 1.4) * 0.05;

    // legs walk cycle
    this.legs.forEach((l) => { const amp = moving ? 0.6 : 0.04; l.g.rotation.x = Math.sin(this._t * 12 + l.phase) * amp * c.legs; l.g.scale.setScalar(Math.max(0.001, c.legs)); });

    // brush animation while painting — sweeps up the body in strokes
    if (this.brush.visible) {
      const p = this._paintProg;
      const stroke = Math.sin(p * Math.PI * 5) * 0.45;
      this.brush.position.set(0.35 + stroke, 0.4 + p * 1.3, 0.7);
      this.brush.rotation.set(-0.5, stroke * 0.6, -0.4 + stroke * 0.5);
      const s = 0.9 * Math.min(1, (1 - p) * 4 + 0.001);
      this.brush.scale.setScalar(Math.max(0.001, p < 0.95 ? 0.9 : s));
    }
  }

  dispose() { this.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); }
}
