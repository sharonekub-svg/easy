/* ===== Meccha Chameleon — Procedural textures =====
 * Canvas-generated PBR-ish textures so the world has real surface detail (wood
 * grain, marble veins, carpet weave, tiles, wallpaper) with zero asset
 * downloads. Everything is cached and guarded for headless safety — when there
 * is no DOM (tests) the helpers return null and materials fall back to flat
 * colour, so logic stays testable while the browser gets the full look.
 */
import * as THREE from 'three';

const HAS_DOM = typeof document !== 'undefined';
const _cache = new Map();

function make(key, size, draw, repeat) {
  if (!HAS_DOM) return null;
  if (_cache.has(key)) return _cache.get(key);
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  draw(g, size);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  if (repeat) tex.repeat.set(repeat, repeat);
  _cache.set(key, tex);
  return tex;
}
// grayscale clone of a canvas-drawn pattern, usable as bump/roughness
function makeBump(key, size, draw, repeat) {
  if (!HAS_DOM) return null;
  const bk = key + '__b';
  if (_cache.has(bk)) return _cache.get(bk);
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'); draw(g, size);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  if (repeat) tex.repeat.set(repeat, repeat);
  _cache.set(bk, tex);
  return tex;
}

function hex(c) { return '#' + ('000000' + (c >>> 0).toString(16)).slice(-6); }
function jitter(base, amt) {
  const r = (base >> 16 & 255) + (Math.random() * 2 - 1) * amt;
  const g = (base >> 8 & 255) + (Math.random() * 2 - 1) * amt;
  const b = (base & 255) + (Math.random() * 2 - 1) * amt;
  const cl = (v) => Math.max(0, Math.min(255, v | 0));
  return `rgb(${cl(r)},${cl(g)},${cl(b)})`;
}
function noise(g, size, alpha, scale) {
  for (let i = 0; i < size * size * (scale || 0.5); i++) {
    g.fillStyle = `rgba(0,0,0,${Math.random() * alpha})`;
    g.fillRect(Math.random() * size, Math.random() * size, 1, 1);
    g.fillStyle = `rgba(255,255,255,${Math.random() * alpha})`;
    g.fillRect(Math.random() * size, Math.random() * size, 1, 1);
  }
}

// ---------- WOOD PLANKS (floors / furniture) ----------
export function wood(baseColor, planks) {
  const key = 'wood' + baseColor + (planks || 6);
  const n = planks || 6;
  const map = make(key, 512, (g, s) => {
    g.fillStyle = hex(baseColor); g.fillRect(0, 0, s, s);
    const pw = s / n;
    for (let i = 0; i < n; i++) {
      g.fillStyle = jitter(baseColor, 14);
      g.fillRect(i * pw, 0, pw, s);
      // grain streaks
      for (let k = 0; k < 26; k++) {
        g.strokeStyle = `rgba(0,0,0,${0.02 + Math.random() * 0.05})`;
        g.lineWidth = 0.5 + Math.random();
        g.beginPath();
        const x = i * pw + Math.random() * pw;
        g.moveTo(x, 0);
        g.bezierCurveTo(x + (Math.random() - 0.5) * 6, s * 0.33, x + (Math.random() - 0.5) * 6, s * 0.66, x + (Math.random() - 0.5) * 4, s);
        g.stroke();
      }
      // plank gap
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(i * pw, 0, 1.5, s);
    }
    noise(g, s, 0.04);
  });
  return { map, bump: map };
}

// ---------- MARBLE (grand hall landmark) ----------
export function marble(baseColor, veinColor) {
  const key = 'marble' + baseColor + veinColor;
  const map = make(key, 512, (g, s) => {
    g.fillStyle = hex(baseColor); g.fillRect(0, 0, s, s);
    for (let v = 0; v < 18; v++) {
      g.strokeStyle = `rgba(${veinColor >> 16 & 255},${veinColor >> 8 & 255},${veinColor & 255},${0.1 + Math.random() * 0.25})`;
      g.lineWidth = 0.5 + Math.random() * 2.5;
      g.beginPath();
      let x = Math.random() * s, y = 0;
      g.moveTo(x, y);
      while (y < s) { x += (Math.random() - 0.5) * 40; y += 8 + Math.random() * 18; g.lineTo(x, y); }
      g.stroke();
    }
    noise(g, s, 0.03);
  });
  return { map, bump: null };
}

// ---------- TILE (kitchen / bath) ----------
export function tile(baseColor, groutColor, count) {
  const key = 'tile' + baseColor + (count || 4);
  const n = count || 4;
  const map = make(key, 512, (g, s) => {
    g.fillStyle = hex(groutColor); g.fillRect(0, 0, s, s);
    const t = s / n, pad = 3;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      g.fillStyle = jitter(baseColor, 8);
      g.fillRect(x * t + pad, y * t + pad, t - pad * 2, t - pad * 2);
      const grad = g.createLinearGradient(x * t, y * t, x * t, y * t + t);
      grad.addColorStop(0, 'rgba(255,255,255,0.10)'); grad.addColorStop(1, 'rgba(0,0,0,0.06)');
      g.fillStyle = grad; g.fillRect(x * t + pad, y * t + pad, t - pad * 2, t - pad * 2);
    }
  });
  const bump = makeBump('tile' + baseColor + (count || 4), 512, (g, s) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, s, s);
    const t = s / n, pad = 3;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { g.fillStyle = '#fff'; g.fillRect(x * t + pad, y * t + pad, t - pad * 2, t - pad * 2); }
  });
  return { map, bump };
}

// ---------- CARPET / RUG ----------
export function carpet(baseColor) {
  const key = 'carpet' + baseColor;
  const map = make(key, 256, (g, s) => {
    g.fillStyle = hex(baseColor); g.fillRect(0, 0, s, s);
    for (let i = 0; i < s * s * 0.7; i++) {
      g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${Math.random() * 0.05})`;
      g.fillRect(Math.random() * s, Math.random() * s, 1.3, 1.3);
    }
    // soft mottling
    for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.04})`; g.beginPath(); g.arc(Math.random() * s, Math.random() * s, 10 + Math.random() * 30, 0, 7); g.fill(); }
  });
  return { map, bump: map };
}

// ---------- WALLPAPER / PLASTER ----------
export function wallpaper(baseColor, stripe) {
  const key = 'wall' + baseColor + (stripe ? 1 : 0);
  const map = make(key, 256, (g, s) => {
    g.fillStyle = hex(baseColor); g.fillRect(0, 0, s, s);
    if (stripe) {
      for (let x = 0; x < s; x += 22) { g.fillStyle = 'rgba(0,0,0,0.04)'; g.fillRect(x, 0, 11, s); }
    }
    // damask-ish dots
    for (let y = 16; y < s; y += 40) for (let x = (y / 40 % 2) * 20; x < s; x += 40) {
      g.fillStyle = 'rgba(255,255,255,0.05)'; g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill();
    }
    noise(g, s, 0.025);
  });
  return { map, bump: null };
}

// ---------- GRASS (garden) ----------
export function grass(baseColor) {
  const key = 'grass' + baseColor;
  const map = make(key, 256, (g, s) => {
    g.fillStyle = hex(baseColor); g.fillRect(0, 0, s, s);
    for (let i = 0; i < s * s * 0.9; i++) {
      const dark = Math.random() < 0.5;
      g.fillStyle = `rgba(${dark ? '20,60,20' : '120,200,90'},${Math.random() * 0.18})`;
      g.fillRect(Math.random() * s, Math.random() * s, 1, 2 + Math.random() * 2);
    }
  }, 1);
  return { map, bump: map };
}

// apply a {map,bump} pack to a material with sensible repeat
export function applyTex(mat, pack, repeat, bumpScale) {
  if (!pack || !pack.map) return mat;
  mat.map = pack.map;
  if (pack.bump) { mat.bumpMap = pack.bump; mat.bumpScale = bumpScale == null ? 0.04 : bumpScale; }
  if (repeat) { mat.map.repeat.set(repeat, repeat); if (mat.bumpMap) mat.bumpMap.repeat.set(repeat, repeat); }
  mat.needsUpdate = true;
  return mat;
}

export function clearCache() { _cache.clear(); }
