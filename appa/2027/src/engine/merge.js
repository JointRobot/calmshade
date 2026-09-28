// PULSE iso3d · merge static meshes that share a material into one mesh per material (fewer draw calls)
// Skips anything marked userData.dyn (animated, toggled, recoloured per object) or userData.wall (cut-away walls), and their children.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function mergeStatic(group) {
  group.updateMatrixWorld(true);
  const inv = group.matrixWorld.clone().invert();
  const buckets = new Map();
  const skip = o => { for (let p = o; p && p !== group; p = p.parent) if (p.userData.dyn || p.userData.wall) return true; return false; };
  group.traverse(o => { if (!o.isMesh || o.isSkinnedMesh || o.isInstancedMesh || skip(o)) return; const k = o.material; if (Array.isArray(k)) return; if (!buckets.has(k)) buckets.set(k, []); buckets.get(k).push(o); });
  let removed = 0, added = 0;
  for (const [material, meshes] of buckets) {
    if (meshes.length < 2) continue;
    const geos = []; let cast = false, recv = false;
    for (const m of meshes) {
      let g = m.geometry.clone(); if (g.index) g = g.toNonIndexed();
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
      if (!g.attributes.normal) g.computeVertexNormals();
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
      for (const k of Object.keys(g.morphAttributes)) delete g.morphAttributes[k];
      geos.push(g); cast = cast || m.castShadow; recv = recv || m.receiveShadow;
    }
    const merged = mergeGeometries(geos, false); if (!merged) continue;
    const mesh = new THREE.Mesh(merged, material); mesh.castShadow = cast; mesh.receiveShadow = recv; mesh.userData.noEdge = meshes.every(m => m.userData.noEdge);
    group.add(mesh); added++;
    for (const m of meshes) { m.parent.remove(m); removed++; }
  }
  return { removed, added };
}
