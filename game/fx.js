/* ===== Meccha Chameleon — FX / Juice =====
 * Paint-splash on absorb, a "poof" puff when caught, footstep dust, an expanding
 * ground "noise ring" when you move (movement reveals you), and camera shake.
 * One pooled Points buffer keeps it cheap; rings are a tiny mesh pool.
 */
import * as THREE from 'three';

function softSprite() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.7)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class FX {
  constructor(scene, camera) {
    this.scene = scene; this.camera = camera;
    this.MAX = 600;
    this.pos = new Float32Array(this.MAX * 3);
    this.col = new Float32Array(this.MAX * 3);
    this.vel = new Float32Array(this.MAX * 3);
    this.life = new Float32Array(this.MAX);
    this.size = new Float32Array(this.MAX);
    this._head = 0;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    geo.setAttribute('psize', new THREE.BufferAttribute(this.size, 1));
    this.geo = geo;
    const mat = new THREE.PointsMaterial({ size: 0.35, map: softSprite(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
    this.points = new THREE.Points(geo, mat); this.points.frustumCulled = false; scene.add(this.points);

    // rings
    this.rings = [];
    const ringGeo = new THREE.RingGeometry(0.4, 0.5, 28);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false });
    for (let i = 0; i < 8; i++) {
      const r = new THREE.Mesh(ringGeo, ringMat.clone()); r.rotation.x = -Math.PI / 2; r.visible = false; scene.add(r);
      this.rings.push({ mesh: r, life: 0, max: 1 });
    }
    this._ringGeo = ringGeo;

    // camera shake
    this.trauma = 0; this._shakeBase = new THREE.Vector3();
  }

  _emit(x, y, z, r, g, b, vx, vy, vz, life, size) {
    const i = this._head; this._head = (this._head + 1) % this.MAX;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.col[i * 3] = r; this.col[i * 3 + 1] = g; this.col[i * 3 + 2] = b;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.life[i] = life; this.size[i] = size;
  }

  paintSplash(pos, color) {
    const c = color || { r: 1, g: 1, b: 1 };
    for (let i = 0; i < 28; i++) {
      const a = Math.random() * Math.PI * 2, sp = 1.5 + Math.random() * 3;
      this._emit(pos.x, pos.y + 0.8, pos.z, c.r, c.g, c.b,
        Math.cos(a) * sp, 1 + Math.random() * 3, Math.sin(a) * sp, 0.5 + Math.random() * 0.4, 0.4 + Math.random() * 0.3);
    }
  }
  poof(pos) {
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 4;
      this._emit(pos.x, pos.y + 0.7, pos.z, 1, 1, 1, Math.cos(a) * sp, 1 + Math.random() * 4, Math.sin(a) * sp, 0.6 + Math.random() * 0.5, 0.6 + Math.random() * 0.5);
    }
    this.shake(0.8);
  }
  dust(pos) {
    for (let i = 0; i < 4; i++) {
      const a = Math.random() * Math.PI * 2, sp = 0.4 + Math.random();
      this._emit(pos.x, 0.1, pos.z, 0.8, 0.74, 0.62, Math.cos(a) * sp, 0.5 + Math.random(), Math.sin(a) * sp, 0.4, 0.25);
    }
  }
  noiseRing(pos, strength) {
    const slot = this.rings.find((r) => r.life <= 0); if (!slot) return;
    slot.mesh.visible = true; slot.mesh.position.set(pos.x, 0.06, pos.z);
    slot.mesh.scale.setScalar(0.6); slot.life = 1; slot.max = 1; slot.strength = strength || 1;
    slot.mesh.material.opacity = 0.45 * (strength || 1);
  }
  shake(amount) { this.trauma = Math.min(1, this.trauma + amount); }

  update(dt) {
    for (let i = 0; i < this.MAX; i++) {
      if (this.life[i] <= 0) { this.size[i] = 0; continue; }
      this.life[i] -= dt;
      this.vel[i * 3 + 1] -= 6 * dt; // gravity
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (this.pos[i * 3 + 1] < 0.05) { this.pos[i * 3 + 1] = 0.05; this.vel[i * 3 + 1] *= -0.3; }
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;

    for (const r of this.rings) {
      if (r.life <= 0) { if (r.mesh.visible) r.mesh.visible = false; continue; }
      r.life -= dt * 1.6;
      const t = 1 - r.life;
      r.mesh.scale.setScalar(0.6 + t * 4 * (r.strength || 1));
      r.mesh.material.opacity = Math.max(0, 0.45 * r.life * (r.strength || 1));
      if (r.life <= 0) r.mesh.visible = false;
    }

    // camera shake decay
    this.trauma = Math.max(0, this.trauma - dt * 1.5);
  }

  applyShake(camera) {
    if (this.trauma <= 0) return;
    const s = this.trauma * this.trauma * 0.6;
    camera.position.x += (Math.random() - 0.5) * s;
    camera.position.y += (Math.random() - 0.5) * s;
    camera.rotation.z += (Math.random() - 0.5) * s * 0.05;
  }

  dispose() {
    this.scene.remove(this.points); this.geo.dispose(); this.points.material.map.dispose(); this.points.material.dispose();
    this.rings.forEach((r) => { this.scene.remove(r.mesh); r.mesh.material.dispose(); });
    this._ringGeo.dispose();
  }
}
