/* ===== Meccha Chameleon — Input =====
 * Unifies keyboard, mouse-look (drag-orbit), gamepad and touch (virtual stick +
 * look pad) into one read each frame: a move vector, a look delta, and
 * edge-triggered actions. The game never talks to raw events.
 */
export class Input {
  constructor(el) {
    this.el = el;                       // canvas / interaction surface
    this.move = { x: 0, z: 0 };         // -1..1 ; z<0 = forward
    this.look = { x: 0, y: 0 };         // accumulated, consumed per frame
    this.run = false;
    this._keys = {};
    this._actionCbs = [];
    this._enabled = true;

    // virtual stick (touch / on-screen)
    this.vstick = { active: false, x: 0, z: 0 };
    this.vlook = { x: 0, y: 0 };

    this._gpPrev = {};
    this._bind();
  }

  onAction(cb) { this._actionCbs.push(cb); }
  _fire(a) { this._actionCbs.forEach((c) => c(a)); }
  setEnabled(v) { this._enabled = v; if (!v) { this._keys = {}; this.run = false; } }

  _bind() {
    const keyMap = {
      w: 'up', arrowup: 'up', s: 'down', arrowdown: 'down',
      a: 'left', arrowleft: 'left', d: 'right', arrowright: 'right'
    };
    const actionMap = {
      e: 'eyedrop', f: 'eyedrop', ' ': 'jump', '1': 'pose_stand',
      c: 'pose_crouch', '2': 'pose_crouch', 'control': 'pose_crouch',
      'x': 'pose_curl', '3': 'pose_curl', 'z': 'pose_lie', '4': 'pose_lie',
      'r': 'interact', 'p': 'pause', 'escape': 'pause', 'm': 'mute'
    };

    this._kd = (e) => {
      const ae = document.activeElement;
      if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) return;
      const k = e.key.toLowerCase();
      if (k === 'shift') { this.run = true; return; }
      if (keyMap[k]) { this._keys[keyMap[k]] = true; e.preventDefault(); return; }
      if (!this._enabled) { if (actionMap[k] === 'pause') this._fire('pause'); return; }
      if (actionMap[k]) { e.preventDefault(); if (!e.repeat) this._fire(actionMap[k]); }
    };
    this._ku = (e) => {
      const k = e.key.toLowerCase();
      if (k === 'shift') { this.run = false; return; }
      if (keyMap[k]) { this._keys[keyMap[k]] = false; e.preventDefault(); }
    };
    window.addEventListener('keydown', this._kd, true);
    window.addEventListener('keyup', this._ku, true);

    // --- mouse drag orbit ---
    let dragging = false, px = 0, py = 0;
    this._md = (e) => { if (e.button === 2 || e.button === 0) { dragging = true; px = e.clientX; py = e.clientY; } };
    this._mm = (e) => {
      if (!dragging || !this._enabled) return;
      this.look.x += (e.clientX - px) * 0.005;
      this.look.y += (e.clientY - py) * 0.005;
      px = e.clientX; py = e.clientY;
    };
    this._mu = () => { dragging = false; };
    this._ctx = (e) => e.preventDefault();
    this.el.addEventListener('mousedown', this._md);
    window.addEventListener('mousemove', this._mm);
    window.addEventListener('mouseup', this._mu);
    this.el.addEventListener('contextmenu', this._ctx);

    // --- touch: left half = move stick, right half = look ---
    this._touches = {};
    const half = () => this.el.getBoundingClientRect();
    this._ts = (e) => {
      const r = half();
      for (const t of e.changedTouches) {
        const lx = t.clientX - r.left;
        if (lx < r.width * 0.5) this._touches[t.identifier] = { type: 'move', ox: t.clientX, oy: t.clientY, cx: t.clientX, cy: t.clientY };
        else this._touches[t.identifier] = { type: 'look', ox: t.clientX, oy: t.clientY };
      }
      this._updTouch();
      e.preventDefault();
    };
    this._tm = (e) => {
      for (const t of e.changedTouches) {
        const rec = this._touches[t.identifier]; if (!rec) continue;
        if (rec.type === 'look') {
          this.look.x += (t.clientX - rec.ox) * 0.006;
          this.look.y += (t.clientY - rec.oy) * 0.006;
          rec.ox = t.clientX; rec.oy = t.clientY;
        } else { rec.cx = t.clientX; rec.cy = t.clientY; }
      }
      this._updTouch();
      e.preventDefault();
    };
    this._te = (e) => { for (const t of e.changedTouches) delete this._touches[t.identifier]; this._updTouch(); };
    this.el.addEventListener('touchstart', this._ts, { passive: false });
    this.el.addEventListener('touchmove', this._tm, { passive: false });
    window.addEventListener('touchend', this._te);
    window.addEventListener('touchcancel', this._te);
  }

  _updTouch() {
    let found = false;
    for (const id in this._touches) {
      const rec = this._touches[id];
      if (rec.type === 'move') {
        found = true;
        let dx = rec.cx - rec.ox, dy = rec.cy - rec.oy;
        const max = 52, m = Math.hypot(dx, dy);
        if (m > max) { dx = dx / m * max; dy = dy / m * max; }
        this.vstick.x = dx / max; this.vstick.z = dy / max;
        this.vstick.dx = dx; this.vstick.dy = dy; this.vstick.ox = rec.ox; this.vstick.oy = rec.oy;
      }
    }
    this.vstick.active = found;
    if (!found) { this.vstick.x = 0; this.vstick.z = 0; }
  }

  // called by on-screen / HUD buttons
  press(action) { if (this._enabled || action === 'pause') this._fire(action); }

  _pollGamepad() {
    if (!navigator.getGamepads) return;
    const gps = navigator.getGamepads();
    const gp = gps && (gps[0] || gps[1]);
    if (!gp) return;
    const dz = (v) => Math.abs(v) < 0.18 ? 0 : v;
    // left stick move
    const lx = dz(gp.axes[0] || 0), ly = dz(gp.axes[1] || 0);
    if (lx || ly) { this._gpMove = { x: lx, z: ly }; } else this._gpMove = null;
    // right stick look
    const rx = dz(gp.axes[2] || 0), ry = dz(gp.axes[3] || 0);
    if (this._enabled) { this.look.x += rx * 0.04; this.look.y += ry * 0.04; }
    this.run = (gp.buttons[10] && gp.buttons[10].pressed) || this.run;
    const btn = (i, action) => {
      const p = gp.buttons[i] && gp.buttons[i].pressed;
      if (p && !this._gpPrev[i] && this._enabled) this._fire(action);
      else if (p && !this._gpPrev[i] && action === 'pause') this._fire(action);
      this._gpPrev[i] = p;
    };
    btn(0, 'jump');         // A
    btn(1, 'pose_curl');    // B
    btn(2, 'eyedrop');      // X
    btn(3, 'pose_lie');     // Y
    btn(4, 'pose_crouch');  // LB
    btn(5, 'pose_stand');   // RB
    btn(9, 'pause');        // start
  }

  // Read the resolved move vector for this frame (keyboard|stick|gamepad)
  sample() {
    this._pollGamepad();
    let x = (this._keys.right ? 1 : 0) - (this._keys.left ? 1 : 0);
    let z = (this._keys.down ? 1 : 0) - (this._keys.up ? 1 : 0);
    if (!x && !z && this.vstick.active) { x = this.vstick.x; z = this.vstick.z; }
    if (!x && !z && this._gpMove) { x = this._gpMove.x; z = this._gpMove.z; }
    const m = Math.hypot(x, z);
    if (m > 1) { x /= m; z /= m; }
    this.move.x = x; this.move.z = z;
    const l = { x: this.look.x, y: this.look.y };
    this.look.x = 0; this.look.y = 0;
    return { move: this.move, look: l, mag: Math.min(1, m) };
  }

  dispose() {
    window.removeEventListener('keydown', this._kd, true);
    window.removeEventListener('keyup', this._ku, true);
    this.el.removeEventListener('mousedown', this._md);
    window.removeEventListener('mousemove', this._mm);
    window.removeEventListener('mouseup', this._mu);
    this.el.removeEventListener('contextmenu', this._ctx);
    this.el.removeEventListener('touchstart', this._ts);
    this.el.removeEventListener('touchmove', this._tm);
    window.removeEventListener('touchend', this._te);
    window.removeEventListener('touchcancel', this._te);
  }
}
