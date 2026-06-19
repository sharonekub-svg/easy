/* ===== EZ — Game Builder ===== */
(function () {
  'use strict';

  var state = {
    screen: 'landing',
    landingDraft: '',
    draft: '',
    building: false,
    score: 0,
    best: 0,
    paused: false,
    credit: 79,
    messages: [
      { role: 'ai', text: "Hey — tell me what game you want and I'll have it running on the right in seconds." },
      { role: 'user', text: "make a neon snake game that speeds up as you grow" },
      { role: 'ai', text: "Done. Neon Snake is live on the right — click it and use the arrow keys. Want power-ups or a high-score board next?", meta: { time: '3.2s', steps: ['Scaffolding canvas renderer', 'Wiring keyboard controls', 'Adding neon glow + scoring'] } }
    ]
  };

  var $ = function (id) { return document.getElementById(id); };
  var game = null;
  var buildTimer = null;

  /* ---------- routing ---------- */
  function go(screen) {
    state.screen = screen;
    ['landing', 'app', 'gallery'].forEach(function (s) {
      $('screen-' + s).hidden = (s !== screen);
    });
    if (screen === 'app') { tryInit(); } else { teardown(); }
  }

  /* ---------- chat ---------- */
  function renderMessages() {
    var box = $('messages');
    box.innerHTML = '';
    state.messages.forEach(function (m) {
      var wrap = document.createElement('div');
      wrap.className = 'msg';
      if (m.role === 'user') {
        var u = document.createElement('div');
        u.className = 'msg-user';
        u.textContent = m.text;
        wrap.appendChild(u);
      } else {
        var ai = document.createElement('div');
        ai.className = 'msg-ai';
        ai.innerHTML =
          '<div class="msg-ai-head"><div class="msg-ai-badge">EZ</div>' +
          '<span class="msg-ai-name">EZ Assistant</span></div>' +
          '<div class="msg-ai-body"></div>';
        ai.querySelector('.msg-ai-body').textContent = m.text;
        if (m.meta) {
          var log = document.createElement('div');
          log.className = 'buildlog';
          var head = document.createElement('div');
          head.className = 'buildlog-head';
          head.innerHTML = '<span class="buildlog-title">BUILD LOG</span>' +
            '<span class="buildlog-time"></span>';
          head.querySelector('.buildlog-time').textContent = m.meta.time;
          log.appendChild(head);
          m.meta.steps.forEach(function (st) {
            var step = document.createElement('div');
            step.className = 'buildlog-step';
            step.innerHTML = '<span class="check">✓</span>';
            step.appendChild(document.createTextNode(st));
            log.appendChild(step);
          });
          ai.appendChild(log);
        }
        wrap.appendChild(ai);
      }
      box.appendChild(wrap);
    });
    if (state.building) {
      var t = document.createElement('div');
      t.className = 'typing';
      t.innerHTML = '<span class="d"></span><span class="d"></span><span class="d"></span>' +
        '<span class="label">Building your game…</span>';
      box.appendChild(t);
    }
    box.scrollTop = box.scrollHeight;
  }

  function send(text) {
    var t = (text != null ? text : state.draft).trim();
    if (!t || state.building) return;
    state.messages.push({ role: 'user', text: t });
    state.draft = '';
    $('chat-input').value = '';
    state.building = true;
    renderMessages();

    clearTimeout(buildTimer);
    buildTimer = setTimeout(function () {
      state.building = false;
      state.credit = Math.min(100, state.credit + 4);
      state.messages.push({
        role: 'ai',
        text: "On it — patched that in and hot-reloaded the build. It's live on the right, give it a try.",
        meta: {
          time: (2 + Math.random() * 2).toFixed(1) + 's',
          steps: ['Parsing your request', 'Updating game logic', 'Hot-reloading preview']
        }
      });
      renderMessages();
      updateCredit();
    }, 1700);
  }

  /* ---------- credit meter ---------- */
  function updateCredit() {
    $('credit-fill').style.width = state.credit + '%';
    $('credit-pct').textContent = state.credit + '% used';
    $('credit-warn').hidden = state.credit < 80;
  }

  /* ---------- score ---------- */
  function pad(n) { return String(n).padStart(2, '0'); }
  function updateScore() {
    $('score').textContent = pad(state.score);
    $('best').textContent = pad(state.best);
  }

  /* ---------- chips ---------- */
  function chip(label, onClick, small) {
    var b = document.createElement('button');
    b.className = 'chip' + (small ? ' sm' : '');
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  }

  function buildChips() {
    var ex = $('example-chips');
    ['a neon snake that speeds up', 'an endless space runner', 'a tiny platformer', 'brick breaker with power-ups']
      .forEach(function (t) {
        ex.appendChild(chip(t, function () {
          state.landingDraft = t;
          $('landing-input').value = t;
        }));
      });

    var sug = $('suggest-chips');
    ['Add power-ups', 'High-score board', 'Make it harder', 'New color theme']
      .forEach(function (t) { sug.appendChild(chip(t, function () { send(t); }, true)); });
  }

  /* ---------- gallery ---------- */
  function buildGallery() {
    var filters = ['All', 'Arcade', 'Runner', 'Shooter', 'Puzzle', 'Classic'];
    var fbox = $('filter-chips');
    filters.forEach(function (label, i) {
      var b = document.createElement('button');
      b.className = 'filter' + (i === 0 ? ' active' : '');
      b.textContent = label;
      b.addEventListener('click', function () {
        fbox.querySelectorAll('.filter').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
      });
      fbox.appendChild(b);
    });

    var games = [
      { name: 'NEON SNAKE', file: 'snake.ez', author: '@maya', plays: '12.4k', tag: 'ARCADE' },
      { name: 'VOID RUNNER', file: 'voidrun.ez', author: '@toru', plays: '9.1k', tag: 'RUNNER' },
      { name: 'PIXEL DRIFT', file: 'drift.ez', author: '@lin', plays: '7.8k', tag: 'RACING' },
      { name: 'ASTRO POP', file: 'astropop.ez', author: '@dev_k', plays: '6.2k', tag: 'SHOOTER' },
      { name: 'BLOCK FALL', file: 'blockfall.ez', author: '@nori', plays: '5.5k', tag: 'PUZZLE' },
      { name: 'LASER GRID', file: 'lasergrid.ez', author: '@sasha', plays: '4.9k', tag: 'ARCADE' },
      { name: 'CYBER PONG', file: 'pong.ez', author: '@yui', plays: '4.1k', tag: 'CLASSIC' },
      { name: 'MAZE NINE', file: 'maze9.ez', author: '@beck', plays: '3.7k', tag: 'MAZE' },
      { name: 'BIT BLASTER', file: 'blaster.ez', author: '@ravi', plays: '3.0k', tag: 'SHOOTER' }
    ];
    var grid = $('gallery-grid');
    games.forEach(function (g, i) {
      var tint = (0.10 + (i % 4) * 0.06).toFixed(2);
      var ang = 90 + (i % 3) * 25;
      var card = document.createElement('div');
      card.className = 'card';
      card.style.animationDelay = (i * 0.04) + 's';
      card.innerHTML =
        '<div class="card-thumb" style="background:linear-gradient(135deg,rgba(203,41,87,' + tint + ') 0%,#000 72%),repeating-linear-gradient(' + ang + 'deg,rgba(238,238,238,0.05) 0 2px,transparent 2px 10px);">' +
          '<div class="card-scan"></div>' +
          '<span class="card-file">' + g.file + '</span>' +
          '<span class="card-tag">' + g.tag + '</span>' +
        '</div>' +
        '<div class="card-body">' +
          '<div class="card-name">' + g.name + '</div>' +
          '<div class="card-meta">' +
            '<span class="card-author">' + g.author + ' · ' + g.plays + ' plays</span>' +
            '<button class="remix">Remix</button>' +
          '</div>' +
        '</div>';
      card.querySelector('.remix').addEventListener('click', function (e) { e.stopPropagation(); go('app'); });
      card.addEventListener('click', function () { go('app'); });
      grid.appendChild(card);
    });
  }

  /* ---------- snake game ---------- */
  function tryInit() {
    var c = $('game-canvas');
    if (!c || game) return;
    var r = c.getBoundingClientRect();
    if (r.width < 20 || r.height < 20) { setTimeout(tryInit, 60); return; }
    initGame(c);
  }

  function teardown() {
    if (!game) return;
    cancelAnimationFrame(game.raf);
    window.removeEventListener('keydown', game.key, true);
    window.removeEventListener('resize', game.onResize);
    game = null;
  }

  function initGame(canvas) {
    var ctx = canvas.getContext('2d');
    var ACCENT = '#CB2957';
    var CELL = 24;
    var baseSpeed = 130;
    var g = game = { paused: false };

    var resize = function () {
      var r = canvas.getBoundingClientRect();
      var dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(r.width * dpr);
      canvas.height = Math.floor(r.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.w = r.width; g.h = r.height;
      g.cols = Math.floor(r.width / CELL);
      g.rows = Math.floor(r.height / CELL);
      g.offx = (r.width - g.cols * CELL) / 2;
      g.offy = (r.height - g.rows * CELL) / 2;
    };

    var randFood = function () {
      var p;
      do { p = { x: Math.floor(Math.random() * g.cols), y: Math.floor(Math.random() * g.rows) }; }
      while (g.snake.some(function (s) { return s.x === p.x && s.y === p.y; }));
      return p;
    };

    var reset = function () {
      var cx = Math.floor(g.cols / 2), cy = Math.floor(g.rows / 2);
      g.snake = [{ x: cx, y: cy }, { x: cx - 1, y: cy }, { x: cx - 2, y: cy }];
      g.dir = { x: 1, y: 0 }; g.next = { x: 1, y: 0 };
      g.over = false; g.speed = baseSpeed; g.acc = 0;
      g.food = randFood();
      state.score = 0; updateScore();
    };

    var key = function (e) {
      var ae = document.activeElement;
      if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) return;
      var map = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
        w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0], W: [0, -1], S: [0, 1], A: [-1, 0], D: [1, 0] };
      var m = map[e.key];
      if (g.over && (e.key === ' ' || m)) { e.preventDefault(); reset(); return; }
      if (!m) return;
      e.preventDefault();
      if (m[0] === -g.dir.x && m[1] === -g.dir.y) return;
      g.next = { x: m[0], y: m[1] };
    };

    var step = function () {
      if (g.over) return;
      g.dir = g.next;
      var head = { x: g.snake[0].x + g.dir.x, y: g.snake[0].y + g.dir.y };
      if (head.x < 0 || head.y < 0 || head.x >= g.cols || head.y >= g.rows ||
        g.snake.some(function (s) { return s.x === head.x && s.y === head.y; })) { g.over = true; return; }
      g.snake.unshift(head);
      if (head.x === g.food.x && head.y === g.food.y) {
        g.food = randFood();
        state.score += 1;
        state.best = Math.max(state.best, state.score);
        updateScore();
        if (g.speed > 65) g.speed -= 4;
      } else { g.snake.pop(); }
    };

    var rr = function (x, y, w, h, rad) {
      ctx.beginPath();
      ctx.moveTo(x + rad, y); ctx.arcTo(x + w, y, x + w, y + h, rad); ctx.arcTo(x + w, y + h, x, y + h, rad);
      ctx.arcTo(x, y + h, x, y, rad); ctx.arcTo(x, y, x + w, y, rad); ctx.closePath();
    };

    var draw = function () {
      ctx.clearRect(0, 0, g.w, g.h);
      ctx.strokeStyle = 'rgba(238,238,238,0.045)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (var i = 0; i <= g.cols; i++) { var x = g.offx + i * CELL; ctx.moveTo(x, g.offy); ctx.lineTo(x, g.offy + g.rows * CELL); }
      for (var j = 0; j <= g.rows; j++) { var y = g.offy + j * CELL; ctx.moveTo(g.offx, y); ctx.lineTo(g.offx + g.cols * CELL, y); }
      ctx.stroke();

      var fx = g.offx + g.food.x * CELL + CELL / 2, fy = g.offy + g.food.y * CELL + CELL / 2;
      ctx.save();
      ctx.shadowColor = ACCENT; ctx.shadowBlur = 20; ctx.fillStyle = ACCENT;
      var pulse = 0.30 + Math.sin(performance.now() / 220) * 0.05;
      ctx.beginPath(); ctx.arc(fx, fy, CELL * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      g.snake.forEach(function (sg, i) {
        var x = g.offx + sg.x * CELL, y = g.offy + sg.y * CELL;
        ctx.save();
        ctx.shadowColor = ACCENT; ctx.shadowBlur = i === 0 ? 22 : 9;
        ctx.fillStyle = i === 0 ? ACCENT : 'rgba(203,41,87,' + Math.max(0.32, 1 - i * 0.035) + ')';
        rr(x + 2, y + 2, CELL - 4, CELL - 4, 6); ctx.fill();
        ctx.restore();
      });

      if (g.over) {
        ctx.fillStyle = 'rgba(0,0,0,0.72)';
        ctx.fillRect(0, 0, g.w, g.h);
        ctx.textAlign = 'center';
        ctx.fillStyle = ACCENT;
        ctx.font = "700 38px 'Martian Mono', monospace";
        ctx.shadowColor = ACCENT; ctx.shadowBlur = 24;
        ctx.fillText('GAME OVER', g.w / 2, g.h / 2 - 8);
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(238,238,238,0.6)';
        ctx.font = "500 14px 'Space Grotesk', sans-serif";
        ctx.fillText('press space or an arrow key to retry', g.w / 2, g.h / 2 + 28);
      }
      if (g.paused && !g.over) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(0, 0, g.w, g.h);
        ctx.textAlign = 'center'; ctx.fillStyle = '#DDDDDD';
        ctx.font = "700 26px 'Martian Mono', monospace";
        ctx.fillText('PAUSED', g.w / 2, g.h / 2);
      }
    };

    var frame = function (now) {
      if (g.last == null) g.last = now;
      var dt = now - g.last; g.last = now;
      if (!g.paused) { g.acc += dt; while (g.acc >= g.speed) { step(); g.acc -= g.speed; } }
      draw();
      g.raf = requestAnimationFrame(frame);
    };

    g.reset = reset; g.key = key; g.onResize = resize;
    resize(); reset(); draw();
    window.addEventListener('keydown', key, true);
    window.addEventListener('resize', resize);
    g.raf = requestAnimationFrame(frame);
  }

  /* ---------- wiring ---------- */
  function startFromLanding() {
    var t = $('landing-input').value.trim();
    go('app');
    if (t) { setTimeout(function () { send(t); }, 500); }
  }

  function init() {
    // nav buttons (data-nav across all screens)
    document.querySelectorAll('[data-nav]').forEach(function (el) {
      el.addEventListener('click', function () { go(el.getAttribute('data-nav')); });
    });
    document.querySelectorAll('[data-pricing]').forEach(function (el) {
      el.addEventListener('click', function () { go('gallery'); });
    });

    // landing input
    $('landing-input').addEventListener('input', function (e) { state.landingDraft = e.target.value; });
    $('landing-input').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); startFromLanding(); }
    });
    $('landing-build').addEventListener('click', startFromLanding);
    // Start building / +New game nav already routes to app; landing-build handles draft.

    // chat input
    $('chat-input').addEventListener('input', function (e) { state.draft = e.target.value; });
    $('chat-input').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    });
    $('chat-send').addEventListener('click', function () { send(); });

    // game controls
    $('btn-pause').addEventListener('click', function () {
      if (game) { game.paused = !game.paused; state.paused = game.paused; $('btn-pause').textContent = game.paused ? '▶' : '❚❚'; }
    });
    $('btn-restart').addEventListener('click', function () {
      if (game && game.reset) { game.reset(); game.paused = false; state.paused = false; $('btn-pause').textContent = '❚❚'; }
    });

    buildChips();
    buildGallery();
    renderMessages();
    updateCredit();
    updateScore();
    go('landing');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})();
