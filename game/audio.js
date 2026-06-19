/* ===== Meccha Chameleon — Audio =====
 * Fully synthesised with the WebAudio API — no asset downloads, so it always
 * works in a static build. Ambient pad, footsteps, an absorb "blip", a
 * proximity heartbeat, and round stingers. Lazily resumes on first gesture.
 */
export class Audio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.sfxVol = 0.8;
    this.musicVol = 0.5;
    this._ambient = null;
    this._heartGain = null;
  }

  _ensure() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.enabled = false; return; }
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.enabled ? 1 : 0;
    this.master.connect(this.ctx.destination);
    this.musicBus = this.ctx.createGain(); this.musicBus.gain.value = this.musicVol; this.musicBus.connect(this.master);
    this.sfxBus = this.ctx.createGain(); this.sfxBus.gain.value = this.sfxVol; this.sfxBus.connect(this.master);
  }

  resume() { this._ensure(); if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
  setMuted(m) { this.enabled = !m; if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.05); }
  setSfx(v) { this.sfxVol = v; if (this.sfxBus) this.sfxBus.gain.value = v; }
  setMusic(v) { this.musicVol = v; if (this.musicBus) this.musicBus.gain.value = v; }

  _tone(freq, dur, type, gain, bus, slideTo) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(); o.type = type || 'sine'; o.frequency.value = freq;
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus || this.sfxBus); o.start(t); o.stop(t + dur + 0.02);
  }

  startAmbient(mood) {
    this._ensure(); if (!this.ctx) return;
    this.stopAmbient();
    const base = mood === 'spooky' ? 110 : 146.83;
    const notes = mood === 'spooky' ? [base, base * 1.2, base * 1.5] : [base, base * 1.5, base * 2, base * 2.5];
    const g = this.ctx.createGain(); g.gain.value = 0.0; g.connect(this.musicBus);
    g.gain.setTargetAtTime(0.18, this.ctx.currentTime, 2);
    const oscs = notes.map((f, i) => {
      const o = this.ctx.createOscillator(); o.type = i % 2 ? 'triangle' : 'sine';
      o.frequency.value = f; o.detune.value = (i - 1) * 4;
      const og = this.ctx.createGain(); og.gain.value = 0.25 / notes.length;
      const lfo = this.ctx.createOscillator(); lfo.frequency.value = 0.07 + i * 0.03;
      const lg = this.ctx.createGain(); lg.gain.value = 0.12 / notes.length;
      lfo.connect(lg); lg.connect(og.gain); lfo.start();
      o.connect(og); og.connect(g); o.start();
      return [o, lfo];
    });
    this._ambient = { g, oscs };
  }
  stopAmbient() {
    if (!this._ambient) return;
    const a = this._ambient; this._ambient = null;
    try { a.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.4); } catch (e) {}
    setTimeout(() => a.oscs.forEach((pair) => pair.forEach((o) => { try { o.stop(); } catch (e) {} })), 900);
  }

  footstep() { this._ensure(); this._tone(90 + Math.random() * 30, 0.09, 'triangle', 0.18, this.sfxBus, 60); }
  absorb() { this._ensure(); this._tone(520, 0.16, 'sine', 0.5, this.sfxBus, 1040); this._tone(780, 0.12, 'triangle', 0.2, this.sfxBus, 1560); }
  pose() { this._ensure(); this._tone(300, 0.08, 'sine', 0.25, this.sfxBus, 420); }
  uiClick() { this._ensure(); this._tone(660, 0.05, 'square', 0.12); }

  // proximity heartbeat: call setHeartbeat(0..1) each frame
  setHeartbeat(intensity) {
    this._ensure(); if (!this.ctx) return;
    if (intensity <= 0.01) { this._heartOn = false; return; }
    const now = performance.now();
    const bpm = 60 + intensity * 90;
    const interval = 60000 / bpm;
    if (!this._lastHeart || now - this._lastHeart > interval) {
      this._lastHeart = now;
      this._tone(60, 0.12, 'sine', 0.3 * intensity, this.sfxBus, 40);
      setTimeout(() => this._tone(55, 0.1, 'sine', 0.22 * intensity, this.sfxBus, 38), 140);
    }
  }

  stinger(kind) {
    this._ensure(); if (!this.ctx) return;
    if (kind === 'start') { [392, 523, 659].forEach((f, i) => setTimeout(() => this._tone(f, 0.22, 'triangle', 0.35), i * 90)); }
    else if (kind === 'win') { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this._tone(f, 0.25, 'triangle', 0.35), i * 110)); }
    else if (kind === 'lose') { [392, 330, 262, 196].forEach((f, i) => setTimeout(() => this._tone(f, 0.28, 'sawtooth', 0.28), i * 120)); }
    else if (kind === 'caught') { this._tone(180, 0.4, 'sawtooth', 0.5, this.sfxBus, 60); }
    else if (kind === 'hide') { [330, 440].forEach((f, i) => setTimeout(() => this._tone(f, 0.2, 'sine', 0.3), i * 120)); }
  }

  dispose() { this.stopAmbient(); if (this.ctx) try { this.ctx.close(); } catch (e) {} }
}
