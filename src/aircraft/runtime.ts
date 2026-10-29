import * as THREE from 'three';
import { isDescendant } from '../data/components';

/** Animated values read every frame by parts (kept outside React to avoid re-renders). */
export const anim = { explode: 0, pitch: 0, roll: 0, bay: 0 };

/** componentId → rendered objects, used for camera fitting and debugging. */
export const registry = new Map<string, Set<THREE.Object3D>>();

/** World-space bounds of a component and all of its descendants (visible objects only). */
export function boundsOf(id: string): THREE.Box3 | null {
  const box = new THREE.Box3();
  const tmp = new THREE.Box3();
  let any = false;
  for (const [cid, set] of registry) {
    if (!isDescendant(cid, id)) continue;
    for (const o of set) {
      let visible = true;
      o.traverseAncestors((a) => {
        if (!a.visible) visible = false;
      });
      if (!visible) continue;
      o.updateWorldMatrix(true, false);
      tmp.setFromObject(o);
      if (!tmp.isEmpty()) {
        box.union(tmp);
        any = true;
      }
    }
  }
  return any ? box : null;
}
