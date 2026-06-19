/* ===== Meccha Chameleon — Engine =====
 * Wraps the WebGL renderer, scene, camera and the post-processing pipeline
 * (SSAO, bloom, colour-grade, SMAA, ACES tone-map). Quality is a live setting
 * so we can keep 60fps on weak hardware by dropping passes, not the game.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// Warm cinematic colour grade: lifts shadows a touch, gentle contrast-S, warm
// highlights, subtle vignette. Cheap full-screen pass.
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uWarm:    { value: 0.06 },
    uContrast:{ value: 1.06 },
    uSat:     { value: 1.07 },
    uVignette:{ value: 0.9 },
    uTime:    { value: 0 },
    uTick:    { value: 0 } // 0..1 final-seconds pulse
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `
    varying vec2 vUv; uniform sampler2D tDiffuse;
    uniform float uWarm,uContrast,uSat,uVignette,uTime,uTick;
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      // contrast around mid grey
      c = (c - 0.5) * uContrast + 0.5;
      // saturation
      float l = dot(c, vec3(0.299,0.587,0.114));
      c = mix(vec3(l), c, uSat);
      // warm grade
      c.r += uWarm; c.b -= uWarm*0.7;
      // vignette
      vec2 d = vUv - 0.5;
      float v = smoothstep(0.85, uVignette*0.35, dot(d,d)*2.0);
      c *= mix(1.0, v, 0.55);
      // subtle film grain for a filmic, less "digital" look
      float grain = fract(sin(dot(vUv * (uTime + 1.0), vec2(12.9898, 78.233))) * 43758.5453);
      c += (grain - 0.5) * 0.018;
      // final-seconds red tick vignette
      if(uTick > 0.0){
        float pulse = 0.5 + 0.5*sin(uTime*12.0);
        float ring = smoothstep(0.15, 0.6, dot(d,d)*2.2);
        c = mix(c, c*vec3(1.0,0.55,0.5)+vec3(0.18,0.0,0.0)*ring, uTick*ring*(0.5+0.5*pulse));
      }
      gl_FragColor = vec4(clamp(c,0.0,1.0), 1.0);
    }`
};

export class Engine {
  constructor(canvas, quality) {
    this.canvas = canvas;
    this.quality = quality || 'high';
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: this.quality === 'low', powerPreference: 'high-performance' });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer = renderer;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(52, 1, 0.1, 400);
    this.camera.position.set(0, 10, 14);

    this._buildComposer();
    this.resize();
  }

  _buildComposer() {
    const { renderer, scene, camera } = this;
    const size = new THREE.Vector2();
    renderer.getSize(size);
    const composer = new EffectComposer(renderer);
    composer.setPixelRatio(this.dpr);
    composer.addPass(new RenderPass(scene, camera));

    this.ssao = null; this.bloom = null; this.smaa = null;
    const q = this.quality;

    if (q === 'high') {
      // SSAO is the heaviest pass and the most likely to fail on odd drivers —
      // never let it take the whole game down, just skip it if it throws.
      try {
        const ssao = new SSAOPass(scene, camera, size.x, size.y);
        ssao.kernelRadius = 0.6; ssao.minDistance = 0.002; ssao.maxDistance = 0.08;
        ssao.output = SSAOPass.OUTPUT.Default;
        composer.addPass(ssao); this.ssao = ssao;
      } catch (e) { console.warn('[chameleon] SSAO unavailable, skipping', e); }
    }
    if (q === 'high' || q === 'medium') {
      const bloom = new UnrealBloomPass(size, 0.55, 0.7, 0.85);
      composer.addPass(bloom); this.bloom = bloom;
    }

    const grade = new ShaderPass(GradeShader);
    composer.addPass(grade); this.grade = grade;

    if (q === 'high' || q === 'medium') {
      const smaa = new SMAAPass(size.x * this.dpr, size.y * this.dpr);
      composer.addPass(smaa); this.smaa = smaa;
    }
    composer.addPass(new OutputPass());
    this.composer = composer;
  }

  setQuality(q) {
    if (q === this.quality) return;
    this.quality = q;
    this.dpr = q === 'low' ? Math.min(window.devicePixelRatio || 1, 1.25) : Math.min(window.devicePixelRatio || 1, 2);
    if (this.composer) this.composer.dispose && this.composer.dispose();
    this.renderer.shadowMap.enabled = q !== 'low';
    this._buildComposer();
    this.resize();
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return;
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(r.width, r.height, false);
    this.camera.aspect = r.width / r.height;
    this.camera.updateProjectionMatrix();
    // composer.setSize propagates the DPR-scaled size to every pass (SSAO,
    // bloom, SMAA included), so we don't resize them individually.
    if (this.composer) { this.composer.setPixelRatio(this.dpr); this.composer.setSize(r.width, r.height); }
  }

  render(dt, tickAmount) {
    this.grade.uniforms.uTime.value += dt;
    this.grade.uniforms.uTick.value += (((tickAmount || 0) - this.grade.uniforms.uTick.value)) * Math.min(1, dt * 6);
    this.composer.render();
  }

  dispose() {
    if (this.composer && this.composer.dispose) this.composer.dispose();
    this.renderer.dispose();
  }
}
