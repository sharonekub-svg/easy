/* ===== EZ — Game Builder ===== */
(function () {
  'use strict';

  var EZ = window.EZCredit;

  var state = {
    screen: 'landing',
    landingDraft: '',
    draft: '',
    building: false,
    model: 'fable',                      // always default to the strongest model
    currentGame: 'apex',                 // which game the live preview is running
    ledger: EZ.makeLedger(50, 21.00),    // $50 monthly budget, $21 already used
    score: 0,
    best: 0,
    paused: false,
    messages: [
      { role: 'ai', text: "Hey — tell me what game you want and I'll have it running on the right in seconds." },
      { role: 'user', text: "build a 3D arcade racer — chase cam, neon highway, traffic to dodge, speeds up over time" },
      { role: 'ai', text: "Done. Apex Drift is live on the right in full 3D — click it, hold ↑ to accelerate and ←/→ to weave through traffic. Want rival AI, drift boost, or a city skyline next?", meta: { time: '11.4s', steps: ['Spinning up WebGL scene + chase camera', 'Building car, highway & neon barriers', 'Adding traffic AI, collisions & speed ramp'], cost: { usd: EZ.gameCostUSD('opus', 6), model: 'opus' } } }
    ]
  };

  var $ = function (id) { return document.getElementById(id); };
  var buildTimer = null;
  var thumbs = [];
  var thumbRaf = null;

  function fmtUSD(v) { return '$' + v.toFixed(v < 1 ? 3 : 2); }
  function pctOfBudget(usd) { return (usd / state.ledger.budgetUSD) * 100; }

  /* ---------- routing ---------- */
  function go(screen) {
    state.screen = screen;
    ['landing', 'app', 'gallery'].forEach(function (s) {
      $('screen-' + s).hidden = (s !== screen);
    });
    if (screen === 'app') { tryInit(); } else { teardown(); }
    if (screen === 'gallery') { startThumbs(); }
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
        if (m.blocked) { ai.appendChild(blockedCard(m.blocked)); }
        else if (m.meta) { ai.appendChild(buildLog(m.meta)); }
        wrap.appendChild(ai);
      }
      box.appendChild(wrap);
    });
    if (state.building) {
      var t = document.createElement('div');
      t.className = 'typing';
      t.innerHTML = '<span class="d"></span><span class="d"></span><span class="d"></span>' +
        '<span class="label"></span>';
      t.querySelector('.label').textContent = 'Building your game… est ' + fmtUSD(state.building.usd);
      box.appendChild(t);
    }
    box.scrollTop = box.scrollHeight;
  }

  function buildLog(meta) {
    var log = document.createElement('div');
    log.className = 'buildlog';
    var head = document.createElement('div');
    head.className = 'buildlog-head';
    head.innerHTML = '<span class="buildlog-title">BUILD LOG</span><span class="buildlog-time"></span>';
    head.querySelector('.buildlog-time').textContent = meta.time;
    log.appendChild(head);
    meta.steps.forEach(function (st) {
      var step = document.createElement('div');
      step.className = 'buildlog-step';
      step.innerHTML = '<span class="check">✓</span>';
      step.appendChild(document.createTextNode(st));
      log.appendChild(step);
    });
    if (meta.cost) {
      var row = document.createElement('div');
      row.className = 'buildlog-cost';
      var label = EZ.PRICING[meta.cost.model].label;
      row.innerHTML = '<span class="lbl">COST · ' + label + '</span><span class="amt"></span>';
      row.querySelector('.amt').textContent =
        fmtUSD(meta.cost.usd) + ' · ' + pctOfBudget(meta.cost.usd).toFixed(1) + '%';
      log.appendChild(row);
    }
    return log;
  }

  function blockedCard(b) {
    var card = document.createElement('div');
    card.className = 'blocked';
    card.innerHTML =
      '<div class="blocked-head"><span class="live-dot sm"></span>NOT ENOUGH CREDIT</div>' +
      '<div class="blocked-line"><span>This build needs</span><span class="v warn">' + fmtUSD(b.estUsd) + ' · ' + b.estPct.toFixed(1) + '%</span></div>' +
      '<div class="blocked-line"><span>You have left</span><span class="v">' + fmtUSD(b.remainingUsd) + ' · ' + b.remainingPct.toFixed(1) + '%</span></div>' +
      '<div class="blocked-actions"></div>';
    var actions = card.querySelector('.blocked-actions');

    var top = document.createElement('button');
    top.className = 'blocked-btn primary';
    top.textContent = '+ Top up $25';
    top.addEventListener('click', function () { topUp(); if (b.retry) send(b.retry); });
    actions.appendChild(top);

    if (b.model !== 'sonnet') {
      var cheaper = EZ.estimate('sonnet', b.kind);
      if (EZ.canAfford(state.ledger, cheaper.usd)) {
        var sw = document.createElement('button');
        sw.className = 'blocked-btn ghost';
        sw.textContent = 'Use Sonnet 4.6 (' + fmtUSD(cheaper.usd) + ')';
        sw.addEventListener('click', function () { setModel('sonnet'); if (b.retry) send(b.retry); });
        actions.appendChild(sw);
      }
    }
    return card;
  }

  function send(text) {
    var t = (text != null ? text : state.draft).trim();
    if (!t || state.building) return;

    var hasGame = state.messages.some(function (m) { return m.meta; });
    var kind = EZ.classify(t, hasGame);
    var est = EZ.estimate(state.model, kind);

    state.messages.push({ role: 'user', text: t });
    state.draft = '';
    $('chat-input').value = '';

    // Gate BEFORE building — never stop a build mid-way.
    if (!EZ.canAfford(state.ledger, est.usd)) {
      var remaining = EZ.remainingUSD(state.ledger);
      state.messages.push({
        role: 'ai',
        text: "Hold on — you don't have enough monthly credit for this build, so I didn't start it (better than stopping halfway). Top up or switch to a cheaper model and I'll run it.",
        blocked: {
          estUsd: est.usd, estPct: pctOfBudget(est.usd),
          remainingUsd: remaining, remainingPct: pctOfBudget(remaining),
          model: state.model, kind: kind, retry: t
        }
      });
      renderMessages();
      return;
    }

    state.building = est;
    renderMessages();

    clearTimeout(buildTimer);
    buildTimer = setTimeout(function () {
      // Charge the actual cost (estimate with a little real-world variance).
      var actual = est.usd * (0.85 + Math.random() * 0.3);
      EZ.charge(state.ledger, actual);
      state.building = false;
      state.messages.push({
        role: 'ai',
        text: "On it — patched that in and hot-reloaded the build. It's live on the right, give it a try.",
        meta: {
          time: (2 + Math.random() * 2).toFixed(1) + 's',
          steps: ['Parsing your request', 'Updating game logic', 'Hot-reloading preview'],
          cost: { usd: actual, model: state.model }
        }
      });
      renderMessages();
      updateCredit();
    }, 1700);
  }

  /* ---------- credit meter ---------- */
  function updateCredit() {
    var pct = EZ.pctUsed(state.ledger);
    var remaining = EZ.remainingUSD(state.ledger);
    $('credit-fill').style.width = pct.toFixed(1) + '%';
    $('credit-pct').textContent = Math.round(pct) + '% used';
    $('credit-pct').title = fmtUSD(remaining) + ' of ' + fmtUSD(state.ledger.budgetUSD) + ' left';
    $('credit-warn').hidden = !EZ.isLow(state.ledger);
    $('btn-topup').hidden = !EZ.isLow(state.ledger);
  }

  function topUp() {
    EZ.topUp(state.ledger, 25);
    updateCredit();
  }

  /* ---------- model selector ---------- */
  function setModel(key) {
    state.model = key;
    $('model-seg').querySelectorAll('.model-opt').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-model') === key);
    });
    var build = EZ.estimate(key, 'build').usd;
    $('model-price').textContent = '~' + fmtUSD(build) + '/build';
  }

  function buildModelSelector() {
    var seg = $('model-seg');
    ['opus', 'fable', 'sonnet'].forEach(function (key) {
      var b = document.createElement('button');
      b.className = 'model-opt';
      b.setAttribute('data-model', key);
      b.textContent = EZ.PRICING[key].label;
      b.addEventListener('click', function () { setModel(key); });
      seg.appendChild(b);
    });
    setModel(state.model);
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
    ['a 3D racer with neon city traffic', 'meccha chameleon — blend-in hide & seek', 'a roblox-style obby', 'an endless space runner']
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

    // Each card opens a real game (game key). Two full 3D engines today
    // (apex, hideout); hue gives every tile its own colour.
    var games = [
      { name: 'APEX DRIFT', file: 'apexdrift.ez', author: '@you', plays: '18.2k', tag: '3D · RACER', genre: 'racing', game: 'apex', hue: 0 },
      { name: 'MECCHA CHAMELEON', file: 'meccha.ez', author: '@you', plays: '21.6k', tag: '3D · BLEND & SEEK', genre: 'maze', game: 'hideout', hue: 110 },
      { name: 'VOID RUNNER', file: 'voidrun.ez', author: '@toru', plays: '9.1k', tag: 'RUNNER', genre: 'runner', game: 'apex', hue: 205 },
      { name: 'ASTRO POP', file: 'astropop.ez', author: '@dev_k', plays: '6.2k', tag: 'SHOOTER', genre: 'shooter', game: 'hideout', hue: 40 },
      { name: 'BLOCK FALL', file: 'blockfall.ez', author: '@nori', plays: '5.5k', tag: 'PUZZLE', genre: 'blocks', game: 'hideout', hue: 268 },
      { name: 'LASER GRID', file: 'lasergrid.ez', author: '@sasha', plays: '4.9k', tag: 'ARCADE', genre: 'grid', game: 'apex', hue: 160 },
      { name: 'CYBER PONG', file: 'pong.ez', author: '@yui', plays: '4.1k', tag: 'CLASSIC', genre: 'pong', game: 'hideout', hue: 310 },
      { name: 'MAZE NINE', file: 'maze9.ez', author: '@beck', plays: '3.7k', tag: 'MAZE', genre: 'maze', game: 'hideout', hue: 85 },
      { name: 'BIT BLASTER', file: 'blaster.ez', author: '@ravi', plays: '3.0k', tag: 'SHOOTER', genre: 'shooter', game: 'apex', hue: 22 }
    ];
    var grid = $('gallery-grid');
    thumbs = [];
    games.forEach(function (g, i) {
      var card = document.createElement('div');
      card.className = 'card';
      card.style.animationDelay = (i * 0.04) + 's';
      card.innerHTML =
        '<div class="card-thumb">' +
          '<canvas></canvas>' +
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
      var cv = card.querySelector('canvas');
      if (g.hue) cv.style.filter = 'hue-rotate(' + g.hue + 'deg)';
      var key = g.game;
      card.querySelector('.remix').addEventListener('click', function (e) { e.stopPropagation(); openGame(key); });
      card.addEventListener('click', function () { openGame(key); });
      grid.appendChild(card);
      thumbs.push({ canvas: cv, ctx: null, genre: g.genre, seed: (i + 1) * 2654435761 });
    });
  }

  /* ---------- gallery thumbnail animation ---------- */
  function drawThumbs(now) {
    if (state.screen !== 'gallery') { thumbRaf = null; return; }
    thumbs.forEach(function (th) {
      var c = th.canvas;
      var r = c.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) return;
      var dpr = window.devicePixelRatio || 1;
      var pw = Math.floor(r.width * dpr), ph = Math.floor(r.height * dpr);
      if (c.width !== pw || c.height !== ph) { c.width = pw; c.height = ph; th.ctx = null; }
      if (!th.ctx) { th.ctx = c.getContext('2d'); }
      th.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      window.EZArt.draw(th.ctx, r.width, r.height, th.genre, now, th.seed);
    });
    thumbRaf = requestAnimationFrame(drawThumbs);
  }

  function startThumbs() {
    if (!thumbRaf) thumbRaf = requestAnimationFrame(drawThumbs);
  }

  /* ---------- 3D games (registry: window.EZGames) ---------- */
  var gameCtl = null;

  // each game's metadata + download artifact
  var GAME_META = {
    apex:    { name: 'Apex Drift',       tag: 'NEON RACER', download: './dist/apex-drift.html',
               hint: 'click the preview · ↑ accelerate · ← → steer' },
    hideout: { name: 'Meccha Chameleon', tag: 'BLEND HIDE & SEEK', download: null,
               hint: 'click · WASD move · E eyedrop colour · match the scene to vanish' }
  };

  function applyGameMeta() {
    var m = GAME_META[state.currentGame] || GAME_META.apex;
    $('project-name').textContent = m.name;
    $('game-name').textContent = m.name.toUpperCase();
    if ($('game-hint')) $('game-hint').textContent = m.hint;
  }

  function tryInit() {
    var c = $('game-canvas');
    if (!c || gameCtl) return;
    var reg = window.EZGames && window.EZGames[state.currentGame];
    if (!reg) { setTimeout(tryInit, 80); return; }
    var r = c.getBoundingClientRect();
    if (r.width < 20 || r.height < 20) { setTimeout(tryInit, 60); return; }
    state.score = 0; state.best = 0; updateScore();
    gameCtl = reg.mount(c, {
      onScore: function (s) { state.score = s; updateScore(); },
      onBest: function (b) { state.best = b; updateScore(); }
    });
    applyGameMeta();
  }

  function teardown() {
    if (!gameCtl) return;
    gameCtl.dispose();
    gameCtl = null;
  }

  // open a specific game in the live preview (from the gallery)
  function openGame(key) {
    if (!GAME_META[key]) key = 'apex';
    teardown();
    state.currentGame = key;
    $('btn-pause').textContent = '❚❚';
    go('app');
  }

  /* ---------- download / publish ---------- */
  function toast(title, html) {
    var t = document.createElement('div');
    t.className = 'ez-toast';
    t.innerHTML = '<span class="t-title">' + title + '</span><span>' + html + '</span>';
    document.body.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('show'); });
    setTimeout(function () { t.classList.remove('show'); setTimeout(function () { t.remove(); }, 300); }, 5200);
  }

  function downloadGame() {
    var m = GAME_META[state.currentGame] || GAME_META.apex;
    if (m.download) {
      var a = document.createElement('a');
      a.href = m.download;
      a.download = state.currentGame + '.html';
      document.body.appendChild(a); a.click(); a.remove();
      toast('DOWNLOADED', m.name + ' exported as a standalone .html — double-click to play, host it anywhere.');
    } else {
      toast('PACKAGING', 'Building a standalone export of ' + m.name + '… (wired up for Apex Drift today).');
    }
  }

  function publishGame() {
    var m = GAME_META[state.currentGame] || GAME_META.apex;
    var slug = m.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    var url = 'play.ez.app/' + slug;
    toast('PUBLISHED ✦', m.name + ' is live at <a href="#" onclick="return false">' + url + '</a> — share the link, anyone can play instantly.');
  }

  /* ---------- wiring ---------- */
  function startFromLanding() {
    var t = $('landing-input').value.trim();
    go('app');
    if (t) { setTimeout(function () { send(t); }, 500); }
  }

  function init() {
    document.querySelectorAll('[data-nav]').forEach(function (el) {
      el.addEventListener('click', function () { go(el.getAttribute('data-nav')); });
    });
    document.querySelectorAll('[data-pricing]').forEach(function (el) {
      el.addEventListener('click', function () { go('gallery'); });
    });

    $('landing-input').addEventListener('input', function (e) { state.landingDraft = e.target.value; });
    $('landing-input').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); startFromLanding(); }
    });
    $('landing-build').addEventListener('click', startFromLanding);

    $('chat-input').addEventListener('input', function (e) { state.draft = e.target.value; });
    $('chat-input').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    });
    $('chat-send').addEventListener('click', function () { send(); });
    $('btn-topup').addEventListener('click', topUp);

    $('btn-pause').addEventListener('click', function () {
      if (gameCtl) { var p = gameCtl.togglePause(); state.paused = p; $('btn-pause').textContent = p ? '▶' : '❚❚'; }
    });
    $('btn-restart').addEventListener('click', function () {
      if (gameCtl) { gameCtl.reset(); state.paused = false; $('btn-pause').textContent = '❚❚'; }
    });
    $('btn-download').addEventListener('click', downloadGame);
    $('btn-publish').addEventListener('click', publishGame);

    buildModelSelector();
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
