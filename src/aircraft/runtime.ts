import * as THREE from 'three';

/** Animated values written by the Animator and read every frame by parts (kept out of React state). */
export const anim = {
  explode: 0,
  pitch: 0,
  roll: 0,
  bay: 0,
  /** assembly separation, linear 0..1 progress (eased when applied) */
  asmT: 0,
  /** the assembly whose offsets are currently applied (lags the store while one collapses) */
  asmShown: null as string | null,
  /** studio light level 0..1 (the cinematic intro fades the lights up) */
  light: 1,
};

/** Smooth 0..1 easing with zero velocity at both ends. */
export const smoother = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

/** part key → separation vector at full assembly explode (for anim.asmShown). */
export const asmOffsets = new Map<string, THREE.Vector3>();

/** componentId → rendered objects, used for camera fitting, callouts and tests. */
export const registry = new Map<string, Set<THREE.Object3D>>();

/** The live camera, for screen-space overlays (callouts, dimension guides). */
export const view = { camera: null as THREE.PerspectiveCamera | null, width: 1, height: 1 };

export function boundsOf(id: string): THREE.Box3 | null {
  const set = registry.get(id);
  if (!set || set.size === 0) return null;
  const box = new THREE.Box3();
  for (const o of set) {
    if (!o.parent?.visible) continue;
    o.updateWorldMatrix(true, false);
    box.expandByObject(o);
  }
  if (box.isEmpty()) return null;
  return box;
}

/** Union bounds of several components. */
export function boundsOfAll(ids: string[]): THREE.Box3 | null {
  const box = new THREE.Box3();
  for (const id of ids) {
    const b = boundsOf(id);
    if (b) box.union(b);
  }
  return box.isEmpty() ? null : box;
}

export { publishView, subscribeView, type ViewReadout } from './viewReadout';
