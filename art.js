/* ===== EZ — game art =====
 * Procedural neon scenes, one per genre, drawn on a 2D canvas. Used for the
 * gallery thumbnails so you can see what each generated game looks like.
 * Palette: #000 bg, #CB2957 accent, #DDD/#EEE highlights.
 */
(function (root) {
  'use strict';

  var ACCENT = '#CB2957';
  var INK = '#DDDDDD';

  // Deterministic PRNG so each card looks distinct but stable.
  function rng(seed) {
    var s = seed >>> 0 || 1;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }

  function glow(ctx, blur, color) { ctx.shadowColor = color || ACCENT; ctx.shadowBlur = blur; }
  function noGlow(ctx) { ctx.shadowBlur = 0; }

  function bg(ctx, w, h) {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
    var grd = ctx.createRadialGradient(w / 2, h * 0.35, 0, w / 2, h * 0.35, w * 0.8);
    grd.addColorStop(0, 'rgba(203,41,87,0.16)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, w, h);
  }

  function gridFloor(ctx, w, h, t) {
    ctx.strokeStyle = 'rgba(238,238,238,0.06)'; ctx.lineWidth = 1;
    var step = Math.max(16, w / 12);
    ctx.beginPath();
    for (var x = 0; x <= w; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
    for (var y = 0; y <= h; y += step) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
    ctx.stroke();
  }

  function stars(ctx, w, h, t, rnd, n) {
    for (var i = 0; i < n; i++) {
      var x = rnd() * w;
      var y = (rnd() * h + t * (20 + rnd() * 40)) % h;
      var s = rnd() < 0.2 ? 2 : 1;
      ctx.fillStyle = rnd() < 0.3 ? 'rgba(203,41,87,0.8)' : 'rgba(238,238,238,0.5)';
      ctx.fillRect(x, y, s, s);
    }
  }

  function block(ctx, x, y, w, h, color, blur) {
    ctx.save(); glow(ctx, blur || 12, color); ctx.fillStyle = color;
    var r = Math.min(5, w / 4);
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // ---- genres ----
  var ART = {
    snake: function (ctx, w, h, t, seed) {
      bg(ctx, w, h); gridFloor(ctx, w, h, t);
      var cell = Math.max(12, w / 14);
      var n = 7, cx = Math.floor(w / cell / 2), cy = Math.floor(h / cell / 2);
      var head = (Math.floor(t * 3) % (cx + 4));
      for (var i = 0; i < n; i++) {
        var gx = (cx - head + i + 20) % Math.floor(w / cell);
        block(ctx, gx * cell + 2, cy * cell + 2, cell - 4, cell - 4, i === n - 1 ? ACCENT : 'rgba(203,41,87,0.5)', i === n - 1 ? 18 : 8);
      }
      ctx.save(); glow(ctx, 16, ACCENT); ctx.fillStyle = ACCENT;
      ctx.beginPath(); ctx.arc(cell * 3.5, cell * (cy - 2) + cell / 2, cell * 0.32, 0, 7); ctx.fill(); ctx.restore();
    },

    runner: function (ctx, w, h, t, seed) {
      bg(ctx, w, h);
      var rnd = rng(seed);
      var ground = h * 0.74;
      ctx.strokeStyle = 'rgba(203,41,87,0.6)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, ground); ctx.lineTo(w, ground); ctx.stroke();
      // scrolling dashes
      ctx.strokeStyle = 'rgba(238,238,238,0.18)';
      for (var i = -1; i < 14; i++) {
        var x = (i * (w / 10) - (t * 120) % (w / 10));
        ctx.beginPath(); ctx.moveTo(x, ground + 8); ctx.lineTo(x + 14, ground + 8); ctx.stroke();
      }
      // obstacles
      for (var o = 0; o < 3; o++) {
        var ox = (w - (t * 150 + o * 220) % (w + 200));
        block(ctx, ox, ground - 26, 16, 26, 'rgba(238,238,238,0.25)', 6);
      }
      // player hopping
      var hop = Math.abs(Math.sin(t * 4)) * 26;
      block(ctx, w * 0.22, ground - 22 - hop, 22, 22, ACCENT, 20);
    },

    shooter: function (ctx, w, h, t, seed) {
      bg(ctx, w, h); var rnd = rng(seed); stars(ctx, w, h, t, rnd, 40);
      // enemies
      for (var e = 0; e < 4; e++) {
        var ex = w * (0.2 + e * 0.2) + Math.sin(t * 1.5 + e) * 10;
        block(ctx, ex - 9, h * 0.2, 18, 12, 'rgba(238,238,238,0.55)', 6);
      }
      // bullets
      ctx.fillStyle = ACCENT; ctx.save(); glow(ctx, 10, ACCENT);
      for (var b = 0; b < 3; b++) {
        var by = (h - (t * 260 + b * 90) % h);
        ctx.fillRect(w * 0.5 - 1.5, by, 3, 12);
      }
      ctx.restore();
      // ship (triangle)
      ctx.save(); glow(ctx, 18, ACCENT); ctx.fillStyle = ACCENT;
      var px = w * 0.5, py = h * 0.82;
      ctx.beginPath(); ctx.moveTo(px, py - 14); ctx.lineTo(px + 12, py + 10); ctx.lineTo(px - 12, py + 10); ctx.closePath(); ctx.fill(); ctx.restore();
    },

    racing: function (ctx, w, h, t, seed) {
      bg(ctx, w, h);
      var cxw = w / 2;
      // road trapezoid
      ctx.fillStyle = 'rgba(238,238,238,0.04)';
      ctx.beginPath(); ctx.moveTo(cxw - w * 0.08, h * 0.25); ctx.lineTo(cxw + w * 0.08, h * 0.25);
      ctx.lineTo(cxw + w * 0.42, h); ctx.lineTo(cxw - w * 0.42, h); ctx.closePath(); ctx.fill();
      // center dashes scrolling toward viewer
      ctx.save(); glow(ctx, 8, ACCENT); ctx.fillStyle = ACCENT;
      for (var i = 0; i < 7; i++) {
        var p = ((i / 7) + (t * 0.6) % (1 / 7) * 7) % 1;
        var yy = h * 0.25 + p * (h * 0.75);
        var ww = 2 + p * 8, hh = 6 + p * 18;
        ctx.fillRect(cxw - ww / 2, yy, ww, hh);
      }
      ctx.restore();
      // car
      var carx = cxw + Math.sin(t * 1.2) * w * 0.12;
      block(ctx, carx - 16, h * 0.78, 32, 22, ACCENT, 18);
      ctx.fillStyle = '#000'; ctx.fillRect(carx - 9, h * 0.80, 18, 7);
    },

    blocks: function (ctx, w, h, t, seed) {
      bg(ctx, w, h); gridFloor(ctx, w, h, t);
      var rnd = rng(seed);
      var cols = 8, cw = w / cols, base = h;
      // settled stack
      var heights = [];
      for (var c = 0; c < cols; c++) heights[c] = Math.floor(rnd() * 4);
      for (var c2 = 0; c2 < cols; c2++) {
        for (var r = 0; r < heights[c2]; r++) {
          var shade = (c2 + r) % 2 ? ACCENT : 'rgba(203,41,87,0.45)';
          block(ctx, c2 * cw + 2, base - (r + 1) * (cw) + 2, cw - 4, cw - 4, shade, 8);
        }
      }
      // falling tetromino
      var fc = 3, fy = (t * 90) % (h * 0.5);
      block(ctx, fc * cw + 2, fy, cw - 4, cw - 4, INK, 6);
      block(ctx, fc * cw + 2, fy + cw, cw - 4, cw - 4, INK, 6);
      block(ctx, (fc + 1) * cw + 2, fy + cw, cw - 4, cw - 4, INK, 6);
    },

    pong: function (ctx, w, h, t, seed) {
      bg(ctx, w, h);
      ctx.strokeStyle = 'rgba(238,238,238,0.18)'; ctx.setLineDash([6, 8]); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h); ctx.stroke(); ctx.setLineDash([]);
      var by = h / 2 + Math.sin(t * 2.2) * h * 0.32;
      var bx = w / 2 + Math.cos(t * 2.2) * w * 0.34;
      block(ctx, 10, by - 18, 8, 36, INK, 8);
      block(ctx, w - 18, (h / 2 - Math.sin(t * 2.2) * h * 0.30) - 18, 8, 36, INK, 8);
      ctx.save(); glow(ctx, 16, ACCENT); ctx.fillStyle = ACCENT;
      ctx.beginPath(); ctx.arc(bx, by, 6, 0, 7); ctx.fill(); ctx.restore();
    },

    maze: function (ctx, w, h, t, seed) {
      bg(ctx, w, h);
      var rnd = rng(seed); var cell = Math.max(16, w / 9);
      ctx.strokeStyle = 'rgba(203,41,87,0.35)'; ctx.lineWidth = 2;
      for (var x = 0; x < w; x += cell) for (var y = 0; y < h; y += cell) {
        if (rnd() < 0.5) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + cell, y + cell); ctx.stroke(); }
        else { ctx.beginPath(); ctx.moveTo(x + cell, y); ctx.lineTo(x, y + cell); ctx.stroke(); }
      }
      var pc = (Math.floor(t * 2) % Math.floor(w / cell));
      ctx.save(); glow(ctx, 18, ACCENT); ctx.fillStyle = ACCENT;
      ctx.beginPath(); ctx.arc(pc * cell + cell / 2, h / 2, cell * 0.28, 0, 7); ctx.fill(); ctx.restore();
    },

    grid: function (ctx, w, h, t, seed) {
      bg(ctx, w, h);
      var cell = Math.max(20, w / 8);
      ctx.strokeStyle = 'rgba(203,41,87,0.4)'; ctx.lineWidth = 1;
      for (var x = 0; x <= w; x += cell) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      for (var y = 0; y <= h; y += cell) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
      // pulsing nodes
      for (var gx = cell; gx < w; gx += cell) for (var gy = cell; gy < h; gy += cell) {
        var pulse = 0.5 + 0.5 * Math.sin(t * 3 + gx * 0.05 + gy * 0.05);
        ctx.save(); glow(ctx, 4 + pulse * 12, ACCENT); ctx.fillStyle = 'rgba(203,41,87,' + (0.3 + pulse * 0.6) + ')';
        ctx.beginPath(); ctx.arc(gx, gy, 2 + pulse * 2, 0, 7); ctx.fill(); ctx.restore();
      }
    }
  };

  function draw(ctx, w, h, genre, tMs, seed) {
    noGlow(ctx);
    (ART[genre] || ART.snake)(ctx, w, h, (tMs || 0) / 1000, seed || 1);
    noGlow(ctx);
  }

  root.EZArt = { draw: draw, genres: Object.keys(ART) };
})(typeof window !== 'undefined' ? window : this);
