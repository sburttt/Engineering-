/**
 * Geometry audit (node, no browser):
 *  1. internal parts must stay inside the outer mould line;
 *  2. the closed shell must have no see-through holes (rays from above, below and both sides);
 *  3. surface markings must lie on the skin.
 * Run: npm run check:geometry
 */
import * as THREE from 'three';
import { buildParts } from '../src/aircraft/parts';
import { hLo, hUp, insidePlanform, outerTop, xLE, xTE, HALF_SPAN, lerp } from '../src/aircraft/geometry/airframe';

const parts = buildParts();
let failures = 0;
const report = (ok: boolean, name: string, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

// 1. containment
const byComp = new Map<string, { n: number; worst: number; at: number[] }>();
const v = new THREE.Vector3();
for (const p of parts) {
  if (p.role !== 'internal' || p.payload) continue;
  const pos = p.geometry.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    if (!insidePlanform(v.x, v.z)) continue;
    const over = Math.max(v.y - outerTop(v.x, v.z), hLo(v.x, v.z) - v.y);
    if (over > 0.004) {
      const r = byComp.get(p.key) ?? { n: 0, worst: 0, at: [] };
      r.n++;
      if (over > r.worst) (r.worst = over), (r.at = [+v.x.toFixed(2), +v.y.toFixed(2), +v.z.toFixed(2)]);
      byComp.set(p.key, r);
    }
  }
}
report(byComp.size === 0, 'Internal parts stay inside the skin', [...byComp].map(([k, r]) => `${k}: ${r.n} verts, worst ${(r.worst * 100).toFixed(1)} cm at ${r.at}`).join('; '));

// 2. holes
const shell = new THREE.Group();
for (const p of parts) {
  if (p.role !== 'shell' || p.decor || p.kind === 'lines' || p.kind === 'instanced') continue;
  const m = new THREE.Mesh(p.geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  m.name = p.key;
  shell.add(m);
}
shell.updateMatrixWorld(true);
const ray = new THREE.Raycaster();
const holes: string[] = [];
const test = (o: THREE.Vector3, d: THREE.Vector3, label: string) => {
  ray.set(o, d);
  if (ray.intersectObject(shell, true).length === 0) holes.push(label);
};
for (let x = -6.75; x <= 7.3; x += 0.05)
  for (let z = -HALF_SPAN + 0.02; z <= HALF_SPAN - 0.02; z += 0.05) {
    if (!insidePlanform(x, z)) continue;
    // keep away from the exact outline, where a ray can legitimately graze the edge
    if (x > xLE(z) - 0.03 || x < xTE(z) + 0.03) continue;
    test(new THREE.Vector3(x, 10, z), new THREE.Vector3(0, -1, 0), `top (${x.toFixed(2)}, ${z.toFixed(2)})`);
    test(new THREE.Vector3(x, -10, z), new THREE.Vector3(0, 1, 0), `bottom (${x.toFixed(2)}, ${z.toFixed(2)})`);
  }
// side rays across the body thickness, both directions
for (let x = -6.7; x <= 7.2; x += 0.04) {
  const lo = hLo(x, 0);
  const hi = outerTop(x, 0);
  for (let k = 1; k < 10; k++) {
    const y = lerp(lo, hi, k / 10) + 0.0037;
    for (const s of [-1, 1]) {
      // aim at the centreline: a ray must hit the shell before reaching z = 0
      ray.set(new THREE.Vector3(x, y, s * 12), new THREE.Vector3(0, 0, -s));
      ray.far = 12;
      const h = ray.intersectObject(shell, true);
      if (h.length === 0) holes.push(`side ${s > 0 ? 'stbd' : 'port'} (x ${x.toFixed(2)}, y ${y.toFixed(2)})`);
      ray.far = Infinity;
    }
  }
}
report(holes.length === 0, 'Closed shell has no see-through holes', `${holes.length} rays: ${(process.env.ALL ? holes : holes.slice(0, 12)).join('; ')}`);

// 3. decals lie on the skin
const off: string[] = [];
for (const p of parts) {
  if (!p.mat.startsWith('decal-')) continue;
  const pos = p.geometry.getAttribute('position');
  let worst = 0;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const s = v.y > (hUp(v.x, v.z) + hLo(v.x, v.z)) / 2 ? hUp(v.x, v.z) : hLo(v.x, v.z);
    worst = Math.max(worst, Math.abs(v.y - s));
  }
  if (worst > 0.008) off.push(`${p.key} ${(worst * 100).toFixed(1)} cm`);
}
report(off.length === 0, 'Markings lie on the skin (within 8 mm)', off.join('; '));

console.log(failures ? `\n${failures} geometry check(s) failed` : '\nAll geometry checks passed');
process.exit(failures ? 1 : 0);
