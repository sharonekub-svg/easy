/* ===== EZ flagship — APEX DRIFT (3D) =====
 * A real-time 3D arcade racer built on Three.js, to show the level EZ aims
 * for: not a 2D toy — a third-person driver with a chase camera, neon city
 * highway, lane traffic to dodge, ramping speed and a crash/restart loop.
 * Exposed as window.EZCar.mount(canvas, opts) -> controller.
 */
import * as THREE from './vendor/three.module.min.js';

(function (root) {
  'use strict';

  var ACCENT = 0xCB2957;
  var INK = 0xDDDDDD;

  function mount(canvas, opts) {
    opts = opts || {};
    var parent = canvas.parentElement;

    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setClearColor(0x05050a, 1);

    var scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x05050a, 40, 150);

    var camera = new THREE.PerspectiveCamera(62, 1, 0.1, 400);
    camera.position.set(0, 5, 13);

    // ---- lights ----
    scene.add(new THREE.HemisphereLight(0x335577, 0x0a0a12, 0.7));
    var dir = new THREE.DirectionalLight(0xffffff, 0.5);
    dir.position.set(-8, 20, 10);
    scene.add(dir);
    var accentLight = new THREE.PointLight(ACCENT, 1.4, 60);
    accentLight.position.set(0, 6, 4);
    scene.add(accentLight);

    // ---- ground grid ----
    var grid = new THREE.GridHelper(600, 150, ACCENT, 0x182030);
    grid.material.transparent = true;
    grid.material.opacity = 0.32;
    scene.add(grid);

    var roadW = 9;
    var road = new THREE.Mesh(
      new THREE.PlaneGeometry(roadW, 600),
      new THREE.MeshStandardMaterial({ color: 0x0c0c12, roughness: 0.9, metalness: 0.1 })
    );
    road.rotation.x = -Math.PI / 2;
    road.position.y = 0.01;
    scene.add(road);

    // ---- recycling helpers (objects flow from far -Z toward the camera +Z) ----
    var FAR = -220, NEAR = 16;

    // center-line dashes
    var dashes = [];
    var dashGeo = new THREE.BoxGeometry(0.32, 0.05, 3.2);
    var dashMat = new THREE.MeshBasicMaterial({ color: 0xEEEEEE });
    for (var i = 0; i < 40; i++) {
      var d = new THREE.Mesh(dashGeo, dashMat);
      d.position.set(0, 0.06, FAR + i * 6);
      scene.add(d); dashes.push(d);
    }

    // neon side posts
    var posts = [];
    var postGeo = new THREE.BoxGeometry(0.25, 1.4, 0.25);
    var postMat = new THREE.MeshStandardMaterial({ color: ACCENT, emissive: ACCENT, emissiveIntensity: 1.1, roughness: 0.4 });
    for (var p = 0; p < 60; p++) {
      var side = (p % 2 === 0) ? -1 : 1;
      var post = new THREE.Mesh(postGeo, postMat);
      post.position.set(side * (roadW / 2 + 0.6), 0.7, FAR + Math.floor(p / 2) * 8);
      scene.add(post); posts.push(post);
    }

    // ---- the player car ----
    function buildCar(bodyColor, emissive) {
      var g = new THREE.Group();
      var body = new THREE.Mesh(
        new THREE.BoxGeometry(1.8, 0.55, 3.6),
        new THREE.MeshStandardMaterial({ color: bodyColor, emissive: emissive || 0x000000, emissiveIntensity: 0.5, metalness: 0.6, roughness: 0.35 })
      );
      body.position.y = 0.55; g.add(body);
      var cabin = new THREE.Mesh(
        new THREE.BoxGeometry(1.4, 0.5, 1.7),
        new THREE.MeshStandardMaterial({ color: 0x0a0a12, metalness: 0.9, roughness: 0.2 })
      );
      cabin.position.set(0, 1.0, -0.2); g.add(cabin);
      var wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 16);
      var wheelMat = new THREE.MeshStandardMaterial({ color: 0x111118, roughness: 0.8 });
      var wpos = [[-0.95, 1.2], [0.95, 1.2], [-0.95, -1.2], [0.95, -1.2]];
      g.wheels = [];
      wpos.forEach(function (w) {
        var wheel = new THREE.Mesh(wheelGeo, wheelMat);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(w[0], 0.42, w[1]); g.add(wheel); g.wheels.push(wheel);
      });
      return g;
    }

    var car = buildCar(ACCENT, ACCENT);
    car.position.set(0, 0, 4);
    scene.add(car);
    // headlights
    var hl = new THREE.PointLight(0xffffff, 0.8, 25);
    hl.position.set(0, 1, 0); car.add(hl);

    // ---- traffic / obstacles ----
    var traffic = [];
    var trafficColors = [0xffffff, 0x44aaff, 0xffaa22];
    for (var c = 0; c < 7; c++) {
      var rc = buildCar(trafficColors[c % trafficColors.length], 0x000000);
      rc.scale.set(0.96, 0.96, 0.96);
      resetTraffic(rc, FAR - Math.random() * 120);
      scene.add(rc); traffic.push(rc);
    }
    function lanePos() { return (Math.floor(Math.random() * 3) - 1) * 2.6; }
    function resetTraffic(rc, z) { rc.position.set(lanePos(), 0, z); }

    // ---- HUD overlay (game over / paused) ----
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;gap:10px;font-family:\'Martian Mono\',monospace;text-align:center;pointer-events:none;z-index:3;';
    parent.appendChild(overlay);
    function showOverlay(title, sub, color) {
      overlay.innerHTML = '<div style="font-size:40px;font-weight:800;color:' + color + ';text-shadow:0 0 26px ' + color + '">' + title + '</div>' +
        (sub ? '<div style="font-family:\'Space Grotesk\',sans-serif;font-size:14px;color:rgba(238,238,238,0.6)">' + sub + '</div>' : '');
      overlay.style.display = 'flex';
    }
    function hideOverlay() { overlay.style.display = 'none'; }

    // ---- state ----
    var input = { left: false, right: false, accel: false, brake: false };
    var carX = 0, targetX = 0, lateralV = 0;
    var speed = 0, baseCruise = 36, maxSpeed = 96;
    var distance = 0, best = 0, over = false, paused = false, raf = 0, last = null;

    function reportScore() {
      var sc = Math.floor(distance / 8);
      if (opts.onScore) opts.onScore(sc);
      if (sc > best) { best = sc; if (opts.onBest) opts.onBest(best); }
    }

    function reset() {
      carX = 0; targetX = 0; lateralV = 0; speed = 0; distance = 0; over = false; paused = false;
      car.position.set(0, 0, 4); car.rotation.set(0, 0, 0);
      traffic.forEach(function (rc) { resetTraffic(rc, FAR - Math.random() * 150); });
      hideOverlay();
      if (opts.onScore) opts.onScore(0);
    }

    var keymap = {
      ArrowLeft: 'left', a: 'left', A: 'left',
      ArrowRight: 'right', d: 'right', D: 'right',
      ArrowUp: 'accel', w: 'accel', W: 'accel',
      ArrowDown: 'brake', s: 'brake', S: 'brake'
    };
    function onKey(down) {
      return function (e) {
        var ae = document.activeElement;
        if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) return;
        if (over && down && (e.key === ' ' || keymap[e.key])) { e.preventDefault(); reset(); return; }
        var k = keymap[e.key];
        if (!k) return;
        e.preventDefault();
        input[k] = down;
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
      camera.aspect = r.width / r.height;
      camera.updateProjectionMatrix();
    }
    window.addEventListener('resize', resize);

    function update(dt) {
      if (over || paused) return;
      // speed
      var want = input.accel ? maxSpeed : (input.brake ? 12 : baseCruise);
      speed += (want - speed) * Math.min(1, dt * 1.6);
      maxSpeed = Math.min(120, maxSpeed + dt * 1.2); // difficulty ramp
      distance += speed * dt;

      // steering
      var steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
      lateralV += steer * dt * 34;
      lateralV *= 0.86;
      targetX += lateralV * dt;
      targetX = Math.max(-3.4, Math.min(3.4, targetX));
      carX += (targetX - carX) * Math.min(1, dt * 10);
      car.position.x = carX;
      car.rotation.z = -lateralV * 0.04;        // body roll
      car.rotation.y = (targetX - carX) * 0.15;  // slight yaw into turn

      // spin wheels
      car.wheels.forEach(function (w) { w.rotation.x -= speed * dt * 0.6; });

      // flow world toward camera
      var dz = speed * dt;
      for (var i = 0; i < dashes.length; i++) { dashes[i].position.z += dz; if (dashes[i].position.z > NEAR) dashes[i].position.z += FAR - NEAR; }
      for (var p = 0; p < posts.length; p++) { posts[p].position.z += dz; if (posts[p].position.z > NEAR) posts[p].position.z += FAR - NEAR; }
      for (var t = 0; t < traffic.length; t++) {
        var rc = traffic[t];
        rc.position.z += dz * 0.78; // traffic moves slower => we overtake
        if (rc.position.z > NEAR + 4) resetTraffic(rc, rc.position.z + FAR - NEAR);
        // collision
        if (Math.abs(rc.position.z - car.position.z) < 2.4 && Math.abs(rc.position.x - carX) < 1.6) {
          crash();
        }
      }
      reportScore();
    }

    function crash() {
      over = true; speed = 0;
      showOverlay('CRASHED', 'press space or an arrow key to restart', '#CB2957');
      if (opts.onState) opts.onState('over');
    }

    function render() {
      // chase camera
      var camTarget = new THREE.Vector3(carX * 0.6, 5, car.position.z + 12);
      camera.position.lerp(camTarget, 0.08);
      camera.lookAt(carX * 0.3, 1.3, car.position.z - 14);
      accentLight.position.x = carX;
      renderer.render(scene, camera);
    }

    function frame(now) {
      if (last == null) last = now;
      var dt = Math.min(0.05, (now - last) / 1000); last = now;
      update(dt);
      render();
      raf = requestAnimationFrame(frame);
    }

    resize();
    reset();
    raf = requestAnimationFrame(frame);

    return {
      reset: reset,
      isPaused: function () { return paused; },
      pause: function () { paused = true; if (!over) showOverlay('PAUSED', '', '#DDDDDD'); },
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

  root.EZCar = { mount: mount };
})(window);
