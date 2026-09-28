// PULSE iso3d · ink outlines from normal and depth discontinuities (for the clean-vector and warm-toon looks)
import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

const EdgeShader = {
  uniforms: { tDiffuse: { value: null }, tNormal: { value: null }, tDepth: { value: null }, resolution: { value: new THREE.Vector2() },
    color: { value: new THREE.Color('#1F2536') }, strength: { value: 1 }, thickness: { value: 1 }, depthRange: { value: 100 }, wobble: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse, tNormal, tDepth; uniform vec2 resolution; uniform vec3 color; uniform float strength, thickness, depthRange, wobble;
    float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
    float vn(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f); return mix(mix(h2(i),h2(i+vec2(1,0)),u.x), mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),u.x), u.y); }
    varying vec2 vUv;
    float D(vec2 uv){ return texture2D(tDepth, uv).x * depthRange; }
    vec3 N(vec2 uv){ return texture2D(tNormal, uv).xyz * 2.0 - 1.0; }
    void main(){
      vec4 base = texture2D(tDiffuse, vUv);
      vec2 px = thickness / resolution;
      vec2 wv = (vec2(vn(vUv*vec2(90.0,50.0)), vn(vUv*vec2(90.0,50.0)+13.7)) - 0.5) * wobble / resolution * (resolution.y/1080.0);
      vec2 uv0 = vUv + wv;
      float d0 = D(uv0); vec3 n0 = N(uv0);
      float ed = 0.0, en = 0.0;
      vec2 offs[4]; offs[0] = vec2(px.x, 0.0); offs[1] = vec2(-px.x, 0.0); offs[2] = vec2(0.0, px.y); offs[3] = vec2(0.0, -px.y);
      for (int i = 0; i < 4; i++) {
        float d = D(uv0 + offs[i]); vec3 n = N(uv0 + offs[i]);
        ed = max(ed, abs(d - d0));
        en = max(en, 1.0 - clamp(dot(n, n0), 0.0, 1.0));
      }
      float edge = max(smoothstep(0.06, 0.14, ed), smoothstep(0.18, 0.42, en));
      gl_FragColor = vec4(mix(base.rgb, color, edge * strength), base.a);
    }`
};

export class EdgePass extends Pass {
  constructor(scene, camera, w, h, opts) {
    super();
    this.scene = scene; this.camera = camera;
    this.normalMat = new THREE.MeshNormalMaterial();
    this.rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType });
    this.rt.depthTexture = new THREE.DepthTexture(w, h); this.rt.depthTexture.type = THREE.FloatType;
    this.mat = new THREE.ShaderMaterial({ uniforms: THREE.UniformsUtils.clone(EdgeShader.uniforms), vertexShader: EdgeShader.vertexShader, fragmentShader: EdgeShader.fragmentShader });
    this.mat.uniforms.color.value.set(opts.color); this.mat.uniforms.strength.value = opts.strength; this.mat.uniforms.thickness.value = opts.thickness;
    this.mat.uniforms.wobble.value = opts.wobble || 0;
    this.mat.uniforms.resolution.value.set(w, h);
    this.quad = new FullScreenQuad(this.mat);
    this.hidden = [];
  }
  setSize(w, h) { this.rt.setSize(w, h); this.mat.uniforms.resolution.value.set(w, h); }
  render(renderer, writeBuffer, readBuffer) {
    const bg = this.scene.background, ov = this.scene.overrideMaterial;
    const hide = []; this.scene.traverse(o => { if (o.userData.noEdge && o.visible) { o.visible = false; hide.push(o); } });
    this.scene.background = null; this.scene.overrideMaterial = this.normalMat;
    const cc = renderer.getClearColor(new THREE.Color()), ca = renderer.getClearAlpha();
    renderer.setClearColor(0x8080ff, 1); renderer.setRenderTarget(this.rt); renderer.clear(); renderer.render(this.scene, this.camera);
    renderer.setClearColor(cc, ca);
    this.scene.background = bg; this.scene.overrideMaterial = ov; for (const o of hide) o.visible = true;
    this.mat.uniforms.tDiffuse.value = readBuffer.texture; this.mat.uniforms.tNormal.value = this.rt.texture; this.mat.uniforms.tDepth.value = this.rt.depthTexture;
    this.mat.uniforms.depthRange.value = this.camera.far - this.camera.near;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer); this.quad.render(renderer);
  }
}

// ---------- painterly finishes: watercolour, paper, pencil, blueprint ----------
const STY = `
  uniform sampler2D tDiffuse, tMask; uniform vec2 resolution; uniform int mode; uniform vec3 paper, ink; uniform float satAmt, washAmt, hatchAmt, brush;
  varying vec2 vUv;
  float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
  float vn(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f); return mix(mix(h2(i),h2(i+vec2(1,0)),u.x), mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),u.x), u.y); }
  float fbm(vec2 p){ float a=0.5, s=0.0; for(int i=0;i<5;i++){ s+=a*vn(p); p*=2.03; a*=0.5; } return s; }
  float lum(vec3 c){ return dot(c, vec3(0.299,0.587,0.114)); }
  vec3 toG(vec3 c){ return pow(max(c, 0.0), vec3(1.0/2.2)); } vec3 toL(vec3 c){ return pow(max(c, 0.0), vec3(2.2)); }
  vec3 T(vec2 uv){ return toG(texture2D(tDiffuse, uv).rgb); }
  void main(){
    vec2 px = 1.0/resolution; float k = resolution.y/1080.0; vec2 sp = vUv*resolution/k; vec3 pap = toG(paper);
    float grain = 0.95 + 0.05*fbm(sp*0.35) + 0.03*(vn(sp*1.6)-0.5);
    if (mode == 1) { // watercolour
      vec2 uv = vUv + (vec2(fbm(vUv*vec2(7.0,4.0)), fbm(vUv*vec2(7.0,4.0)+9.1)) - 0.5) * 5.0*px*k;
      vec3 c = T(uv); vec3 a = vec3(0.0);
      for (int i = 0; i < 8; i++) { float an = float(i)*0.785; a += T(uv + vec2(cos(an),sin(an))*2.0*px*k); } a /= 8.0;
      float diff = length(c - a);
      vec3 w = mix(c, a, 0.35);
      w = mix(vec3(lum(w)), w, 1.15);
      w *= 1.0 - 0.3*smoothstep(0.02, 0.14, diff);
      w *= 0.94 + 0.12*fbm(vUv*vec2(26.0,15.0));
      w = mix(w, pap, 0.05 + 0.06*fbm(vUv*vec2(11.0,6.0)));
      gl_FragColor = vec4(toL(w*grain), 1.0);
    } else if (mode == 2) { // paper cut
      vec3 c = T(vUv);
      float fib = 0.97 + 0.03*vn(sp*vec2(0.12,1.4)) + 0.025*(fbm(sp*0.08)-0.5);
      gl_FragColor = vec4(toL(c*fib*(0.98+0.02*grain)), 1.0);
    } else if (mode == 3) { // pencil storyboard
      vec3 c = T(vUv); float l = lum(c);
      vec2 q = sp; float sc = 7.0;
      float l1 = 1.0 - smoothstep(0.12, 0.3, abs(fract((q.x+q.y)/sc)-0.5));
      float l2 = 1.0 - smoothstep(0.12, 0.3, abs(fract((q.x-q.y)/sc)-0.5));
      float l3 = 1.0 - smoothstep(0.12, 0.32, abs(fract(q.y/(sc*0.8))-0.5));
      float jitter = 0.7 + 0.6*vn(q*0.04);
      float g = 1.0 - (l1*(1.0-smoothstep(0.46,0.54,l)) + l2*(1.0-smoothstep(0.3,0.38,l)) + l3*(1.0-smoothstep(0.16,0.24,l)))*hatchAmt*jitter;
      vec3 wash = mix(vec3(1.0), clamp(mix(vec3(l), c, satAmt), 0.0, 1.0), washAmt);
      gl_FragColor = vec4(toL(pap * g * wash * grain), 1.0);
    } else if (mode == 5) { // oil paint: stamped brush strokes with bristle ridges, lit as raised paint
      float cell = brush*2.0; vec2 g = sp/cell; vec2 gi = floor(g);
      float best = -1.0; vec3 col = T(vUv); vec2 grad = vec2(0.0); float cover = 0.0;
      for (int j = -2; j <= 2; j++) { for (int i = -2; i <= 2; i++) {
        vec2 cid = gi + vec2(float(i), float(j));
        vec2 ctr = (cid + 0.5 + (vec2(h2(cid), h2(cid + 17.3)) - 0.5)*0.9)*cell;
        vec2 cuv = ctr*k/resolution;
        vec3 cc = T(cuv); vec2 e1 = vec2(cell*0.5*k, 0.0)/resolution, e2 = vec2(0.0, cell*0.5*k)/resolution;
        float con = length(T(cuv + e1) - T(cuv - e1)) + length(T(cuv + e2) - T(cuv - e2));
        float shrink = mix(1.0, 0.4, smoothstep(0.06, 0.28, con));
        float ang = 0.55 + 1.0*(fbm(ctr/(cell*10.0)) - 0.5) + (h2(cid + 5.1) - 0.5)*0.6;
        vec2 d = vec2(cos(ang), sin(ang)), pd = vec2(-d.y, d.x); vec2 rel = sp - ctr;
        float u = dot(rel, d), v = dot(rel, pd);
        float L = cell*(1.25 + 0.6*h2(cid + 2.2))*shrink, Wd = cell*(0.42 + 0.16*h2(cid + 3.3))*shrink;
        float e = (u*u)/(L*L) + (v*v)/(Wd*Wd);
        float pri = h2(cid + 9.9) + (1.0 - shrink);
        if (e < 1.0 && pri > best) {
          best = pri; cover = 1.0;
          float ph = h2(cid)*6.28, fr = 9.0; float rg = 0.5 + 0.5*sin(v/Wd*fr + ph + u*0.05);
          float prof = 1.0 - e;
          float dpu = -2.0*u/(L*L), dpv = -2.0*v/(Wd*Wd), drv = 0.5*cos(v/Wd*fr + ph + u*0.05)*(fr/Wd);
          float dhu = dpu*(0.72 + 0.28*rg), dhv = dpv*(0.72 + 0.28*rg) + prof*0.28*drv;
          grad = dhu*d + dhv*pd;
          col = cc*(0.95 + 0.1*h2(cid + 4.4)); col *= 0.975 + 0.05*rg; col = mix(col, T(vUv), smoothstep(0.55, 1.0, e)*0.45);
        } } }
      if (cover < 0.5) col = mix(T(vUv), pap, 0.15);
      vec3 nrm = normalize(vec3(-grad*cell*0.26, 1.0));
      vec3 Ld = normalize(vec3(-0.55, 0.62, 0.56));
      float dif = 0.84 + 0.32*dot(nrm, Ld); float spc = pow(max(0.0, dot(reflect(-Ld, nrm), vec3(0.0, 0.0, 1.0))), 22.0);
      vec3 c = col*dif + vec3(0.08)*spc*smoothstep(0.2, 0.9, lum(col));
      float weave = 0.5 + 0.5*sin(sp.x*1.25)*sin(sp.y*1.25); c *= 0.97 + 0.03*weave;
      c = mix(vec3(lum(c)), c, satAmt); c *= vec3(1.04, 1.0, 0.93);
      vec2 vv = vUv - 0.5; c *= 1.0 - 0.22*dot(vv, vv);
      gl_FragColor = vec4(toL(c), 1.0);
    } else { // blueprint with colour accents
      vec3 c = texture2D(tDiffuse, vUv).rgb; float m = texture2D(tMask, vUv).r; float l = lum(c);
      vec3 bp = mix(vec3(0.09,0.24,0.42), vec3(0.42,0.62,0.85), smoothstep(0.1, 0.95, l));
      float gridA = step(0.985, fract(sp.x/48.0)) + step(0.985, fract(sp.y/48.0));
      bp += vec3(0.05,0.08,0.12)*clamp(gridA,0.0,1.0);
      gl_FragColor = vec4(mix(bp*(0.97+0.03*grain), c, m), 1.0);
    }
  }`;
export class StylizePass extends Pass {
  constructor(scene, camera, w, h, mode, style) {
    super(); this.scene = scene; this.camera = camera; this.modeName = mode;
    const modes = { watercolor: 1, paper: 2, pencil: 3, blueprint: 4, oil: 5 }; const o = style.sty || {};
    this.mat = new THREE.ShaderMaterial({ uniforms: { tDiffuse: { value: null }, tMask: { value: null }, resolution: { value: new THREE.Vector2(w, h) }, mode: { value: modes[mode] }, paper: { value: new THREE.Color(style.bg[0]) }, ink: { value: new THREE.Color('#222') }, satAmt: { value: o.sat ?? 0.75 }, washAmt: { value: o.wash ?? 0.5 }, hatchAmt: { value: o.hatch ?? 0.42 }, brush: { value: o.brush ?? 5 } },
      vertexShader: EdgeShader.vertexShader, fragmentShader: STY });
    this.quad = new FullScreenQuad(this.mat);
    if (mode === 'blueprint') { this.maskRT = new THREE.WebGLRenderTarget(w, h); this.black = new THREE.MeshBasicMaterial({ color: 0x000000 }); this.white = new THREE.MeshBasicMaterial({ color: 0xffffff }); }
  }
  setSize(w, h) { this.mat.uniforms.resolution.value.set(w, h); if (this.maskRT) this.maskRT.setSize(w, h); }
  render(renderer, writeBuffer, readBuffer) {
    if (this.maskRT) { // accents (people, projected light) white, everything else black, depth-correct
      const bg = this.scene.background, ov = this.scene.overrideMaterial, ac = renderer.autoClear;
      this.scene.background = null; renderer.setRenderTarget(this.maskRT); renderer.setClearColor(0x000000, 1); renderer.clear();
      this.scene.overrideMaterial = this.black; renderer.render(this.scene, this.camera);
      renderer.autoClear = false; this.camera.layers.set(1); this.scene.overrideMaterial = this.white; renderer.render(this.scene, this.camera);
      this.camera.layers.set(0); renderer.autoClear = ac; this.scene.overrideMaterial = ov; this.scene.background = bg;
      this.mat.uniforms.tMask.value = this.maskRT.texture;
    }
    this.mat.uniforms.tDiffuse.value = readBuffer.texture;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer); this.quad.render(renderer);
  }
}
