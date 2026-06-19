/* ===== EZ game — MECCHA CHAMELEON (browser replica) =====
 * A browser/WebGL take on the Steam hit: a 3D hide & seek where you survive a
 * roaming hunter by CAMOUFLAGING — paint your body to match nearby surfaces so
 * the hunter literally can't see you. Move or mismatch and you get exposed.
 * Registers as window.EZGames.hideout.mount(canvas, opts) -> controller.
 */
import * as THREE from 'three';

(function (root) {
  'use strict';

  function mount(canvas, opts) {
    opts = opts || {};
    var parent = canvas.parentElement;

    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setClearColor(0x9ad0ff, 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    var scene = new THREE.Scene();
    scene.background = new THREE.Color(0x9ad0ff);
    scene.fog = new THREE.Fog(0x9ad0ff, 55, 110);

    var camera = new THREE.PerspectiveCamera(55, 1, 0.1, 300);

    scene.add(new THREE.HemisphereLight(0xdff1ff, 0x4f7a3a, 0.95));
    var sun = new THREE.DirectionalLight(0xfff6e0, 1.7);
    sun.position.set(18, 30, 12); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 90;
    sun.shadow.camera.left = -34; sun.shadow.camera.right = 34;
    sun.shadow.camera.top = 34; sun.shadow.camera.bottom = -34;
    sun.shadow.bias = -0.0004; scene.add(sun); scene.add(sun.target);

    var ARENA = 34;
    var GRASS = 0x69bf48;
    var floor = new THREE.Mesh(new THREE.PlaneGeometry(ARENA * 2, ARENA * 2),
      new THREE.MeshStandardMaterial({ color: GRASS, roughness: 1 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    for (var gx = -ARENA; gx < ARENA; gx += 8) for (var gz = -ARENA; gz < ARENA; gz += 8) {
      if (((gx + gz) / 8) % 2 === 0) {
        var patch = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.MeshStandardMaterial({ color: 0x5fb23f, roughness: 1 }));
        patch.rotation.x = -Math.PI / 2; patch.position.set(gx + 4, 0.01, gz + 4); patch.receiveShadow = true; scene.add(patch);
      }
    }
    var wallMat = new THREE.MeshStandardMaterial({ color: 0xf0e6d2, roughness: 0.9 });
    [[0, -ARENA], [0, ARENA], [-ARENA, 0], [ARENA, 0]].forEach(function (p, i) {
      var horiz = i < 2;
      var wall = new THREE.Mesh(new THREE.BoxGeometry(horiz ? ARENA * 2 : 1, 2.4, horiz ? 1 : ARENA * 2), wallMat);
      wall.position.set(p[0], 1.2, p[1]); wall.castShadow = true; wall.receiveShadow = true; scene.add(wall);
    });

    // colorful crates (cover + the palette you can blend into)
    var crateColors = [0xe8483b, 0x3a7bd5, 0xffc23c, 0xff8a3d, 0x9b59b6, 0x2ec4a6, 0xf25c9a, 0xf0e6d2];
    var blocks = [];
    function rand(a, b) { return a + Math.random() * (b - a); }
    for (var b = 0; b < 16; b++) {
      var s = rand(2, 4.5), hgt = rand(1.6, 3.4);
      var col = crateColors[b % crateColors.length];
      var crate = new THREE.Mesh(new THREE.BoxGeometry(s, hgt, s),
        new THREE.MeshStandardMaterial({ color: col, roughness: 0.7, metalness: 0.05 }));
      crate.position.set(rand(-ARENA + 5, ARENA - 5), hgt / 2, rand(-ARENA + 5, ARENA - 5));
      if (Math.hypot(crate.position.x, crate.position.z) < 6) crate.position.x += 9;
      crate.castShadow = true; crate.receiveShadow = true;
      crate.userData.color = new THREE.Color(col);
      scene.add(crate); blocks.push(crate);
    }

    // ---- blocky avatar ----
    function avatar(shirt, head, pants) {
      var g = new THREE.Group();
      var bodyMats = [];
      function part(geo, color, y, x, z) {
        var m = new THREE.MeshStandardMaterial({ color: color, roughness: 0.85 });
        var mesh = new THREE.Mesh(geo, m); mesh.position.set(x || 0, y, z || 0); mesh.castShadow = true; g.add(mesh);
        return { mesh: mesh, mat: m };
      }
      g.torso = part(new THREE.BoxGeometry(1.1, 1.1, 0.6), shirt, 1.5);
      g.head = part(new THREE.BoxGeometry(0.75, 0.75, 0.75), head, 2.45);
      g.limbs = [];
      g.limbs.push(part(new THREE.BoxGeometry(0.35, 1.05, 0.35), shirt, 1.45, -0.75));
      g.limbs.push(part(new THREE.BoxGeometry(0.35, 1.05, 0.35), shirt, 1.45, 0.75));
      g.limbs.push(part(new THREE.BoxGeometry(0.4, 1.0, 0.4), pants, 0.5, -0.3));
      g.limbs.push(part(new THREE.BoxGeometry(0.4, 1.0, 0.4), pants, 0.5, 0.3));
      g.bodyParts = [g.torso, g.head, g.limbs[0], g.limbs[1], g.limbs[2], g.limbs[3]];
      g.setColor = function (c) { g.bodyParts.forEach(function (pp) { pp.mat.color.copy(c); }); };
      return g;
    }

    var player = avatar(0xffffff, 0xffffff, 0xffffff); scene.add(player);
    var seeker = avatar(0xd6342a, 0x7a1410, 0x2a0d0b); scene.add(seeker);
    var playerColor = new THREE.Color(0xffffff);
    function setPlayerColor(c) { playerColor.copy(c); player.setColor(c); refreshPalette(); }

    // ---- state ----
    var keys = {};
    var raycaster = new THREE.Raycaster();
    var tmp = new THREE.Vector3();
    var time = 0, best = 0, over = false, paused = false, raf = 0, last = null;
    var crouch = false, blend = 0;
    var seek = { mode: 'roam', wp: new THREE.Vector3(), lostT: 0 };

    function newWaypoint() { seek.wp.set(rand(-ARENA + 5, ARENA - 5), 0, rand(-ARENA + 5, ARENA - 5)); }
    function placeStart() {
      player.position.set(0, 0, 0); player.rotation.y = 0;
      seeker.position.set(0, 0, -ARENA + 6); seeker.rotation.y = 0;
      seek.mode = 'roam'; seek.lostT = 0; newWaypoint();
      setPlayerColor(new THREE.Color(0xffffff));
    }
    function reset() { time = 0; over = false; paused = false; crouch = false; placeStart(); hideOverlay(); if (opts.onScore) opts.onScore(0); }

    function canSee(from, to) {
      tmp.copy(to).sub(from); var dist = tmp.length(); tmp.normalize();
      raycaster.set(from.clone().setY(1.4), tmp); raycaster.far = dist - 0.6;
      return raycaster.intersectObjects(blocks, false).length === 0;
    }
    function clampArena(v) { var lim = ARENA - 1.5; v.x = Math.max(-lim, Math.min(lim, v.x)); v.z = Math.max(-lim, Math.min(lim, v.z)); }
    function collideBlocks(pos, radius) {
      for (var i = 0; i < blocks.length; i++) {
        var bx = blocks[i]; var hw = bx.geometry.parameters.width / 2 + radius, hd = bx.geometry.parameters.depth / 2 + radius;
        var dx = pos.x - bx.position.x, dz = pos.z - bx.position.z;
        if (Math.abs(dx) < hw && Math.abs(dz) < hd) {
          var ox = hw - Math.abs(dx), oz = hd - Math.abs(dz);
          if (ox < oz) pos.x = bx.position.x + (dx < 0 ? -hw : hw); else pos.z = bx.position.z + (dz < 0 ? -hd : hd);
        }
      }
    }
    function bob(g, moving, t) {
      var sw = moving ? Math.sin(t * 10) * 0.5 : 0;
      if (g.limbs) { g.limbs[0].mesh.rotation.x = sw; g.limbs[1].mesh.rotation.x = -sw; g.limbs[2].mesh.rotation.x = -sw; g.limbs[3].mesh.rotation.x = sw; }
    }

    // nearest cover colour (what you should blend into); grass if in the open
    var grassColor = new THREE.Color(GRASS);
    function nearestCover() {
      var best = null, bd = 5.0;
      for (var i = 0; i < blocks.length; i++) {
        var d = Math.hypot(player.position.x - blocks[i].position.x, player.position.z - blocks[i].position.z) - blocks[i].geometry.parameters.width / 2;
        if (d < bd) { bd = d; best = blocks[i]; }
      }
      return best ? best.userData.color : grassColor;
    }
    function colorDist(a, c) { var dr = a.r - c.r, dg = a.g - c.g, db = a.b - c.b; return Math.sqrt(dr * dr + dg * dg + db * db); }

    // eyedropper: absorb the colour of the nearest crate (or grass)
    function eyedrop() { setPlayerColor(nearestCover().clone()); flash('ABSORBED'); }

    function update(dt) {
      if (over || paused) return;
      time += dt;

      var mx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      var mz = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
      var len = Math.hypot(mx, mz);
      var speed = crouch ? 5.5 : 10.5;
      if (len > 0) { mx /= len; mz /= len; }
      player.position.x += mx * speed * dt; player.position.z += mz * speed * dt;
      clampArena(player.position); collideBlocks(player.position, 0.6);
      if (len > 0) player.rotation.y = Math.atan2(mx, mz);
      player.position.y = crouch ? -0.45 : 0;
      bob(player, len > 0, time);

      // ---- camouflage ----
      var ref = nearestCover();
      var cd = colorDist(playerColor, ref);          // 0 = perfect match
      var match = Math.max(0, 1 - cd / 0.55);         // how well colour matches
      var moving = len > 0;
      blend = match;
      if (moving) blend *= 0.32;                       // motion gives you away
      if (crouch) blend = Math.min(1, blend + 0.12);   // crouching helps
      blend = Math.max(0, Math.min(1, blend));

      // seeker AI with camo-aware sight
      var toP = tmp.copy(player.position).sub(seeker.position); var dP = toP.length();
      var sight = 19 * (1 - blend * 0.82);             // blended+still -> tiny sight radius
      var sees = dP < Math.max(2.6, sight) && canSee(seeker.position, player.position);
      if (sees) { seek.mode = 'chase'; seek.lostT = 0; }
      else if (seek.mode === 'chase') { seek.lostT += dt; if (seek.lostT > 1.5) { seek.mode = 'roam'; newWaypoint(); } }

      var target, sSpeed;
      if (seek.mode === 'chase') { target = player.position; sSpeed = 8.6; }
      else { target = seek.wp; sSpeed = 5.0; if (seeker.position.distanceTo(seek.wp) < 2) newWaypoint(); }
      var sd = tmp.copy(target).sub(seeker.position); sd.y = 0;
      if (sd.length() > 0.001) {
        sd.normalize();
        seeker.position.x += sd.x * sSpeed * dt; seeker.position.z += sd.z * sSpeed * dt;
        clampArena(seeker.position); collideBlocks(seeker.position, 0.6);
        seeker.rotation.y = Math.atan2(sd.x, sd.z);
      }
      bob(seeker, true, time * 1.1);

      if (dP < 1.7) caught();

      updateCamoHud(blend, seek.mode === 'chase');
      var sc = Math.floor(time);
      if (opts.onScore) opts.onScore(sc);
      if (sc > best) { best = sc; if (opts.onBest) opts.onBest(best); }
    }

    function caught() { over = true; showOverlay('SPOTTED!', 'survived ' + Math.floor(time) + 's · press space to retry', '#d6342a'); if (opts.onState) opts.onState('over'); }

    // ---- HUD: overlay + camo meter + colour palette ----
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;gap:8px;font-family:\'Martian Mono\',monospace;text-align:center;pointer-events:none;z-index:4;';
    parent.appendChild(overlay);
    function showOverlay(t, s, c) {
      overlay.innerHTML = '<div style="font-size:42px;font-weight:800;color:' + c + ';text-shadow:0 3px 0 rgba(0,0,0,0.25)">' + t + '</div>' +
        (s ? '<div style="font-family:\'Space Grotesk\',sans-serif;font-size:14px;color:#fff;text-shadow:0 2px 6px rgba(0,0,0,0.5)">' + s + '</div>' : '');
      overlay.style.display = 'flex';
    }
    function hideOverlay() { overlay.style.display = 'none'; }

    var camo = document.createElement('div');
    camo.style.cssText = 'position:absolute;top:14px;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:5px;font-family:\'Martian Mono\',monospace;z-index:4;pointer-events:none;';
    camo.innerHTML = '<div id="camo-label" style="font-size:10px;font-weight:700;letter-spacing:2px;color:#fff;text-shadow:0 1px 4px rgba(0,0,0,.6)">CAMO</div>' +
      '<div style="width:170px;height:8px;background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.5);border-radius:999px;overflow:hidden"><div id="camo-fill" style="height:100%;width:0%;background:#2ec4a6;transition:width .12s,background .2s"></div></div>';
    parent.appendChild(camo);
    var flashEl = document.createElement('div');
    flashEl.style.cssText = 'position:absolute;top:46px;left:50%;transform:translateX(-50%);font-family:\'Martian Mono\';font-size:11px;font-weight:700;color:#fff;text-shadow:0 1px 4px rgba(0,0,0,.6);opacity:0;transition:opacity .2s;z-index:4;pointer-events:none;';
    parent.appendChild(flashEl);
    var flashT;
    function flash(t) { flashEl.textContent = t; flashEl.style.opacity = '1'; clearTimeout(flashT); flashT = setTimeout(function () { flashEl.style.opacity = '0'; }, 700); }
    function updateCamoHud(blend, chased) {
      var fill = document.getElementById('camo-fill'), lbl = document.getElementById('camo-label');
      if (!fill) return;
      fill.style.width = Math.round(blend * 100) + '%';
      var hidden = blend > 0.6 && !chased;
      fill.style.background = chased ? '#e8483b' : (blend > 0.6 ? '#2ec4a6' : (blend > 0.3 ? '#ffc23c' : '#e8483b'));
      lbl.textContent = chased ? 'SPOTTED — RUN!' : (hidden ? 'HIDDEN' : 'EXPOSED');
      lbl.style.color = chased ? '#ffb0a8' : (hidden ? '#bff5e8' : '#fff');
    }

    // colour palette (eyedropper essence): click a swatch to paint yourself
    var palette = document.createElement('div');
    palette.style.cssText = 'position:absolute;bottom:14px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:7px;background:rgba(0,0,0,.4);border:1px solid rgba(255,255,255,.18);border-radius:12px;padding:8px 10px;z-index:5;';
    var swatchEls = [];
    var paletteColors = [0xffffff].concat(crateColors, [GRASS]);
    paletteColors.forEach(function (col) {
      var sw = document.createElement('button');
      sw.style.cssText = 'width:22px;height:22px;border-radius:6px;border:2px solid rgba(255,255,255,.3);cursor:pointer;padding:0;background:#' + ('000000' + col.toString(16)).slice(-6);
      sw.addEventListener('click', function () { setPlayerColor(new THREE.Color(col)); });
      palette.appendChild(sw); swatchEls.push({ el: sw, col: col });
    });
    var eyeHint = document.createElement('span');
    eyeHint.style.cssText = 'font-family:\'Martian Mono\';font-size:10px;color:rgba(255,255,255,.7);margin-left:4px;';
    eyeHint.textContent = 'press E to eyedrop';
    palette.appendChild(eyeHint);
    parent.appendChild(palette);
    function refreshPalette() {
      swatchEls.forEach(function (s) {
        var match = colorDist(playerColor, new THREE.Color(s.col)) < 0.02;
        s.el.style.borderColor = match ? '#fff' : 'rgba(255,255,255,.3)';
        s.el.style.transform = match ? 'scale(1.18)' : 'scale(1)';
      });
    }

    var keymap = { ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down',
      ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right' };
    function onKey(down) {
      return function (e) {
        var ae = document.activeElement; if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) return;
        if (over && down && (e.key === ' ' || keymap[e.key])) { e.preventDefault(); reset(); return; }
        if (down && (e.key === 'e' || e.key === 'E')) { e.preventDefault(); eyedrop(); return; }
        if (e.key === 'Shift') { crouch = down; return; }
        var k = keymap[e.key]; if (!k) return; e.preventDefault(); keys[k] = down;
      };
    }
    var keyDown = onKey(true), keyUp = onKey(false);
    window.addEventListener('keydown', keyDown, true);
    window.addEventListener('keyup', keyUp, true);

    function resize() {
      var r = canvas.getBoundingClientRect(); if (r.width < 4 || r.height < 4) return;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(r.width, r.height, false);
      camera.aspect = r.width / r.height; camera.updateProjectionMatrix();
    }
    window.addEventListener('resize', resize);

    var camPos = new THREE.Vector3();
    function render() {
      camPos.set(player.position.x, 11, player.position.z + 13);
      camera.position.lerp(camPos, 0.12);
      camera.lookAt(player.position.x, 1.5, player.position.z - 2);
      sun.target.position.copy(player.position);
      renderer.render(scene, camera);
    }
    function frame(now) {
      if (last == null) last = now; var dt = Math.min(0.05, (now - last) / 1000); last = now;
      update(dt); render(); raf = requestAnimationFrame(frame);
    }

    resize(); reset(); refreshPalette(); raf = requestAnimationFrame(frame);

    return {
      reset: reset,
      isPaused: function () { return paused; },
      pause: function () { paused = true; if (!over) showOverlay('PAUSED', '', '#ffffff'); },
      resume: function () { paused = false; if (!over) hideOverlay(); last = null; },
      togglePause: function () { if (paused) this.resume(); else this.pause(); return paused; },
      resize: resize,
      dispose: function () {
        cancelAnimationFrame(raf);
        window.removeEventListener('keydown', keyDown, true);
        window.removeEventListener('keyup', keyUp, true);
        window.removeEventListener('resize', resize);
        [overlay, camo, flashEl, palette].forEach(function (el) { if (el.parentElement) el.parentElement.removeChild(el); });
        renderer.dispose();
      }
    };
  }

  (root.EZGames || (root.EZGames = {})).hideout = { mount: mount };
})(window);
