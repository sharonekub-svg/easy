/* ===== Meccha Chameleon — UI =====
 * One owner for all DOM: menus (main / mode / map), the in-game HUD (phase +
 * timers, camo meter with HIDDEN/SUSPICIOUS/SPOTTED, hunter direction arrow,
 * mini-map, crosshair), real colour tools (HSV wheel + brightness + swatch +
 * eyedropper), pose buttons, non-blocking hint popups, the results screen,
 * pause + settings, and mobile touch controls. Styles are injected once.
 */
import { MAPS } from './maps.js';

const ICONS = {
  classic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  infection: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v3M12 20v3M1 12h3M20 12h3M4.5 4.5l2 2M17.5 17.5l2 2M19.5 4.5l-2 2M6.5 17.5l-2 2"/></svg>',
  double: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.6-6.3"/><path d="M21 3v5h-5"/></svg>',
  house: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/></svg>',
  coin: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="9" opacity="0.25"/><circle cx="12" cy="12" r="6"/></svg>',
  dropper: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v8"/><circle cx="12" cy="15" r="4"/></svg>'
};

const MODES = [
  { id: 'classic', name: 'Classic', desc: 'One hunter, many hiders. Survive the hunt.', icon: ICONS.classic },
  { id: 'infection', name: 'Infection', desc: 'Caught hiders join the hunters. Be the last.', icon: ICONS.infection },
  { id: 'double', name: 'Double', desc: 'Everyone hides, then everyone hunts.', icon: ICONS.double }
];

function hsvToRgb(h, s, v) {
  let r, g, b; const i = Math.floor(h * 6); const f = h * 6 - i;
  const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  switch (i % 6) { case 0: r = v; g = t; b = p; break; case 1: r = q; g = v; b = p; break; case 2: r = p; g = v; b = t; break; case 3: r = p; g = q; b = v; break; case 4: r = t; g = p; b = v; break; default: r = v; g = p; b = q; }
  return { r, g, b };
}
function rgbToHex(c) { const f = (x) => ('0' + Math.round(x * 255).toString(16)).slice(-2); return '#' + f(c.r) + f(c.g) + f(c.b); }

const CSS = `
.mc-root{position:absolute;inset:0;font-family:'Space Grotesk',system-ui,sans-serif;color:#fff;z-index:6;pointer-events:none;overflow:hidden;}
.mc-root *{box-sizing:border-box;}
.mc-mono{font-family:'Martian Mono',monospace;}
.mc-screen{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;pointer-events:auto;background:radial-gradient(circle at 50% 30%,rgba(40,30,50,.6),rgba(10,8,14,.92));backdrop-filter:blur(3px);opacity:0;transition:opacity .35s;}
.mc-screen.show{opacity:1;}
.mc-screen.hide{display:none;}
.mc-logo{font-family:'Martian Mono';font-weight:800;font-size:clamp(30px,6vw,58px);letter-spacing:1px;background:linear-gradient(90deg,#7ee08a,#43c0d8,#e0739a);-webkit-background-clip:text;background-clip:text;color:transparent;text-shadow:0 0 40px rgba(126,224,138,.25);}
.mc-tag{font-family:'Martian Mono';font-size:11px;letter-spacing:3px;color:rgba(255,255,255,.55);margin-top:-8px;}
.mc-btn{font-family:'Martian Mono';font-weight:700;font-size:13px;letter-spacing:1px;border:none;border-radius:12px;padding:14px 30px;cursor:pointer;color:#0c0a10;background:linear-gradient(90deg,#7ee08a,#43c0d8);box-shadow:0 8px 24px rgba(67,192,216,.3);transition:transform .15s,box-shadow .15s;pointer-events:auto;}
.mc-btn:hover{transform:translateY(-2px);box-shadow:0 12px 30px rgba(67,192,216,.45);}
.mc-btn.ghost{background:rgba(255,255,255,.08);color:#fff;border:1px solid rgba(255,255,255,.18);box-shadow:none;}
.mc-cards{display:flex;gap:16px;flex-wrap:wrap;justify-content:center;max-width:760px;}
.mc-card{width:210px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:20px;cursor:pointer;transition:transform .2s,border-color .2s,background .2s;text-align:left;}
.mc-card:hover{transform:translateY(-4px);border-color:rgba(126,224,138,.6);background:rgba(126,224,138,.08);}
.mc-card .ic{width:36px;height:36px;color:#7ee08a;}
.mc-card .ic svg{width:100%;height:100%;}
.mc-eye-ic{display:inline-flex;width:13px;height:13px;vertical-align:-2px;margin-right:5px;}
.mc-eye-ic svg{width:100%;height:100%;}
.mc-card h3{margin:8px 0 4px;font-family:'Martian Mono';font-size:16px;}
.mc-card p{margin:0;font-size:12.5px;color:rgba(255,255,255,.6);line-height:1.45;}
.mc-card .mood{margin-top:10px;font-family:'Martian Mono';font-size:10px;letter-spacing:1px;color:#7ee08a;}
.mc-row{display:flex;gap:12px;align-items:center;}
.mc-back{position:absolute;top:18px;left:18px;}
.mc-h2{font-family:'Martian Mono';font-weight:700;font-size:20px;letter-spacing:1px;}
.mc-sub{font-size:13px;color:rgba(255,255,255,.55);margin-top:-10px;}

/* ---- HUD ---- */
.mc-hud{position:absolute;inset:0;pointer-events:none;opacity:0;visibility:hidden;transition:opacity .3s;}
.mc-hud.show{opacity:1;visibility:visible;}
.mc-top{position:absolute;top:12px;left:50%;transform:translateX(-50%);display:flex;gap:10px;align-items:center;}
.mc-pill{font-family:'Martian Mono';font-size:11px;font-weight:700;letter-spacing:1px;background:rgba(12,10,16,.6);border:1px solid rgba(255,255,255,.14);border-radius:999px;padding:7px 14px;display:flex;gap:7px;align-items:center;}
.mc-pill .v{color:#7ee08a;}
.mc-pill.timer .v{color:#ffd98a;font-variant-numeric:tabular-nums;}
.mc-phase{color:#43c0d8;}
.mc-camo{position:absolute;top:54px;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:5px;width:220px;}
.mc-camo-lbl{font-family:'Martian Mono';font-size:11px;font-weight:800;letter-spacing:2px;text-shadow:0 1px 4px rgba(0,0,0,.6);}
.mc-camo-track{width:100%;height:9px;background:rgba(0,0,0,.4);border:1px solid rgba(255,255,255,.3);border-radius:999px;overflow:hidden;}
.mc-camo-fill{height:100%;width:0;background:#2ec4a6;transition:width .12s,background .25s;}
.mc-coin{display:inline-flex;width:13px;height:13px;color:#ffd06a;}
.mc-coin svg{width:100%;height:100%;}
.mc-arrow{position:absolute;top:50%;left:50%;width:120px;height:120px;margin:-60px 0 0 -60px;pointer-events:none;transition:opacity .2s;opacity:0;}
.mc-arrow svg{width:100%;height:100%;}
.mc-mini{position:absolute;top:14px;right:14px;width:128px;height:128px;border-radius:12px;border:1px solid rgba(255,255,255,.18);background:rgba(12,10,16,.55);overflow:hidden;}
.mc-mini canvas{width:100%;height:100%;}
.mc-cross{position:absolute;top:50%;left:50%;width:26px;height:26px;margin:-13px 0 0 -13px;pointer-events:none;opacity:0;transition:opacity .15s;}
.mc-cross::before,.mc-cross::after{content:'';position:absolute;background:rgba(255,255,255,.85);box-shadow:0 0 3px rgba(0,0,0,.7);}
.mc-cross::before{left:50%;top:0;width:2px;height:100%;margin-left:-1px;}
.mc-cross::after{top:50%;left:0;height:2px;width:100%;margin-top:-1px;}
.mc-cross.on{opacity:1;}

/* colour tools */
.mc-tools{position:absolute;bottom:16px;left:16px;display:flex;gap:12px;align-items:flex-end;pointer-events:auto;}
.mc-wheelwrap{position:relative;width:110px;height:110px;}
.mc-wheel{width:110px;height:110px;border-radius:50%;cursor:crosshair;box-shadow:0 6px 18px rgba(0,0,0,.5);touch-action:none;}
.mc-wheel-mark{position:absolute;width:12px;height:12px;border:2px solid #fff;border-radius:50%;margin:-6px 0 0 -6px;pointer-events:none;box-shadow:0 0 4px rgba(0,0,0,.8);}
.mc-bright{-webkit-appearance:none;appearance:none;width:14px;height:110px;writing-mode:vertical-lr;direction:rtl;border-radius:8px;background:linear-gradient(to top,#000,#fff);cursor:pointer;}
.mc-bright::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:8px;border-radius:3px;background:#fff;border:1px solid #333;}
.mc-colcol{display:flex;flex-direction:column;gap:7px;align-items:center;}
.mc-swatch{width:40px;height:40px;border-radius:10px;border:2px solid rgba(255,255,255,.5);box-shadow:0 3px 10px rgba(0,0,0,.5);}
.mc-eye{font-family:'Martian Mono';font-size:10px;font-weight:700;letter-spacing:.5px;border:1px solid rgba(255,255,255,.25);background:rgba(12,10,16,.6);color:#fff;border-radius:8px;padding:6px 8px;cursor:pointer;pointer-events:auto;white-space:nowrap;}
.mc-eye.armed{background:#7ee08a;color:#0c0a10;border-color:#7ee08a;}

/* poses */
.mc-poses{position:absolute;bottom:16px;left:50%;transform:translateX(-50%);display:flex;gap:8px;pointer-events:auto;}
.mc-pose{font-family:'Martian Mono';font-size:10px;font-weight:700;letter-spacing:.5px;border:1px solid rgba(255,255,255,.2);background:rgba(12,10,16,.6);color:#fff;border-radius:10px;padding:8px 10px;min-width:54px;cursor:pointer;pointer-events:auto;transition:background .15s,transform .1s;text-align:center;}
.mc-pose .k{display:block;font-size:8px;color:rgba(255,255,255,.45);}
.mc-pose.active{background:#43c0d8;color:#0c0a10;border-color:#43c0d8;}

/* hints */
.mc-hints{position:absolute;bottom:84px;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none;max-width:80%;}
.mc-hint{font-family:'Martian Mono';font-size:12px;background:rgba(12,10,16,.82);border:1px solid rgba(126,224,138,.5);border-radius:10px;padding:9px 16px;box-shadow:0 6px 20px rgba(0,0,0,.5);opacity:0;transform:translateY(8px);transition:opacity .3s,transform .3s;text-align:center;}
.mc-hint.show{opacity:1;transform:translateY(0);}

/* mobile controls */
.mc-touch{position:absolute;inset:0;pointer-events:none;display:none;}
.mc-touch.on{display:block;}
.mc-stick{position:absolute;bottom:26px;left:26px;width:120px;height:120px;border-radius:50%;border:2px solid rgba(255,255,255,.18);background:rgba(255,255,255,.05);}
.mc-stick .nub{position:absolute;top:50%;left:50%;width:50px;height:50px;margin:-25px 0 0 -25px;border-radius:50%;background:rgba(255,255,255,.35);transition:transform .04s;}

/* results */
.mc-result-stats{display:flex;gap:26px;margin:6px 0 8px;}
.mc-rstat{text-align:center;}
.mc-rstat .n{font-family:'Martian Mono';font-weight:800;font-size:30px;color:#7ee08a;}
.mc-rstat .l{font-family:'Martian Mono';font-size:10px;letter-spacing:1px;color:rgba(255,255,255,.5);}
.mc-settings{display:flex;flex-direction:column;gap:14px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:22px 26px;min-width:300px;}
.mc-set-row{display:flex;justify-content:space-between;align-items:center;gap:18px;font-size:13px;}
.mc-seg{display:flex;border:1px solid rgba(255,255,255,.16);border-radius:8px;overflow:hidden;}
.mc-seg button{font-family:'Martian Mono';font-size:11px;background:transparent;color:rgba(255,255,255,.6);border:none;padding:6px 12px;cursor:pointer;}
.mc-seg button.active{background:#43c0d8;color:#0c0a10;}
.mc-slider{width:130px;}
.mc-spinner{width:54px;height:54px;border-radius:50%;border:4px solid rgba(255,255,255,.12);border-top-color:#7ee08a;border-right-color:#43c0d8;animation:mc-spin .8s linear infinite;}
@keyframes mc-spin{to{transform:rotate(360deg);}}
`;

export class UI {
  constructor(root, cb) {
    this.cb = cb || {};
    if (!document.getElementById('mc-ui-style')) {
      const st = document.createElement('style'); st.id = 'mc-ui-style'; st.textContent = CSS; document.head.appendChild(st);
    }
    this.root = document.createElement('div'); this.root.className = 'mc-root';
    root.appendChild(this.root);
    this.isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || matchMedia('(pointer:coarse)').matches;
    this.hsv = { h: 0.33, s: 0.5, v: 0.8 };
    this._build();
    // delegated hover SFX for interactive elements
    this.root.addEventListener('mouseover', (e) => {
      const t = e.target.closest && e.target.closest('.mc-btn,.mc-card,.mc-pose,.mc-eye');
      if (t && t !== this._lastHover) { this._lastHover = t; this.cb.hover && this.cb.hover(); }
    });
    this.root.addEventListener('mouseout', () => { this._lastHover = null; });
  }

  _el(cls, html) { const d = document.createElement('div'); if (cls) d.className = cls; if (html != null) d.innerHTML = html; return d; }

  _build() {
    this._buildMenu();
    this._buildMode();
    this._buildMap();
    this._buildLoading();
    this._buildHUD();
    this._buildResults();
    this._buildPause();
    this.showScreen('menu');
  }

  _buildLoading() {
    const s = this._el('mc-screen hide', '');
    s.appendChild(this._el('mc-spinner', ''));
    this.loadingTxt = this._el('mc-tag', 'PREPARING THE MAP…');
    s.appendChild(this.loadingTxt);
    this.loadingEl = s; this.root.appendChild(s);
  }
  showLoading(label) { if (label) this.loadingTxt.textContent = label; this.showScreen('loading'); }

  _buildMenu() {
    const s = this._el('mc-screen', '');
    s.appendChild(this._el('mc-logo', 'MECCHA CHAMELEON'));
    s.appendChild(this._el('mc-tag', 'BLEND IN · STAY STILL · VANISH'));
    const play = document.createElement('button'); play.className = 'mc-btn'; play.textContent = '▶  PLAY';
    play.onclick = () => { this.cb.click && this.cb.click(); this.showScreen('mode'); };
    s.appendChild(play);
    const tut = document.createElement('button'); tut.className = 'mc-btn ghost'; tut.textContent = 'HOW TO PLAY';
    tut.onclick = () => { this.cb.click && this.cb.click(); this.cb.start && this.cb.start('classic', 'mansion', true); };
    s.appendChild(tut);
    this.menuEl = s; this.root.appendChild(s);
  }

  _buildMode() {
    const s = this._el('mc-screen hide', '');
    s.appendChild(this._el('mc-h2', 'SELECT MODE'));
    s.appendChild(this._el('mc-sub', 'How do you want to play?'));
    const cards = this._el('mc-cards', '');
    MODES.forEach((m) => {
      const c = this._el('mc-card', `<div class="ic">${m.icon}</div><h3>${m.name}</h3><p>${m.desc}</p>`);
      c.onclick = () => { this.cb.click && this.cb.click(); this._mode = m.id; this.showScreen('map'); };
      cards.appendChild(c);
    });
    s.appendChild(cards);
    const back = document.createElement('button'); back.className = 'mc-btn ghost mc-back'; back.textContent = '‹ Back';
    back.onclick = () => this.showScreen('menu'); s.appendChild(back);
    this.modeEl = s; this.root.appendChild(s);
  }

  _buildMap() {
    const s = this._el('mc-screen hide', '');
    s.appendChild(this._el('mc-h2', 'SELECT MAP'));
    s.appendChild(this._el('mc-sub', 'Pick your hiding ground.'));
    const cards = this._el('mc-cards', '');
    MAPS.forEach((m) => {
      const c = this._el('mc-card', `<div class="ic">${ICONS.house}</div><h3>${m.name}</h3><p>${m.mood}</p><div class="mood" style="color:${m.accent}">${m.mood.toUpperCase()}</div>`);
      c.onclick = () => { this.cb.click && this.cb.click(); this.cb.start && this.cb.start(this._mode || 'classic', m.id, false); };
      cards.appendChild(c);
    });
    s.appendChild(cards);
    const back = document.createElement('button'); back.className = 'mc-btn ghost mc-back'; back.textContent = '‹ Back';
    back.onclick = () => this.showScreen('mode'); s.appendChild(back);
    this.mapEl = s; this.root.appendChild(s);
  }

  _buildHUD() {
    const h = this._el('mc-hud', '');
    // top pills
    const top = this._el('mc-top', '');
    this.phaseEl = this._el('mc-pill', '<span class="mc-phase">HIDE</span>');
    this.timerEl = this._el('mc-pill timer', 'TIME <span class="v">0:20</span>');
    this.coinEl = this._el('mc-pill', '<span class="mc-coin">' + ICONS.coin + '</span><span class="v">0</span>');
    this.bestEl = this._el('mc-pill', 'BEST <span class="v">0s</span>');
    top.append(this.phaseEl, this.timerEl, this.coinEl, this.bestEl);
    h.appendChild(top);

    // camo meter
    const camo = this._el('mc-camo', '<div class="mc-camo-lbl" id="mc-camo-lbl">HIDDEN</div><div class="mc-camo-track"><div class="mc-camo-fill" id="mc-camo-fill"></div></div>');
    h.appendChild(camo);

    // hunter arrow
    this.arrowEl = this._el('mc-arrow', `<svg viewBox="0 0 100 100"><defs><filter id="gl"><feGaussianBlur stdDeviation="1.5"/></filter></defs><path d="M50 4 L60 22 L50 16 L40 22 Z" fill="#e8483b" filter="url(#gl)"/></svg>`);
    h.appendChild(this.arrowEl);

    // minimap
    this.miniEl = this._el('mc-mini', '<canvas></canvas>');
    this.miniCv = this.miniEl.querySelector('canvas'); this.miniCv.width = 128; this.miniCv.height = 128;
    this.miniCtx = this.miniCv.getContext('2d');
    h.appendChild(this.miniEl);

    // crosshair
    this.crossEl = this._el('mc-cross', ''); h.appendChild(this.crossEl);

    // colour tools
    const tools = this._el('mc-tools', '');
    const wheelWrap = this._el('mc-wheelwrap', '');
    this.wheel = document.createElement('canvas'); this.wheel.className = 'mc-wheel'; this.wheel.width = this.wheel.height = 220;
    this.wheelMark = this._el('mc-wheel-mark', '');
    wheelWrap.append(this.wheel, this.wheelMark);
    this.bright = document.createElement('input'); this.bright.type = 'range'; this.bright.min = 0; this.bright.max = 100; this.bright.value = 80; this.bright.className = 'mc-bright';
    const colcol = this._el('mc-colcol', '');
    this.swatch = this._el('mc-swatch', '');
    this.eyeBtn = document.createElement('button'); this.eyeBtn.className = 'mc-eye'; this.eyeBtn.innerHTML = '<span class="mc-eye-ic">' + ICONS.dropper + '</span>EYEDROP · E';
    colcol.append(this.swatch, this.eyeBtn);
    tools.append(wheelWrap, this.bright, colcol);
    h.appendChild(tools);
    this._drawWheel(); this._wireColor();

    // poses
    const poses = this._el('mc-poses', '');
    const POSES = [['stand', 'STAND', '1'], ['crouch', 'CROUCH', 'C'], ['curl', 'CURL', 'X'], ['lie', 'LIE FLAT', 'Z']];
    this.poseBtns = {};
    POSES.forEach((p) => {
      const b = document.createElement('button'); b.className = 'mc-pose' + (p[0] === 'stand' ? ' active' : '');
      b.innerHTML = p[1] + '<span class="k">' + p[2] + '</span>';
      b.onclick = () => { this.cb.pose && this.cb.pose(p[0]); };
      poses.appendChild(b); this.poseBtns[p[0]] = b;
    });
    h.appendChild(poses);

    // hints
    this.hintsEl = this._el('mc-hints', ''); h.appendChild(this.hintsEl);

    // touch controls
    this.touchEl = this._el('mc-touch' + (this.isTouch ? ' on' : ''), '');
    this.stickEl = this._el('mc-stick', '<div class="nub"></div>'); this.stickNub = this.stickEl.querySelector('.nub');
    this.touchEl.appendChild(this.stickEl);
    h.appendChild(this.touchEl);

    this.eyeBtn.onclick = () => { this.cb.eyedrop && this.cb.eyedrop(); };

    this.hudEl = h; this.root.appendChild(h);
  }

  _drawWheel() {
    const c = this.wheel, g = c.getContext('2d'), R = c.width / 2;
    const img = g.createImageData(c.width, c.height);
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
      const dx = x - R, dy = y - R, r = Math.hypot(dx, dy);
      const i = (y * c.width + x) * 4;
      if (r > R) { img.data[i + 3] = 0; continue; }
      const h = (Math.atan2(dy, dx) / (Math.PI * 2) + 1) % 1;
      const s = Math.min(1, r / R);
      const rgb = hsvToRgb(h, s, this.hsv.v);
      img.data[i] = rgb.r * 255; img.data[i + 1] = rgb.g * 255; img.data[i + 2] = rgb.b * 255; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    this._placeMark();
  }
  _placeMark() {
    const R = 55; const a = this.hsv.h * Math.PI * 2; const r = this.hsv.s * R;
    this.wheelMark.style.left = (55 + Math.cos(a) * r) + 'px';
    this.wheelMark.style.top = (55 + Math.sin(a) * r) + 'px';
  }
  _emitColor() {
    const rgb = hsvToRgb(this.hsv.h, this.hsv.s, this.hsv.v);
    this.setSwatch(rgb);
    this.cb.setColor && this.cb.setColor(rgb);
  }
  _wireColor() {
    const pick = (e) => {
      const r = this.wheel.getBoundingClientRect();
      const px = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
      const py = (e.touches ? e.touches[0].clientY : e.clientY) - r.top;
      const dx = px - r.width / 2, dy = py - r.height / 2;
      const R = r.width / 2;
      this.hsv.h = (Math.atan2(dy, dx) / (Math.PI * 2) + 1) % 1;
      this.hsv.s = Math.min(1, Math.hypot(dx, dy) / R);
      this._placeMark(); this._emitColor();
    };
    let down = false;
    this.wheel.addEventListener('pointerdown', (e) => { down = true; this.wheel.setPointerCapture(e.pointerId); pick(e); });
    this.wheel.addEventListener('pointermove', (e) => { if (down) pick(e); });
    this.wheel.addEventListener('pointerup', () => { down = false; });
    this.bright.addEventListener('input', () => { this.hsv.v = this.bright.value / 100; this._drawWheel(); this._emitColor(); });
  }

  // called when the eyedropper/AI sets a colour, to reflect it in tools
  syncColor(rgb) {
    // convert rgb->hsv
    const max = Math.max(rgb.r, rgb.g, rgb.b), min = Math.min(rgb.r, rgb.g, rgb.b), d = max - min;
    let h = 0; if (d) { if (max === rgb.r) h = ((rgb.g - rgb.b) / d) % 6; else if (max === rgb.g) h = (rgb.b - rgb.r) / d + 2; else h = (rgb.r - rgb.g) / d + 4; h /= 6; if (h < 0) h += 1; }
    this.hsv.h = h; this.hsv.s = max ? d / max : 0; this.hsv.v = max;
    this.bright.value = Math.round(max * 100); this._drawWheel(); this.setSwatch(rgb);
  }
  setSwatch(rgb) { this.swatch.style.background = rgbToHex(rgb); }
  armEyedrop(on) { this.eyeBtn.classList.toggle('armed', on); this.crossEl.classList.toggle('on', on); }

  // ---- HUD updates ----
  setPhase(text, color) { this.phaseEl.innerHTML = `<span class="mc-phase" style="color:${color || '#43c0d8'}">${text}</span>`; }
  setTimer(sec) { const m = Math.floor(sec / 60), s = Math.floor(sec % 60); this.timerEl.querySelector('.v').textContent = m + ':' + ('0' + s).slice(-2); }
  setCoins(n) { this.coinEl.querySelector('.v').textContent = n; }
  setBest(s) { this.bestEl.querySelector('.v').textContent = Math.floor(s) + 's'; }
  setActivePose(name) { for (const k in this.poseBtns) this.poseBtns[k].classList.toggle('active', k === name); }

  setCamo(state, value) {
    const fill = document.getElementById('mc-camo-fill'), lbl = document.getElementById('mc-camo-lbl');
    if (!fill) return;
    fill.style.width = Math.round(value * 100) + '%';
    const map = { HIDDEN: ['#2ec4a6', '#bff5e8'], SUSPICIOUS: ['#ffc23c', '#ffe9b0'], SPOTTED: ['#e8483b', '#ffb0a8'] };
    const c = map[state] || map.HIDDEN;
    fill.style.background = c[0]; lbl.textContent = state; lbl.style.color = c[1];
  }
  setHunterArrow(angle, intensity) {
    if (intensity <= 0.02) { this.arrowEl.style.opacity = 0; return; }
    this.arrowEl.style.opacity = Math.min(1, intensity);
    this.arrowEl.style.transform = `rotate(${angle}rad)`;
  }

  drawMinimap(data) {
    const g = this.miniCtx, W = 128, H = 128; g.clearRect(0, 0, W, H);
    const b = data.bounds, sx = W / (b.maxX - b.minX), sz = H / (b.maxZ - b.minZ);
    const px = (x) => (x - b.minX) * sx, pz = (z) => (z - b.minZ) * sz;
    g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(0, 0, W, H);
    // hiders
    g.fillStyle = '#7ee08a';
    data.hiders.forEach((p) => { g.beginPath(); g.arc(px(p.x), pz(p.z), 2.4, 0, 7); g.fill(); });
    // hunters
    g.fillStyle = '#e8483b';
    data.hunters.forEach((p) => { g.beginPath(); g.arc(px(p.x), pz(p.z), 3.2, 0, 7); g.fill(); });
    // player
    g.fillStyle = '#43c0d8'; g.strokeStyle = '#fff'; g.lineWidth = 1.5;
    g.beginPath(); g.arc(px(data.player.x), pz(data.player.z), 3.4, 0, 7); g.fill(); g.stroke();
  }

  showHint(text, dur) {
    const h = this._el('mc-hint', text); this.hintsEl.appendChild(h);
    requestAnimationFrame(() => h.classList.add('show'));
    setTimeout(() => { h.classList.remove('show'); setTimeout(() => h.remove(), 350); }, dur || 3500);
  }
  clearHints() { this.hintsEl.innerHTML = ''; }

  // ---- results ----
  _buildResults() {
    const s = this._el('mc-screen hide', '');
    this.resultTitle = this._el('mc-logo', 'ROUND OVER'); this.resultTitle.style.fontSize = 'clamp(26px,5vw,46px)';
    s.appendChild(this.resultTitle);
    this.resultSub = this._el('mc-tag', ''); s.appendChild(this.resultSub);
    this.resultStats = this._el('mc-result-stats', ''); s.appendChild(this.resultStats);
    const row = this._el('mc-row', '');
    const again = document.createElement('button'); again.className = 'mc-btn'; again.textContent = '↻ PLAY AGAIN';
    again.onclick = () => { this.cb.click && this.cb.click(); this.cb.again && this.cb.again(); };
    const menu = document.createElement('button'); menu.className = 'mc-btn ghost'; menu.textContent = 'MENU';
    menu.onclick = () => { this.cb.click && this.cb.click(); this.cb.menu && this.cb.menu(); };
    row.append(again, menu); s.appendChild(row);
    this.resultsEl = s; this.root.appendChild(s);
  }
  showResults(data) {
    this.resultTitle.textContent = data.win ? 'YOU SURVIVED!' : (data.title || 'CAUGHT!');
    this.resultTitle.style.background = data.win ? 'linear-gradient(90deg,#7ee08a,#43c0d8)' : 'linear-gradient(90deg,#e8483b,#ff8a3d)';
    this.resultTitle.style.webkitBackgroundClip = 'text'; this.resultTitle.style.backgroundClip = 'text';
    this.resultSub.textContent = data.subtitle || '';
    this.resultStats.innerHTML = '';
    [['SURVIVED', Math.floor(data.survived) + 's'], ['COINS', data.coins], ['BEST', Math.floor(data.best) + 's']].forEach((st) => {
      this.resultStats.appendChild(this._el('mc-rstat', `<div class="n">${st[1]}</div><div class="l">${st[0]}</div>`));
    });
    this.showScreen('results');
  }

  // ---- pause / settings ----
  _buildPause() {
    const s = this._el('mc-screen hide', '');
    s.appendChild(this._el('mc-h2', 'PAUSED'));
    const set = this._el('mc-settings', '');
    const seg = (label, opts, current, onPick) => {
      const row = this._el('mc-set-row', `<span>${label}</span>`);
      const segEl = this._el('mc-seg', '');
      opts.forEach((o) => { const btn = document.createElement('button'); btn.textContent = o.label; if (o.val === current) btn.classList.add('active'); btn.onclick = () => { segEl.querySelectorAll('button').forEach((x) => x.classList.remove('active')); btn.classList.add('active'); onPick(o.val); }; segEl.appendChild(btn); });
      row.appendChild(segEl); return row;
    };
    set.appendChild(seg('Quality', [{ label: 'Low', val: 'low' }, { label: 'Med', val: 'medium' }, { label: 'High', val: 'high' }], 'high', (v) => this.cb.setting && this.cb.setting('quality', v)));
    set.appendChild(seg('Sound', [{ label: 'On', val: false }, { label: 'Mute', val: true }], false, (v) => this.cb.setting && this.cb.setting('mute', v)));
    // sfx volume
    const sfxRow = this._el('mc-set-row', '<span>SFX volume</span>');
    const sfx = document.createElement('input'); sfx.type = 'range'; sfx.min = 0; sfx.max = 100; sfx.value = 80; sfx.className = 'mc-slider';
    sfx.oninput = () => this.cb.setting && this.cb.setting('sfx', sfx.value / 100);
    sfxRow.appendChild(sfx); set.appendChild(sfxRow);
    s.appendChild(set);
    const row = this._el('mc-row', '');
    const resume = document.createElement('button'); resume.className = 'mc-btn'; resume.textContent = '▶ RESUME';
    resume.onclick = () => { this.cb.resume && this.cb.resume(); };
    const quit = document.createElement('button'); quit.className = 'mc-btn ghost'; quit.textContent = 'QUIT TO MENU';
    quit.onclick = () => { this.cb.menu && this.cb.menu(); };
    row.append(resume, quit); s.appendChild(row);
    this.pauseEl = s; this.root.appendChild(s);
  }

  showScreen(name) {
    const map = { menu: this.menuEl, mode: this.modeEl, map: this.mapEl, results: this.resultsEl, pause: this.pauseEl, loading: this.loadingEl };
    Object.keys(map).forEach((k) => {
      const el = map[k]; if (!el) return;
      if (k === name) { el.classList.remove('hide'); requestAnimationFrame(() => el.classList.add('show')); }
      else { el.classList.remove('show'); el.classList.add('hide'); }
    });
    const inGame = (name === 'hud' || name === 'pause');
    this.hudEl.classList.toggle('show', name === 'hud' || name === 'pause');
    this.current = name;
  }

  dispose() { if (this.root.parentElement) this.root.parentElement.removeChild(this.root); }
}
