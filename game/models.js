/* ===== Meccha Chameleon — Model loader =====
 * The glTF loading pipeline (Phase 1). Drop a .glb in assets/models/ and call
 * loadModel('./assets/models/foo.glb') — you get back a ready-to-add Object3D
 * with shadows enabled. Draco-compressed models work via the bundled decoder
 * in vendor/draco/. Results are cached and cloned so each placement is cheap.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

const draco = new DRACOLoader().setDecoderPath('./vendor/draco/');
const gltf = new GLTFLoader().setDRACOLoader(draco);
const _cache = new Map();

// load (once) and return a fresh clone you can position/scale/add to a scene
export function loadModel(url) {
  if (!_cache.has(url)) {
    _cache.set(url, gltf.loadAsync(url).then((g) => {
      g.scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = true; } });
      return g.scene;
    }));
  }
  return _cache.get(url).then((scene) => scene.clone(true));
}

// warm the cache for a whole map up-front (use with the loading screen)
export function preload(urls) { return Promise.all((urls || []).map((u) => loadModel(u).catch(() => null))); }

// fit a loaded model to a target height (metres) and drop it on the floor;
// returns { object, size } so you can build a matching collider.
export function normalize(object, targetHeight) {
  const box = new THREE.Box3().setFromObject(object);
  const size = new THREE.Vector3(); box.getSize(size);
  const s = targetHeight ? targetHeight / (size.y || 1) : 1;
  object.scale.setScalar(s);
  const box2 = new THREE.Box3().setFromObject(object);
  object.position.y -= box2.min.y;                 // sit on the ground
  box2.getSize(size);
  return { object, size };
}
