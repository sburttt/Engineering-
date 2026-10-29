import * as THREE from 'three';

/** Animated values written by the Animator and read every frame by parts (kept out of React state). */
export const anim = { explode: 0, pitch: 0, roll: 0, bay: 0 };

/** componentId → rendered objects, used for camera fitting and tests. */
export const registry = new Map<string, Set<THREE.Object3D>>();

export function boundsOf(id: string): THREE.Box3 | null {
  const set = registry.get(id);
  if (!set || set.size === 0) return null;
  const box = new THREE.Box3();
  for (const o of set) {
    o.updateWorldMatrix(true, false);
    box.expandByObject(o);
  }
  if (box.isEmpty()) return null;
  return box;
}

export { publishView, subscribeView, type ViewReadout } from './viewReadout';
