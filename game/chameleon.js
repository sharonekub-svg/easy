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

    // turret eyes (cute) — white ball + dark pupil on a little cone
    this.eyes = [];
    [-1, 1].forEach((s) => {
      const eye = new THREE.Group(); eye.position.set(0.26 * s, 0.12, 0.04);
      const cone = skin(new THREE.SphereGeometry(0.2, 14, 12), 0, 0, 0, 0.5); cone.scale.set(1, 1, 1); eye.add(cone);
      const white = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 12), new THREE.MeshStandardMaterial({ color: 0xfff7ec, roughness: 0.3 }));
      white.position.set(0.06 * s, 0.02, 0.08); eye.add(white);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), new THREE.MeshStandardMaterial({ color: 0x141018, roughness: 0.2 }));
      pupil.position.set(0.09 * s, 0.02, 0.15); eye.add(pupil);
      this.head.add(eye); this.eyes.push({ g: eye, pupil });
    });

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

  pulseAbsorb() { this._absorb = 1; }

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

    // squash & stretch on movement / breathing
    const breathe = Math.sin(this._t * 2.2) * 0.02;
    const moving = st.moving;
    const gallop = moving ? Math.abs(Math.sin(this._t * 12)) * 0.05 : 0;
    this.pivot.scale.set(
      c.sxz - gallop * 0.4,
      c.sy + breathe + gallop,
      c.sxz - gallop * 0.4);
    this.pivot.position.y = c.y;
    this.pivot.rotation.x = c.tilt * Math.PI * 0.46;

    // head tuck for curl
    this.head.scale.setScalar(Math.max(0.001, c.head));
    this.head.position.y = 0.78 - (1 - c.head) * 0.3 + c.tuck * -0.1;
    this.head.position.z = 0.55 - c.tuck * 0.5;
    // eyes look around / toward danger
    const look = st.lookAt;
    this.eyes.forEach((e, i) => {
      const wobble = Math.sin(this._t * 1.3 + i * 2) * 0.2;
      e.g.rotation.y = (look != null ? look : wobble);
      e.g.rotation.x = Math.sin(this._t * 0.9 + i) * 0.1;
    });

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
