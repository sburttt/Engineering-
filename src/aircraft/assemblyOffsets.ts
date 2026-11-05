import * as THREE from 'three';
import type { Part } from './parts';
import { ASSEMBLY_MAP, type Assembly } from '../data/assemblies';
import { chainOf } from '../data/components';
import { mouldNormal } from './geometry/airframe';

/** The assembly member a component belongs to (itself or an ancestor), if any. */
export function memberOf(a: Assembly, componentId: string): string | null {
  for (const c of chainOf(componentId)) if (a.members.includes(c)) return c;
  return null;
}

function centreOf(p: Part, out: THREE.Vector3) {
  if (p.kind === 'instanced' && p.instances?.length) {
    out.set(0, 0, 0);
    const v = new THREE.Vector3();
    for (const m of p.instances) out.add(v.setFromMatrixPosition(m));
    return out.multiplyScalar(1 / p.instances.length);
  }
  const g = p.geometry;
  if (!g.boundingBox) g.computeBoundingBox();
  return g.boundingBox!.getCenter(out);
}

/**
 * Separation vector of every part of an assembly at full explode. Directions are derived from the
 * geometry (never random) and every part of one assembly moves along a consistent family of axes:
 * skins part vertically, sub-components step away from their parent, the assembly detaches from
 * the centreline, panels lift along their surface normal.
 */
export function assemblyOffsets(id: string, parts: Part[]): Map<string, THREE.Vector3> {
  const out = new Map<string, THREE.Vector3>();
  const a = ASSEMBLY_MAP[id];
  if (!a) return out;
  const centre = new Map<string, THREE.Vector3>();
  const box = new THREE.Box3();
  const memberBox = new Map<string, THREE.Box3>();
  const c = new THREE.Vector3();
  for (const p of parts) {
    const m = memberOf(a, p.componentId);
    if (!m) continue;
    centre.set(p.key, centreOf(p, new THREE.Vector3()).clone());
    if (p.decor || p.payload) continue;
    if (!p.geometry.boundingBox) p.geometry.computeBoundingBox();
    box.union(p.geometry.boundingBox!);
    const mb = memberBox.get(m) ?? new THREE.Box3();
    memberBox.set(m, mb.union(p.geometry.boundingBox!));
  }
  if (box.isEmpty()) return out;
  const radius = box.getBoundingSphere(new THREE.Sphere()).radius;
  const d = THREE.MathUtils.clamp(radius * 0.22, 0.35, 1.1);

  for (const p of parts) {
    const m = memberOf(a, p.componentId);
    if (!m) continue;
    const pc = centre.get(p.key)!;
    const mc = (memberBox.get(m) ?? box).getCenter(new THREE.Vector3());
    const v = new THREE.Vector3();
    if (a.style === 'explicit') {
      v.set(...(a.offsets?.[m] ?? [0, 0, 0]));
    } else if (a.style === 'normal') {
      const n = mouldNormal(pc.x, pc.z, p.skin === 'lo' ? 'lo' : 'up');
      v.set(...n).multiplyScalar(0.55);
    } else if (a.style === 'children') {
      if (p.componentId !== m) {
        c.copy(pc).sub(mc).setY(0);
        if (c.lengthSq() < 0.01) c.copy(mc).setY(0); // part directly below its parent: step outboard
        v.copy(c.normalize()).multiplyScalar(d * 1.25);
      }
    } else {
      // shell
      const detach = new THREE.Vector3(mc.x, 0, mc.z);
      if (detach.length() > 0.8) v.add(detach.normalize().multiplyScalar(d * 0.9));
      if (p.componentId === m) {
        if (p.skin === 'up') v.y += d * 0.85;
        if (p.skin === 'lo') v.y -= d * 0.85;
        if (p.key.startsWith('fwd-radome')) v.x += d * 0.9;
      } else {
        c.copy(pc).sub(mc);
        c.y *= 0.4;
        v.add(c.normalize().multiplyScalar(d * 1.3));
      }
    }
    out.set(p.key, v);
  }
  return out;
}

/**
 * Decor drawn across both skins (seam ribbons without a side) cannot follow a vertical split:
 * they are hidden while their assembly is separated.
 */
export const hidesWhenSeparated = (a: Assembly, p: Part) => a.style === 'shell' && !!p.decor && !p.skin && !!memberOf(a, p.componentId);
