/* ===== EZ flagship — APEX DRIFT (3D, high-graphics) =====
 * A stylized neon-night racer on Three.js, pushed to the ceiling a browser
 * allows: HDR tone mapping, an image-based environment for real reflections,
 * dynamic shadows, and a UnrealBloom post-processing pass so every neon edge
 * actually glows. Not photoreal Forza — but a genuine leap over flat boxes.
 * Exposed as window.EZCar.mount(canvas, opts) -> controller.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

(function (root) {
  'use strict';

  var ACCENT = 0xCB2957;

  function mount(canvas, opts) {
    opts = opts || {};
    var parent = canvas.parentElement;

    // ---- renderer: HDR pipeline ----
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setClearColor(0x04040a, 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    var scene = new THREE.Scene();
    scene.background = new THREE.Color(0x05060f);
    scene.fog = new THREE.Fog(0x05060f, 55, 165);

    // image-based lighting for metal/glass reflections
    var pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    var camera = new THREE.PerspectiveCamera(60, 1, 0.1, 500);
    camera.position.set(0, 5.5, 14);

    // ---- lights ----
    scene.add(new THREE.HemisphereLight(0x3a4a7a, 0x07070d, 0.55));
    var key = new THREE.DirectionalLight(0xbfd4ff, 1.6);
    key.position.set(-12, 26, 8);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 1; key.shadow.camera.far = 90;
    key.shadow.camera.left = -22; key.shadow.camera.right = 22;
    key.shadow.camera.top = 30; key.shadow.camera.bottom = -30;
    key.shadow.bias = -0.0004;
    scene.add(key);
    scene.add(key.target);
    var accentLight = new THREE.PointLight(ACCENT, 2.4, 70, 1.6);
    accentLight.position.set(0, 7, 4);
    scene.add(accentLight);

    // ---- ground + road ----
    var ground = new THREE.Mesh(
      new THREE.PlaneGeometry(400, 700),
      new THREE.MeshStandardMaterial({ color: 0x07080f, roughness: 0.95, metalness: 0.0 })
    );
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; ground.receiveShadow = true;
    scene.add(ground);

    var roadW = 9;
    var road = new THREE.Mesh(
      new THREE.PlaneGeometry(roadW, 700),
      new THREE.MeshStandardMaterial({ color: 0x0a0b12, roughness: 0.35, metalness: 0.65, envMapIntensity: 0.8 })
    );
    road.rotation.x = -Math.PI / 2; road.position.y = 0; road.receiveShadow = true;
    scene.add(road);

    // glowing lane edges
    var edgeMat = new THREE.MeshStandardMaterial({ color: ACCENT, emissive: ACCENT, emissiveIntensity: 2.2, roughness: 0.4 });
    [-1, 1].forEach(function (s) {
      var edge = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 700), edgeMat);
      edge.position.set(s * roadW / 2, 0.04, 0); scene.add(edge);
    });

    var FAR = -240, NEAR = 18;

    // center dashes
    var dashes = [];
    var dashGeo = new THREE.BoxGeometry(0.3, 0.04, 3.2);
    var dashMat = new THREE.MeshStandardMaterial({ color: 0xEEEEEE, emissive: 0x888888, emissiveIntensity: 0.6, roughness: 0.5 });
    for (var i = 0; i < 44; i++) {
      var d = new THREE.Mesh(dashGeo, dashMat);
      d.position.set(0, 0.05, FAR + i * 6); scene.add(d); dashes.push(d);
    }

    // neon side posts (cast light feel via emissive + bloom)
    var posts = [];
    var postGeo = new THREE.BoxGeometry(0.22, 2.0, 0.22);
    var postMat = new THREE.MeshStandardMaterial({ color: ACCENT, emissive: ACCENT, emissiveIntensity: 2.6, roughness: 0.35 });
    for (var p = 0; p < 70; p++) {
      var side = (p % 2 === 0) ? -1 : 1;
      var post = new THREE.Mesh(postGeo, postMat);
      post.position.set(side * (roadW / 2 + 0.7), 1.0, FAR + Math.floor(p / 2) * 7); scene.add(post); posts.push(post);
    }

    // ---- neon city skyline (atmosphere) ----
    var buildings = [];
    var winMat = new THREE.MeshStandardMaterial({ color: 0x0a0c18, emissive: 0x142036, emissiveIntensity: 1.0, roughness: 0.6, metalness: 0.3 });
    var accentWinMat = new THREE.MeshStandardMaterial({ color: 0x12060c, emissive: ACCENT, emissiveIntensity: 0.9, roughness: 0.5 });
    for (var b = 0; b < 30; b++) {
      var side2 = (b % 2 === 0) ? -1 : 1;
      var hgt = 8 + Math.random() * 26;
      var bld = new THREE.Mesh(
        new THREE.BoxGeometry(3 + Math.random() * 4, hgt, 3 + Math.random() * 4),
        Math.random() < 0.25 ? accentWinMat : winMat
      );
      bld.position.set(side2 * (12 + Math.random() * 18), hgt / 2, FAR + Math.floor(b / 2) * 16);
      bld.castShadow = false; scene.add(bld); buildings.push(bld);
    }

    // ---- car builder ----
    function buildCar(bodyColor, emissive, glow) {
      var g = new THREE.Group();
      var paint = new THREE.MeshStandardMaterial({ color: bodyColor, metalness: 0.85, roughness: 0.28, envMapIntensity: 1.4, emissive: emissive || 0x000000, emissiveIntensity: glow ? 0.35 : 0 });
      var glass = new THREE.MeshStandardMaterial({ color: 0x0a0e16, metalness: 1.0, roughness: 0.08, envMapIntensity: 1.6 });

      // lower body
      var body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.45, 4.0), paint);
      body.position.y = 0.5; body.castShadow = true; g.add(body);
      // hood/trunk taper
      var hood = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.32, 1.4), paint);
      hood.position.set(0, 0.78, -1.15); hood.castShadow = true; g.add(hood);
      var trunk = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.34, 1.1), paint);
      trunk.position.set(0, 0.78, 1.25); trunk.castShadow = true; g.add(trunk);
      // cabin
      var cabin = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.62, 1.7), glass);
      cabin.position.set(0, 1.08, 0.0); cabin.castShadow = true; g.add(cabin);
      // side skirts / accent strip
      var strip = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.08, 4.04),
        new THREE.MeshStandardMaterial({ color: emissive || ACCENT, emissive: emissive || ACCENT, emissiveIntensity: 1.8, roughness: 0.4 }));
      strip.position.y = 0.4; g.add(strip);
      // wheels with rims
      var tyreGeo = new THREE.CylinderGeometry(0.46, 0.46, 0.34, 20);
      var tyreMat = new THREE.MeshStandardMaterial({ color: 0x0c0c10, roughness: 0.85 });
      var rimMat = new THREE.MeshStandardMaterial({ color: 0xcfd3dc, metalness: 1.0, roughness: 0.2, envMapIntensity: 1.6 });
      var wpos = [[-1.02, -1.35], [1.02, -1.35], [-1.02, 1.35], [1.02, 1.35]];
      g.wheels = [];
      wpos.forEach(function (w) {
        var wheel = new THREE.Group();
        var tyre = new THREE.Mesh(tyreGeo, tyreMat); tyre.rotation.z = Math.PI / 2; tyre.castShadow = true;
        var rim = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.36, 8), rimMat); rim.rotation.z = Math.PI / 2;
        wheel.add(tyre); wheel.add(rim);
        wheel.position.set(w[0], 0.46, w[1]); g.add(wheel); g.wheels.push(wheel);
      });
      // tail lights
      var tl = new THREE.MeshStandardMaterial({ color: 0xff2a2a, emissive: 0xff2a2a, emissiveIntensity: 3.0 });
      [-0.6, 0.6].forEach(function (x) {
        var lamp = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.08), tl);
        lamp.position.set(x, 0.7, 2.02); g.add(lamp);
      });
      // headlights
      var hlMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2cc, emissiveIntensity: 3.0 });
      [-0.62, 0.62].forEach(function (x) {
        var lamp = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.08), hlMat);
        lamp.position.set(x, 0.7, -2.02); g.add(lamp);
      });
      return g;
    }

    var car = buildCar(ACCENT, ACCENT, true);
    car.position.set(0, 0, 4); scene.add(car);
    var headBeam = new THREE.SpotLight(0xfff0d0, 6, 45, Math.PI / 7, 0.5, 1.2);
    headBeam.position.set(0, 1.2, -1.8); headBeam.target.position.set(0, 0, -20);
    car.add(headBeam); car.add(headBeam.target);

    // ---- traffic ----
    var traffic = [];
    var trafficColors = [0xdfe6f2, 0x2f8fff, 0xffb020, 0x35d6a0];
    function lanePos() { return (Math.floor(Math.random() * 3) - 1) * 2.6; }
    function resetTraffic(rc, z) { rc.position.set(lanePos(), 0, z); }
    for (var c = 0; c < 8; c++) {
      var rc = buildCar(trafficColors[c % trafficColors.length], 0x000000, false);
      rc.scale.setScalar(0.97); resetTraffic(rc, FAR - Math.random() * 150);
      scene.add(rc); traffic.push(rc);
    }

    // ---- post-processing (bloom) ----
    var composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    var bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.85, 0.6, 0.82);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());

    // ---- HUD overlay ----
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;gap:10px;font-family:\'Martian Mono\',monospace;text-align:center;pointer-events:none;z-index:3;';
    parent.appendChild(overlay);
    function showOverlay(title, sub, color) {
      overlay.innerHTML = '<div style="font-size:40px;font-weight:800;color:' + color + ';text-shadow:0 0 30px ' + color + '">' + title + '</div>' +
        (sub ? '<div style="font-family:\'Space Grotesk\',sans-serif;font-size:14px;color:rgba(238,238,238,0.65)">' + sub + '</div>' : '');
      overlay.style.display = 'flex';
    }
    function hideOverlay() { overlay.style.display = 'none'; }

    // ---- state & sim ----
    var input = { left: false, right: false, accel: false, brake: false };
    var carX = 0, targetX = 0, lateralV = 0;
    var speed = 0, baseCruise = 38, maxSpeed = 100;
    var distance = 0, best = 0, over = false, paused = false, raf = 0, last = null;

    function reportScore() {
      var sc = Math.floor(distance / 8);
      if (opts.onScore) opts.onScore(sc);
      if (sc > best) { best = sc; if (opts.onBest) opts.onBest(best); }
    }
    function reset() {
      carX = 0; targetX = 0; lateralV = 0; speed = 0; distance = 0; over = false; paused = false; maxSpeed = 100;
      car.position.set(0, 0, 4); car.rotation.set(0, 0, 0);
      traffic.forEach(function (rc) { resetTraffic(rc, FAR - Math.random() * 160); });
      hideOverlay(); if (opts.onScore) opts.onScore(0);
    }

    var keymap = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right',
      ArrowUp: 'accel', w: 'accel', W: 'accel', ArrowDown: 'brake', s: 'brake', S: 'brake' };
    function onKey(down) {
      return function (e) {
        var ae = document.activeElement;
        if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) return;
        if (over && down && (e.key === ' ' || keymap[e.key])) { e.preventDefault(); reset(); return; }
        var k = keymap[e.key]; if (!k) return; e.preventDefault(); input[k] = down;
      };
    }
    var keyDown = onKey(true), keyUp = onKey(false);
    window.addEventListener('keydown', keyDown, true);
    window.addEventListener('keyup', keyUp, true);

    function resize() {
      var r = canvas.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) return;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      renderer.setPixelRatio(dpr); renderer.setSize(r.width, r.height, false);
      composer.setPixelRatio(dpr); composer.setSize(r.width, r.height);
      bloom.setSize(r.width, r.height);
      camera.aspect = r.width / r.height; camera.updateProjectionMatrix();
    }
    window.addEventListener('resize', resize);

    function update(dt) {
      if (over || paused) return;
      var want = input.accel ? maxSpeed : (input.brake ? 12 : baseCruise);
      speed += (want - speed) * Math.min(1, dt * 1.6);
      maxSpeed = Math.min(128, maxSpeed + dt * 1.1);
      distance += speed * dt;

      var steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
      lateralV += steer * dt * 36; lateralV *= 0.86;
      targetX += lateralV * dt; targetX = Math.max(-3.4, Math.min(3.4, targetX));
      carX += (targetX - carX) * Math.min(1, dt * 10);
      car.position.x = carX;
      car.rotation.z = -lateralV * 0.045;
      car.rotation.y = (targetX - carX) * 0.16;
      car.wheels.forEach(function (w) { w.rotation.x -= speed * dt * 0.6; });

      var dz = speed * dt;
      for (var i = 0; i < dashes.length; i++) { dashes[i].position.z += dz; if (dashes[i].position.z > NEAR) dashes[i].position.z += FAR - NEAR; }
      for (var pp = 0; pp < posts.length; pp++) { posts[pp].position.z += dz; if (posts[pp].position.z > NEAR) posts[pp].position.z += FAR - NEAR; }
      for (var bb = 0; bb < buildings.length; bb++) { buildings[bb].position.z += dz; if (buildings[bb].position.z > NEAR + 10) buildings[bb].position.z += FAR - NEAR - 60; }
      for (var t = 0; t < traffic.length; t++) {
        var rc = traffic[t];
        rc.position.z += dz * 0.76;
        if (rc.position.z > NEAR) resetTraffic(rc, rc.position.z + FAR - NEAR);
        if (Math.abs(rc.position.z - car.position.z) < 2.6 && Math.abs(rc.position.x - carX) < 1.7) crash();
      }
      reportScore();
    }

    function crash() {
      over = true; speed = 0;
      showOverlay('CRASHED', 'press space or an arrow key to restart', '#CB2957');
      if (opts.onState) opts.onState('over');
    }

    var camPos = new THREE.Vector3();
    function render() {
      camPos.set(carX * 0.6, 5.2, car.position.z + 12.5);
      camera.position.lerp(camPos, 0.09);
      camera.lookAt(carX * 0.3, 1.3, car.position.z - 16);
      accentLight.position.x = carX;
      key.target.position.set(carX, 0, car.position.z - 6);
      composer.render();
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
        composer.dispose(); pmrem.dispose(); renderer.dispose();
      }
    };
  }

  root.EZCar = { mount: mount };
  (root.EZGames || (root.EZGames = {})).apex = { mount: mount };
})(window);
