/* ===== EZ shared 3D asset loader — EZModels =====
 * A tiny wrapper around three's GLTFLoader (+ DRACO) that the EZ games use to
 * pull real glTF/GLB models (e.g. vendored Poly Pizza assets) at runtime.
 *
 * Design goals:
 *   - fetch + cache GLBs (one network/decode per URL, cloned per instance)
 *   - auto-center on the origin and sit the model on the ground (y = 0)
 *   - auto-scale to a target size so wildly different source models drop in
 *   - graceful fallback: load() resolves to null on any failure so callers
 *     can keep their existing procedural meshes. Nothing throws.
 *
 * Exposed both as an ES module export and as window.EZModels.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

// DRACO decoder is vendored locally so the loader is fully self-contained.
var draco = new DRACOLoader();
draco.setDecoderPath('./vendor/jsm/libs/draco/gltf/');

var gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(draco);

// url -> Promise<THREE.Object3D>  (the pristine, un-prepared source scene)
var cache = new Map();

function fetchScene(url) {
  if (cache.has(url)) return cache.get(url);
  var p = new Promise(function (resolve, reject) {
    gltfLoader.load(url, function (gltf) { resolve(gltf.scene); }, undefined, reject);
  }).catch(function (err) {
    cache.delete(url);            // allow a later retry
    throw err;
  });
  cache.set(url, p);
  return p;
}

/* Center horizontally on the origin, sit the base at y=0, optionally scale to a
 * target max-dimension, rotate, and wire up shadows. Returns a wrapper Group so
 * the caller can position/rotate freely without disturbing the fit transform. */
function prepare(model, opts) {
  opts = opts || {};
  var wrap = new THREE.Group();

  model.updateWorldMatrix(true, true);
  var box = new THREE.Box3().setFromObject(model);
  var size = box.getSize(new THREE.Vector3());
  var center = box.getCenter(new THREE.Vector3());

  // recenter the source so it's centered in x/z with its base on the ground
  model.position.x += -center.x;
  model.position.z += -center.z;
  model.position.y += -box.min.y;
  if (opts.rotationY != null) model.rotation.y = opts.rotationY;
  wrap.add(model);

  if (opts.size) {
    var maxDim = Math.max(size.x, size.y, size.z) || 1;
    wrap.scale.setScalar(opts.size / maxDim);
  }

  var cast = opts.castShadow !== false;
  var receive = opts.receiveShadow !== false;
  var envI = opts.envMapIntensity;
  model.traverse(function (o) {
    if (!o.isMesh) return;
    o.castShadow = cast;
    o.receiveShadow = receive;
    if (envI != null && o.material) {
      var mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach(function (m) { if ('envMapIntensity' in m) m.envMapIntensity = envI; });
    }
  });

  wrap.userData.modelSize = size.clone();
  return wrap;
}

/* Load + prepare a model. Resolves to a ready-to-add THREE.Group, or null on
 * any error (missing file, bad network, decode failure). Never throws. */
function load(url, opts) {
  if (!url) return Promise.resolve(null);
  return fetchScene(url).then(function (scene) {
    return prepare(scene.clone(true), opts);
  }).catch(function (err) {
    if (typeof console !== 'undefined') console.warn('[EZModels] using fallback for', url, err && err.message ? err.message : err);
    return null;
  });
}

/* Convenience: load a model, or fall back to building a procedural one.
 * builder() is only called when the model can't be loaded. */
function loadOrBuild(url, builder, opts) {
  return load(url, opts).then(function (m) { return m || builder(); });
}

var EZModels = { load: load, loadOrBuild: loadOrBuild, prepare: prepare, _cache: cache };

if (typeof window !== 'undefined') window.EZModels = EZModels;

export { EZModels, load, loadOrBuild, prepare };
export default EZModels;
