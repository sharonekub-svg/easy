/* ===== EZ game — BLOCK HIDEOUT (3D hide & seek) =====
 * A bright, blocky Roblox-style game — deliberately NOT the site's dark neon
 * palette. You run around a sunny arena and survive a roaming seeker by
 * breaking its line of sight behind colorful crates. Shows EZ can produce a
 * different genre AND a different art direction on demand.
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

    // sunny lighting
    scene.add(new THREE.HemisphereLight(0xdff1ff, 0x4f7a3a, 0.95));
    var sun = new THREE.DirectionalLight(0xfff6e0, 1.7);
    sun.position.set(18, 30, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 90;
    sun.shadow.camera.left = -34; sun.shadow.camera.right = 34;
    sun.shadow.camera.top = 34; sun.shadow.camera.bottom = -34;
    sun.shadow.bias = -0.0004;
    scene.add(sun); scene.add(sun.target);

    var ARENA = 34;
    // grass floor
    var floor = new THREE.Mesh(
      new THREE.PlaneGeometry(ARENA * 2, ARENA * 2),
      new THREE.MeshStandardMaterial({ color: 0x69bf48, roughness: 1 })
    );
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    // checker tint patches for a playful look
    for (var gx = -ARENA; gx < ARENA; gx += 8) {
      for (var gz = -ARENA; gz < ARENA; gz += 8) {
        if (((gx + gz) / 8) % 2 === 0) {
          var patch = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.MeshStandardMaterial({ color: 0x5fb23f, roughness: 1 }));
          patch.rotation.x = -Math.PI / 2; patch.position.set(gx + 4, 0.01, gz + 4); patch.receiveShadow = true; scene.add(patch);
        }
      }
    }
    // border walls
    var wallMat = new THREE.MeshStandardMaterial({ color: 0xf0e6d2, roughness: 0.9 });
    [[0, -ARENA], [0, ARENA], [-ARENA, 0], [ARENA, 0]].forEach(function (p, i) {
      var horiz = i < 2;
      var wall = new THREE.Mesh(new THREE.BoxGeometry(horiz ? ARENA * 2 : 1, 2.4, horiz ? 1 : ARENA * 2), wallMat);
      wall.position.set(p[0], 1.2, p[1]); wall.castShadow = true; wall.receiveShadow = true; scene.add(wall);
    });

    // colorful crates / cover (these block line of sight)
    var crateColors = [0xe8483b, 0x3a7bd5, 0xffc23c, 0xff8a3d, 0x9b59b6, 0x2ec4a6, 0xf25c9a];
    var blocks = [];
    function rand(a, b) { return a + Math.random() * (b - a); }
    for (var b = 0; b < 16; b++) {
      var s = rand(2, 4.5);
      var hgt = rand(1.6, 3.4);
      var crate = new THREE.Mesh(
        new THREE.BoxGeometry(s, hgt, s),
        new THREE.MeshStandardMaterial({ color: crateColors[b % crateColors.length], roughness: 0.7, metalness: 0.05 })
      );
      crate.position.set(rand(-ARENA + 5, ARENA - 5), hgt / 2, rand(-ARENA + 5, ARENA - 5));
      // keep center clear for spawn
      if (Math.hypot(crate.position.x, crate.position.z) < 6) crate.position.x += 9;
      crate.castShadow = true; crate.receiveShadow = true;
      scene.add(crate); blocks.push(crate);
    }

    // ---- blocky avatar builder (Roblox-ish) ----
    function avatar(shirt, head, pants) {
      var g = new THREE.Group();
      var torso = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 0.6), new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.8 }));
      torso.position.y = 1.5; torso.castShadow = true; g.add(torso);
      var hd = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.75, 0.75), new THREE.MeshStandardMaterial({ color: head, roughness: 0.7 }));
      hd.position.y = 2.45; hd.castShadow = true; g.add(hd);
      var legMat = new THREE.MeshStandardMaterial({ color: pants, roughness: 0.85 });
      var armMat = new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.85 });
      g.limbs = [];
      [[-0.75, 'arm'], [0.75, 'arm']].forEach(function (a) {
        var arm = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.05, 0.35), armMat);
        arm.position.set(a[0], 1.45, 0); arm.castShadow = true; g.add(arm); g.limbs.push(arm);
      });
      [[-0.3], [0.3]].forEach(function (l) {
        var leg = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.0, 0.4), legMat);
        leg.position.set(l[0], 0.5, 0); leg.castShadow = true; g.add(leg); g.limbs.push(leg);
      });
      return g;
    }

    var player = avatar(0x2f7bd6, 0xffd9a0, 0x33373d);
    scene.add(player);
    var seeker = avatar(0xd6342a, 0x7a1410, 0x2a0d0b);
    scene.add(seeker);

    // ---- state ----
    var keys = {};
    var raycaster = new THREE.Raycaster();
    var tmp = new THREE.Vector3();
    var pVel = new THREE.Vector3();
    var time = 0, best = 0, over = false, paused = false, raf = 0, last = null;
    var seek = { mode: 'roam', wp: new THREE.Vector3(), lostT: 0 };

    function placeStart() {
      player.position.set(0, 0, 0); player.rotation.y = 0; pVel.set(0, 0, 0);
      seeker.position.set(0, 0, -ARENA + 6); seeker.rotation.y = 0;
      seek.mode = 'roam'; seek.lostT = 0; newWaypoint();
    }
    function newWaypoint() { seek.wp.set(rand(-ARENA + 5, ARENA - 5), 0, rand(-ARENA + 5, ARENA - 5)); }

    function reset() {
      time = 0; over = false; paused = false; placeStart();
      hideOverlay(); if (opts.onScore) opts.onScore(0);
    }

    function canSee(from, to) {
      tmp.copy(to).sub(from); var dist = tmp.length(); tmp.normalize();
      raycaster.set(from.clone().setY(1.4), tmp);
      raycaster.far = dist - 0.6;
      var hits = raycaster.intersectObjects(blocks, false);
      return hits.length === 0;
    }

    function clampArena(v) {
      var lim = ARENA - 1.5;
      v.x = Math.max(-lim, Math.min(lim, v.x));
      v.z = Math.max(-lim, Math.min(lim, v.z));
    }
    function collideBlocks(pos, radius) {
      for (var i = 0; i < blocks.length; i++) {
        var bx = blocks[i]; var hw = bx.geometry.parameters.width / 2 + radius;
        var hd = bx.geometry.parameters.depth / 2 + radius;
        var dx = pos.x - bx.position.x, dz = pos.z - bx.position.z;
        if (Math.abs(dx) < hw && Math.abs(dz) < hd) {
          // push out along smallest overlap
          var ox = hw - Math.abs(dx), oz = hd - Math.abs(dz);
          if (ox < oz) pos.x = bx.position.x + (dx < 0 ? -hw : hw);
          else pos.z = bx.position.z + (dz < 0 ? -hd : hd);
        }
      }
    }

    function bob(g, moving, t) {
      var sw = moving ? Math.sin(t * 10) * 0.5 : 0;
      if (g.limbs) { g.limbs[0].rotation.x = sw; g.limbs[1].rotation.x = -sw; g.limbs[2].rotation.x = -sw; g.limbs[3].rotation.x = sw; }
    }

    function update(dt) {
      if (over || paused) return;
      time += dt;

      // player movement (world-aligned)
      var mx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      var mz = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
      var len = Math.hypot(mx, mz);
      var speed = 10.5;
      if (len > 0) { mx /= len; mz /= len; }
      pVel.set(mx * speed, 0, mz * speed);
      player.position.x += pVel.x * dt;
      player.position.z += pVel.z * dt;
      clampArena(player.position);
      collideBlocks(player.position, 0.6);
      if (len > 0) player.rotation.y = Math.atan2(mx, mz);
      bob(player, len > 0, time);

      // seeker AI
      var toP = tmp.copy(player.position).sub(seeker.position);
      var dP = toP.length();
      var sees = dP < 20 && canSee(seeker.position, player.position);
      if (sees) { seek.mode = 'chase'; seek.lostT = 0; }
      else if (seek.mode === 'chase') { seek.lostT += dt; if (seek.lostT > 1.6) { seek.mode = 'roam'; newWaypoint(); } }

      var target, sSpeed;
      if (seek.mode === 'chase') { target = player.position; sSpeed = 8.6; }
      else {
        target = seek.wp; sSpeed = 5.0;
        if (seeker.position.distanceTo(seek.wp) < 2) newWaypoint();
      }
      var sd = tmp.copy(target).sub(seeker.position); sd.y = 0;
      if (sd.length() > 0.001) {
        sd.normalize();
        seeker.position.x += sd.x * sSpeed * dt;
        seeker.position.z += sd.z * sSpeed * dt;
        clampArena(seeker.position);
        collideBlocks(seeker.position, 0.6);
        seeker.rotation.y = Math.atan2(sd.x, sd.z);
      }
      bob(seeker, true, time * 1.1);

      // caught?
      if (dP < 1.7) caught();

      var sc = Math.floor(time);
      if (opts.onScore) opts.onScore(sc);
      if (sc > best) { best = sc; if (opts.onBest) opts.onBest(best); }
    }

    function caught() {
      over = true;
      showOverlay('CAUGHT!', 'survived ' + Math.floor(time) + 's · press space to retry', '#d6342a');
      if (opts.onState) opts.onState('over');
    }

    // ---- HUD overlay ----
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;gap:8px;font-family:\'Martian Mono\',monospace;text-align:center;pointer-events:none;z-index:3;';
    parent.appendChild(overlay);
    function showOverlay(t, s, c) {
      overlay.innerHTML = '<div style="font-size:42px;font-weight:800;color:' + c + ';text-shadow:0 3px 0 rgba(0,0,0,0.25)">' + t + '</div>' +
        (s ? '<div style="font-family:\'Space Grotesk\',sans-serif;font-size:14px;color:#fff;text-shadow:0 2px 6px rgba(0,0,0,0.5)">' + s + '</div>' : '');
      overlay.style.display = 'flex';
    }
    function hideOverlay() { overlay.style.display = 'none'; }

    var keymap = { ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down',
      ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right' };
    function onKey(down) {
      return function (e) {
        var ae = document.activeElement;
        if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) return;
        if (over && down && (e.key === ' ' || keymap[e.key])) { e.preventDefault(); reset(); return; }
        var k = keymap[e.key]; if (!k) return; e.preventDefault(); keys[k] = down;
      };
    }
    var keyDown = onKey(true), keyUp = onKey(false);
    window.addEventListener('keydown', keyDown, true);
    window.addEventListener('keyup', keyUp, true);

    function resize() {
      var r = canvas.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) return;
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
      if (last == null) last = now;
      var dt = Math.min(0.05, (now - last) / 1000); last = now;
      update(dt); render(); raf = requestAnimationFrame(frame);
    }

    resize(); reset(); raf = requestAnimationFrame(frame);

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
        if (overlay.parentElement) overlay.parentElement.removeChild(overlay);
        renderer.dispose();
      }
    };
  }

  (root.EZGames || (root.EZGames = {})).hideout = { mount: mount };
})(window);
