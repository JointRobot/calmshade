// isokit · articulated procedural people: joints, costumes, faces, poses, two-bone reach, look-at.
// spec: kind man|woman|teacher|girl|boy, h, skin, hair, shirt, pants, saree/border/blouse, outfit 'uniform'|'casual' (kids),
// dress (casual girl), sleeve 'long'|'short' (adults), hat 'sun'|'cap', bag true (backpack), seed.
// Local frame of a person: facing +Z, up +Y, their left = +X. Limbs hang along -Y from each joint.
import * as THREE from 'three';
import { lerp, clamp, smooth } from './util.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const JOINTS = ['pelvis', 'spine', 'chest', 'neck', 'head', 'shL', 'elL', 'shR', 'elR', 'hipL', 'knL', 'ftL', 'hipR', 'knR', 'ftR'];

function lathe(profile, seg = 20) { const pr = profile[0][1] > profile[profile.length - 1][1] ? profile.slice().reverse() : profile; return new THREE.LatheGeometry(pr.map(p => new THREE.Vector2(p[0], p[1])), seg); }
function capsule(r, len, r2) { const g = new THREE.CapsuleGeometry(r, Math.max(0.001, len - 2 * r), 4, 12); g.translate(0, -len / 2, 0); if (r2) { const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = -p.getY(i) / len; const k = lerp(1, r2 / r, clamp(y, 0, 1)); p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); } g.computeVertexNormals(); } return g; }

export function makePerson(spec, mat) {
  const s = Object.assign({ h: 1.7, kind: 'man', skin: '#C98D63', hair: '#2E2320', shirt: '#8FB3CF', pants: '#34384A', saree: '#B8432F', border: '#E0B040', blouse: '#6A2A3A', shoe: '#2A2A30', seed: 1 }, spec);
  const kid = s.kind === 'girl' || s.kind === 'boy'; const h = s.h;
  const saree = (s.kind === 'woman' || s.kind === 'teacher') && s.outfit !== 'casual';
  const uni = kid && (s.outfit || 'uniform') === 'uniform'; const dress = s.kind === 'girl' && !uni ? (s.dress || '#D9953F') : null;
  const D = {
    headR: kid ? 0.1 * h : 0.066 * h, legLen: kid ? 0.42 * h : 0.47 * h, shoulder: kid ? 0.1 * h : 0.1 * h,
    upper: kid ? 0.15 * h : 0.168 * h, fore: kid ? 0.13 * h : 0.148 * h, armR: kid ? 0.03 * h : 0.027 * h, legR: kid ? 0.038 * h : 0.035 * h, neck: 0.028 * h
  };
  D.thigh = D.legLen * 0.5; D.shin = D.legLen * 0.44; D.torso = h - D.legLen - 2 * D.headR - D.neck; D.hipW = D.shoulder * 0.46;
  const skin = mat(s.skin), hair = mat(s.hair), dark = mat('#1E1A1A'), white = mat('#F4F1EA'), navy = mat('#27365A'), shoe = mat(s.shoe);
  const root = new THREE.Group(); const j = {};
  const add = (parent, name, pos) => { const g = new THREE.Group(); g.name = name; g.position.copy(pos); parent.add(g); j[name] = g; return g; };
  const mesh = (parent, geo, m, pos, rot, scl) => { const o = new THREE.Mesh(geo, m); if (pos) o.position.copy(pos); if (rot) o.rotation.set(...rot); if (scl) o.scale.set(...scl); o.castShadow = true; o.receiveShadow = false; parent.add(o); return o; };

  // ---- skeleton
  const pelvis = add(root, 'pelvis', V(0, D.legLen, 0));
  const spine = add(pelvis, 'spine', V(0, 0, 0));
  const chest = add(spine, 'chest', V(0, D.torso * 0.45, 0));
  const neck = add(chest, 'neck', V(0, D.torso * 0.55, 0));
  const head = add(neck, 'head', V(0, D.neck, 0));
  const shL = add(chest, 'shL', V(D.shoulder, D.torso * 0.47, 0)), shR = add(chest, 'shR', V(-D.shoulder, D.torso * 0.47, 0));
  const elL = add(shL, 'elL', V(0, -D.upper, 0)), elR = add(shR, 'elR', V(0, -D.upper, 0));
  const hipL = add(pelvis, 'hipL', V(D.hipW, 0, 0)), hipR = add(pelvis, 'hipR', V(-D.hipW, 0, 0));
  const knL = add(hipL, 'knL', V(0, -D.thigh, 0)), knR = add(hipR, 'knR', V(0, -D.thigh, 0));
  const ftL = add(knL, 'ftL', V(0, -D.shin, 0)), ftR = add(knR, 'ftR', V(0, -D.shin, 0));

  // ---- colours by costume
  const shirtM = saree ? mat(s.blouse) : uni ? white : mat(s.shirt);
  const pantsM = s.kind === 'boy' && uni ? navy : mat(s.pants); const sleeveLong = !saree && !kid && s.sleeve !== 'short';
  const W = D.shoulder * 2 * 0.9, L = D.torso;
  const ribbon = (pts, width, m, out = 0.006) => { // a fabric strip following points, lying on the body surface
    const curve = new THREE.CatmullRomCurve3(pts); const N = 24; const pos = [], idx = [];
    for (let i = 0; i <= N; i++) { const p = curve.getPoint(i / N), t = curve.getTangent(i / N); const n = new THREE.Vector3(p.x, 0, p.z).normalize(); const b = new THREE.Vector3().crossVectors(t, n).normalize();
      const q = p.clone().add(n.clone().multiplyScalar(out)); pos.push(...q.clone().add(b.clone().multiplyScalar(width / 2)).toArray(), ...q.clone().add(b.clone().multiplyScalar(-width / 2)).toArray());
      if (i < N) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const mm = m.clone(); mm.side = THREE.DoubleSide; return new THREE.Mesh(g, mm); };
  // ---- torso: one smooth lathe body; the waist sits below the pelvis so clothes overlap
  const tw = kid ? [0.47, 0.48, 0.5, 0.51, 0.45] : saree ? [0.42, 0.43, 0.49, 0.5, 0.42] : [0.43, 0.45, 0.5, 0.53, 0.46];
  const torsoProf = [[0.001, -0.04], [W * tw[0], -0.04], [W * tw[1], L * 0.25], [W * tw[2], L * 0.55], [W * tw[3], L * 0.8], [W * tw[4], L * 0.93], [W * 0.2, L], [0.001, L]];
  mesh(spine, lathe(torsoProf, 24), shirtM, null, null, [1, 1, 0.7]);
  // collar
  mesh(spine, new THREE.TorusGeometry(W * 0.2, W * 0.045, 6, 16), uni ? white : shirtM, V(0, L * 0.985, 0), [Math.PI / 2, 0, 0], [1, 0.75, 1]);
  // hips
  const hipsM = saree ? mat(s.saree) : s.kind === 'girl' ? (uni ? navy : mat(dress)) : pantsM;
  mesh(pelvis, lathe([[0.001, 0.04], [W * 0.47, 0.04], [W * 0.48, -0.03], [W * 0.43, -D.legLen * 0.14], [0.001, -D.legLen * 0.14]], 20), hipsM, null, null, [1, 1, 0.74]);
  if (s.kind === 'girl') { // pinafore (uniform) or dress (casual) from the chest to above the knee
    const navy0 = navy; const navyD = uni ? navy0 : mat(dress);
    mesh(spine, lathe([[0.001, -0.02], [W * 0.5, -0.02], [W * 0.51, L * 0.5], [W * 0.45, L * 0.74], [0.001, L * 0.74]], 22), navyD, null, null, [1.03, 1, 0.73]);
    mesh(pelvis, lathe([[0.001, 0.05], [W * 0.5, 0.05], [W * 0.6, -D.thigh * 0.5], [W * 0.68, -D.thigh * 0.92], [0.001, -D.thigh * 0.92]], 24), navyD, null, null, [1, 1, 0.82]);
  }
  if (s.kind === 'boy' && uni) mesh(spine, new THREE.BoxGeometry(W * 0.12, L * 0.5, 0.012), mat('#8A2E2A'), V(0, L * 0.62, W * 0.36), [-0.1, 0, 0]);
  if (s.bag) mesh(spine, new THREE.BoxGeometry(W * 0.62, L * 0.55, W * 0.3), mat(s.bagColor || '#6A4A32'), V(0, L * 0.55, -W * 0.46));
  if (saree) {
    const sk = mat(s.saree), bd = mat(s.border);
    mesh(pelvis, lathe([[0.001, 0.03], [W * 0.45, 0.03], [W * 0.5, -D.legLen * 0.3], [W * 0.6, -D.legLen * 0.75], [W * 0.64, -D.legLen + 0.04], [0.001, -D.legLen + 0.04]], 28), sk, null, null, [1, 1, 0.8]);
    mesh(pelvis, lathe([[W * 0.6, -D.legLen * 0.8], [W * 0.645, -D.legLen + 0.04], [W * 0.66, -D.legLen + 0.04], [W * 0.615, -D.legLen * 0.8]], 28), bd, null, null, [1.005, 1, 0.805]);
    // the pallu: across the chest from the right hip to the left shoulder, then down the back
    const pl = ribbon([V(-W * 0.42, 0.02, W * 0.26), V(-W * 0.12, L * 0.35, W * 0.37), V(W * 0.2, L * 0.72, W * 0.33), V(W * 0.38, L * 0.98, W * 0.05)], W * 0.34, sk, 0.012); spine.add(pl);
    j.drape = add(chest, 'drape', V(D.shoulder * 0.62, L * 0.52, -W * 0.28));
    const dr = ribbon([V(0, 0, 0), V(0, -L * 0.5, -0.03), V(0, -L * 1.1, -0.05)], W * 0.36, sk, 0.0); dr.position.z = 0; j.drape.add(dr);
    const drb = ribbon([V(0, -L * 1.06, -0.05), V(0, -L * 1.14, -0.052)], W * 0.36, bd, 0.001); j.drape.add(drb);
  }
  // ---- arms: sleeve cones over the shoulder, mitten hands with a thumb
  for (const [sh, el, side] of [[shL, elL, 1], [shR, elR, -1]]) {
    mesh(sh, new THREE.SphereGeometry(D.armR * 1.35, 12, 10), shirtM);
    const sleeveLen = sleeveLong ? D.upper : D.upper * (kid ? 0.55 : 0.4);
    mesh(sh, lathe([[D.armR * 1.35, 0.01], [D.armR * 1.45, -sleeveLen * 0.5], [D.armR * 1.55, -sleeveLen], [0.001, -sleeveLen]], 14), shirtM);
    mesh(sh, capsule(D.armR, D.upper, D.armR * 0.95), sleeveLong ? shirtM : skin);
    mesh(el, capsule(D.armR * 0.95, D.fore, D.armR * 0.8), sleeveLong ? shirtM : skin);
    if (sleeveLong) mesh(el, capsule(D.armR * 0.85, D.fore * 0.45, D.armR * 0.78), skin, V(0, -D.fore * 0.55, 0));
    const hand = add(el, side > 0 ? 'handL' : 'handR', V(0, -D.fore, 0));
    mesh(hand, new THREE.SphereGeometry(D.armR * 1.35, 12, 10), skin, V(0, -D.armR * 0.8, 0.004), null, [0.9, 1.25, 0.8]);
    mesh(hand, new THREE.SphereGeometry(D.armR * 0.55, 8, 6), skin, V(side * -D.armR * 0.2, -D.armR * 0.4, D.armR * 0.8));
  }
  const bandMat = new THREE.MeshBasicMaterial({ color: '#2A2F3F' }); bandMat.toneMapped = false;
  const band = mesh(elL, new THREE.TorusGeometry(D.armR * 1.05, D.armR * 0.38, 8, 16), bandMat, V(0, -D.fore * 0.86, 0), [Math.PI / 2, 0, 0]);
  // ---- legs
  for (const [hp, kn, ft] of [[hipL, knL, ftL], [hipR, knR, ftR]]) {
    const thighM = saree || s.kind === 'girl' ? skin : s.kind === 'boy' ? skin : pantsM;
    mesh(hp, capsule(D.legR * 1.15, D.thigh, D.legR), thighM);
    if (s.kind === 'boy') mesh(hp, lathe([[D.legR * 1.3, 0.02], [D.legR * 1.55, -D.thigh * 0.62], [0.001, -D.thigh * 0.62]], 14), uni ? navy : pantsM);
    mesh(kn, capsule(D.legR, D.shin, D.legR * 0.78), kid || saree ? skin : pantsM);
    if (uni) mesh(kn, lathe([[D.legR * 1.02, -D.shin * 0.58], [D.legR * 0.9, -D.shin], [0.001, -D.shin]], 12), white);
    mesh(ft, new THREE.CapsuleGeometry(D.legR * 1.1, D.legR * 2.1, 4, 10), shoe, V(0, -D.legR * 0.35, D.legR * 1.0), [Math.PI / 2, 0, 0], [1, 1, 0.72]);
  }
  // ---- neck, head, hair, face
  mesh(neck, capsule(D.armR * 1.35, D.neck + 0.03), skin, V(0, D.neck + 0.015, 0));
  const R = D.headR;
  mesh(head, new THREE.SphereGeometry(R, 28, 20), skin, V(0, R, 0), null, [0.95, 1.03, 1]);
  for (const sx of [1, -1]) mesh(head, new THREE.SphereGeometry(R * 0.2, 8, 6), skin, V(sx * R * 0.93, R * 0.95, 0), null, [0.5, 1, 0.8]);
  // hair styles
  const capBack = (sc = 1.07) => mesh(head, new THREE.SphereGeometry(R * sc, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.56), hair, V(0, R * 1.05, -R * 0.1), [-0.62, 0, 0]);
  capBack(); mesh(head, new THREE.SphereGeometry(R * 1.04, 22, 14), hair, V(0, R * 1.02, -R * 0.14), null, [1, 1, 0.9]);
  j.plaits = [];
  if (s.kind === 'girl') {
    mesh(head, new THREE.SphereGeometry(R * 0.62, 14, 10), hair, V(R * 0.18, R * 1.62, R * 0.52), [0, 0, -0.25], [1.5, 0.42, 0.7]);
    for (const sd of [1, -1]) { const p = add(head, 'plait', V(sd * R * 0.7, R * 0.6, -R * 0.45)); j.plaits.push(p); for (let i = 0; i < 5; i++) mesh(p, new THREE.SphereGeometry(R * (0.22 - i * 0.015), 10, 8), hair, V(0, -i * R * 0.3, -i * R * 0.04)); mesh(p, new THREE.TorusGeometry(R * 0.12, R * 0.05, 6, 12), mat('#C8403A'), V(0, -5 * R * 0.3 + R * 0.15, -R * 0.2), [Math.PI / 2, 0, 0]); }
  } else if (s.kind === 'boy') {
    for (let k = -1; k <= 1; k++) mesh(head, new THREE.SphereGeometry(R * 0.36, 10, 8), hair, V(k * R * 0.38, R * 1.7, R * 0.45), [0, 0, 0], [1, 0.55, 0.8]);
  } else if (saree) {
    mesh(head, new THREE.SphereGeometry(R * 0.44, 14, 10), hair, V(0, R * 0.92, -R * 1.05));
    mesh(head, new THREE.SphereGeometry(R * 0.6, 14, 10), hair, V(R * 0.35, R * 1.66, R * 0.42), [0, 0, -0.3], [1.3, 0.4, 0.7]); mesh(head, new THREE.SphereGeometry(R * 0.6, 14, 10), hair, V(-R * 0.35, R * 1.66, R * 0.42), [0, 0, 0.3], [1.3, 0.4, 0.7]);
    if (s.kind === 'teacher') { const gm = mat('#2A2A30'); for (const sx of [1, -1]) mesh(head, new THREE.TorusGeometry(R * 0.2, R * 0.025, 6, 16), gm, V(sx * R * 0.36, R * 1.07, R * 0.97)); mesh(head, new THREE.BoxGeometry(R * 0.2, R * 0.03, R * 0.03), gm, V(0, R * 1.1, R * 1.0)); }
  } else {
    mesh(head, new THREE.SphereGeometry(R * 0.66, 14, 10), hair, V(-R * 0.1, R * 1.66, R * 0.36), [0, 0, 0.2], [1.5, 0.4, 0.75]);
    mesh(head, new THREE.BoxGeometry(R * 0.55, R * 0.09, R * 0.12), hair, V(0, R * 0.6, R * 0.93));
  }
  if (s.hat === 'sun') { const hm = mat(s.hatColor || '#C9A15E'); mesh(head, new THREE.CylinderGeometry(R * 1.9, R * 1.9, R * 0.08, 20), hm, V(0, R * 1.62, -R * 0.05)); mesh(head, new THREE.SphereGeometry(R * 1.05, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), hm, V(0, R * 1.6, -R * 0.05)); }
  if (s.hat === 'cap') { const hm = mat(s.hatColor || '#B5523B'); mesh(head, new THREE.SphereGeometry(R * 1.08, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), hm, V(0, R * 1.28, -R * 0.05)); mesh(head, new THREE.BoxGeometry(R * 1.3, R * 0.07, R * 0.9), hm, V(0, R * 1.32, R * 0.95)); }
  // face: white eyes with dark pupils, brows, nose, mouth shapes
  const f = {}; const eyeW = mat('#FBF7EE'), pup = mat('#1E1A1A');
  f.eyes = [];
  for (const sx of [1, -1]) { const e = add(head, 'eye', V(sx * R * 0.36, R * 1.06, R * 0.86)); mesh(e, new THREE.SphereGeometry(R * 0.17, 12, 10), eyeW, null, null, [1, 1.1, 0.55]); mesh(e, new THREE.SphereGeometry(R * 0.1, 10, 8), pup, V(0, -R * 0.01, R * 0.07)); f.eyes.push(e); }
  f.eyeL = f.eyes[0]; f.eyeR = f.eyes[1];
  const browG = new THREE.TorusGeometry(R * 0.17, R * 0.03, 5, 10, Math.PI * 0.8);
  f.browL = mesh(head, browG, hair, V(R * 0.36, R * 1.3, R * 0.9), [0, 0, 0.3]); f.browR = mesh(head, browG, hair, V(-R * 0.36, R * 1.3, R * 0.9), [0, 0, 0.3]);
  mesh(head, new THREE.SphereGeometry(R * 0.11, 8, 6), mat(shadeHex(s.skin, 0.86)), V(0, R * 0.88, R * 1.0), null, [1, 0.9, 0.9]);
  f.smile = mesh(head, new THREE.TorusGeometry(R * 0.2, R * 0.04, 6, 14, Math.PI), mat('#7A2E2A'), V(0, R * 0.64, R * 0.92), [0, 0, Math.PI]);
  f.open = mesh(head, new THREE.CircleGeometry(R * 0.21, 14, Math.PI, Math.PI), mat('#6A2426'), V(0, R * 0.69, R * 0.965));
  f.o = mesh(head, new THREE.SphereGeometry(R * 0.11, 10, 8), mat('#6A2426'), V(0, R * 0.62, R * 0.93), null, [1, 1.35, 0.5]);
  if (kid) { const ck = mat('#E8998A'); for (const sx of [1, -1]) mesh(head, new THREE.CircleGeometry(R * 0.13, 10), ck, V(sx * R * 0.57, R * 0.8, R * 0.82), [0, sx * 0.6, 0]); }
  root.traverse(o => { if (o.isMesh) o.castShadow = true; });
  // face features live in their own small groups, so expressions work by transforming groups (skinning-friendly)
  const wrap = (m) => { const g = new THREE.Group(); g.position.copy(m.position); g.rotation.copy(m.rotation); g.scale.copy(m.scale); m.parent.add(g); g.add(m); m.position.set(0, 0, 0); m.rotation.set(0, 0, 0); m.scale.set(1, 1, 1); g.userData.base = g.scale.clone(); return g; };
  for (const k of ['smile', 'open', 'o', 'browL', 'browR']) f[k] = wrap(f[k]);
  const person = { spec: s, root, j, D, f, band, bandMat, kid };
  // ---- pose application: pose = { joint: [x, y, z], pelvisY, lean }
  person.pose = (p = {}) => {
    for (const n of JOINTS) { const r = p[n] || [0, 0, 0]; j[n].rotation.set(r[0], r[1], r[2]); j[n].quaternion.setFromEuler(j[n].rotation); }
    j.pelvis.position.set(0, D.legLen + (p.pelvisY || 0), p.pelvisZ || 0);
  };
  person.expr = (name = 'neutral', blink = 0) => {
    const show = (g, on, sy = 1) => { const b = g.userData.base; if (on) g.scale.set(b.x, b.y * sy, b.z); else g.scale.set(1e-4, 1e-4, 1e-4); };
    show(f.smile, name === 'smile' || name === 'neutral', name === 'neutral' ? 0.5 : 1); show(f.open, name === 'joy'); show(f.o, name === 'o' || name === 'worry');
    const bl = 1 - blink * 0.92; for (const e of f.eyes) e.scale.set(1, name === 'joy' ? 0.5 * bl : name === 'o' ? 1.15 * bl : bl, 1);
    const br = name === 'o' ? 0.12 : name === 'worry' ? 0.05 : 0; const tilt = name === 'worry' ? 0.35 : 0;
    f.browL.position.y = R * (1.3 + br); f.browR.position.y = R * (1.3 + br); f.browL.rotation.z = 0.3 + tilt; f.browR.rotation.z = 0.3 - tilt + (name === 'worry' ? -0.0 : 0);
  };
  person.band = (on) => { bandMat.color.set(on > 0.5 ? '#FFD27A' : '#2A2F3F'); };
  // ---- two-bone reach: put the hand at a world point
  const tmp = { S: V(0, 0, 0), E: V(0, 0, 0), T: V(0, 0, 0), q: new THREE.Quaternion(), pq: new THREE.Quaternion(), down: V(0, -1, 0) };
  person.reach = (side, target, pole) => {
    const sh = side === 'L' ? j.shL : j.shR, el = side === 'L' ? j.elL : j.elR;
    root.updateMatrixWorld(true);
    const S = sh.getWorldPosition(tmp.S); const T = tmp.T.copy(target);
    const a = D.upper, b = D.fore + D.armR * 0.6; let dvec = T.clone().sub(S); let d = dvec.length(); d = clamp(d, 0.02, a + b - 0.002); dvec.normalize();
    const x = (a * a - b * b + d * d) / (2 * d), hh = Math.sqrt(Math.max(0, a * a - x * x));
    const pv = pole ? pole.clone() : V(side === 'L' ? 1 : -1, -0.6, -0.4).applyQuaternion(root.quaternion); const pl = pv.sub(dvec.clone().multiplyScalar(dvec.dot(pv))).normalize();
    const E = S.clone().add(dvec.clone().multiplyScalar(x)).add(pl.multiplyScalar(hh));
    const setDir = (joint, from, to) => { joint.parent.getWorldQuaternion(tmp.pq); const dir = to.clone().sub(from).normalize(); tmp.q.setFromUnitVectors(tmp.down, dir); joint.quaternion.copy(tmp.pq.invert().multiply(tmp.q)); joint.updateMatrixWorld(true); };
    setDir(sh, S, E); const E2 = el.getWorldPosition(V(0, 0, 0)); setDir(el, E2, S.clone().add(dvec.clone().multiplyScalar(d)));
  };
  // ---- look at a world point with neck and head
  person.look = (target, amount = 1) => {
    root.updateMatrixWorld(true); const hp = j.neck.getWorldPosition(V(0, 0, 0)); const loc = j.chest.worldToLocal(target.clone()); const nl = j.chest.worldToLocal(hp.clone());
    const dx = loc.x - nl.x, dy = loc.y - nl.y - D.headR, dz = loc.z - nl.z;
    const yaw = clamp(Math.atan2(dx, dz), -1.2, 1.2) * amount, pitch = clamp(-Math.atan2(dy, Math.hypot(dx, dz)), -0.75, 0.45) * amount;
    j.neck.rotation.set(pitch * 0.4, yaw * 0.45, 0); j.head.rotation.set(pitch * 0.6, yaw * 0.55, 0);
  };
  person.place = (x, y, yawDeg) => { root.position.set(x, 0, y); root.rotation.set(0, yawDeg * Math.PI / 180, 0); };
  person.pose({}); person.expr('smile');
  if (spec.skin !== false) skinPerson(person, mat);
  return person;
}
// merge every piece of a person into ONE skinned mesh (one draw call), each vertex bound rigidly to the group it hung from
function skinPerson(person, mat) {
  const root = person.root; root.position.set(0, 0, 0); root.rotation.set(0, 0, 0); root.updateMatrixWorld(true);
  const rootInv = root.matrixWorld.clone().invert();
  const bones = [], index = new Map(), geos = [], meshes = [];
  root.traverse(o => { if (o.isMesh && o !== person.band) meshes.push(o); });
  for (const m of meshes) {
    const parent = m.parent; if (!index.has(parent)) { index.set(parent, bones.length); bones.push(parent); }
    const bi = index.get(parent);
    m.updateMatrix(); let g = m.geometry.clone(); g.applyMatrix4(m.matrix); if (g.index) g = g.toNonIndexed();
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(rootInv, parent.matrixWorld));
    const n = g.attributes.position.count;
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    const c = m.material.color; const col = new Float32Array(n * 3); for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4); for (let i = 0; i < n; i++) { si[i * 4] = bi; sw[i * 4] = 1; }
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    geos.push(g);
  }
  const merged = mergeGeometries(geos, false);
  for (const m of meshes) { m.parent.remove(m); m.geometry.dispose(); }
  if (!skinPerson.mat) { skinPerson.mat = mat('#ffffff', { vertexColors: true, side: THREE.DoubleSide, noCache: true }); skinPerson.mat.color.setRGB(1, 1, 1); }
  const material = skinPerson.mat;
  const sm = new THREE.SkinnedMesh(merged, material); sm.castShadow = true; sm.receiveShadow = false; sm.frustumCulled = false;
  root.add(sm); root.updateMatrixWorld(true);
  sm.bind(new THREE.Skeleton(bones), sm.matrixWorld);
  person.mesh = sm;
}
function shadeHex(h, f) { const c = h.replace('#', ''); const v = [0, 2, 4].map(i => Math.round(parseInt(c.slice(i, i + 2), 16) * f)); return '#' + v.map(n => n.toString(16).padStart(2, '0')).join(''); }

// facing helper: yaw (degrees) that makes a person at (x,y) face the plan point (tx,ty). Local +Z = facing.
export const faceTo = (x, y, tx, ty) => Math.atan2(tx - x, ty - y) * 180 / Math.PI;

// ---- procedural walk and poses
export function walkPose(phase, amp = 1, kid = false) {
  const s = Math.sin(phase), c = Math.cos(phase); const A = (kid ? 0.55 : 0.45) * amp;
  return { hipL: [-A * s, 0, 0], hipR: [A * s, 0, 0], knL: [Math.max(0, -c) * 0.9 * amp + 0.08, 0, 0], knR: [Math.max(0, c) * 0.9 * amp + 0.08, 0, 0],
    shL: [A * 0.9 * s, 0, 0.08], shR: [-A * 0.9 * s, 0, -0.08], elL: [-0.35 - 0.2 * Math.max(0, s), 0, 0], elR: [-0.35 - 0.2 * Math.max(0, -s), 0, 0],
    spine: [0.05 * amp, 0.06 * s * amp, 0], pelvisY: -Math.abs(c) * 0.025 * amp + (kid ? Math.abs(s) * 0.02 * amp : 0) };
}
export const POSES = {
  idle: { shL: [0.05, 0, 0.1], shR: [0.05, 0, -0.1], elL: [-0.2, 0, 0], elR: [-0.2, 0, 0], knL: [0.04, 0, 0], knR: [0.04, 0, 0] },
  lookUp: { spine: [-0.08, 0, 0], shL: [0.05, 0, 0.12], shR: [0.05, 0, -0.12], elL: [-0.25, 0, 0], elR: [-0.25, 0, 0] },
  surprise: { spine: [-0.14, 0, 0], shL: [-0.7, 0, 0.35], shR: [-0.7, 0, -0.35], elL: [-1.7, 0, 0], elR: [-1.7, 0, 0], hipL: [0.1, 0, 0], knL: [0.12, 0, 0] },
  joy: { shL: [-0.3, 0, 2.5], shR: [-0.3, 0, -2.5], elL: [-0.3, 0, 0], elR: [-0.3, 0, 0], spine: [-0.1, 0, 0] },
  crouch: { hipL: [-1.3, 0, 0.1], hipR: [-1.3, 0, -0.1], knL: [2.2, 0, 0], knR: [2.2, 0, 0], ftL: [-0.9, 0, 0], ftR: [-0.9, 0, 0], spine: [0.45, 0, 0], pelvisY: -0.3 },
  handsBack: { shL: [0.35, 0, 0.18], shR: [0.35, 0, -0.18], elL: [-0.6, 0, 0], elR: [-0.6, 0, 0] }
};
export function blendPose(a, b, t) {
  if (t <= 0) return a; if (t >= 1) return b; const o = {}; const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) { const x = a[k] ?? (k.startsWith('pelvis') ? 0 : [0, 0, 0]), y = b[k] ?? (k.startsWith('pelvis') ? 0 : [0, 0, 0]); o[k] = typeof x === 'number' ? lerp(x, y, t) : [lerp(x[0], y[0], t), lerp(x[1], y[1], t), lerp(x[2], y[2], t)]; }
  return o;
}
export function addPose(a, b, w = 1) { const o = { ...a }; for (const k in b) { const x = a[k] ?? (typeof b[k] === 'number' ? 0 : [0, 0, 0]); o[k] = typeof b[k] === 'number' ? x + b[k] * w : [x[0] + b[k][0] * w, x[1] + b[k][1] * w, x[2] + b[k][2] * w]; } return o; }
