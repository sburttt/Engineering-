import * as THREE from 'three';
import { HALF_SPAN, HINGE_S, NOSE_X, TAIL_X, chord, hLo, insidePlanform, outerTop, xLE, xTE } from './geometry/airframe';

/**
 * CAD-style isoparametric curves over the outer mould line: stations along the body and lines along
 * the span, on both surfaces. Built from the same height functions as the mesh, so they lie exactly
 * on it. Control surfaces are left clear because they move.
 */
export function buildIsoLines(): THREE.BufferGeometry {
  const v: number[] = [];
  const lift = 0.004;
  const push = (a: number[], b: number[]) => v.push(a[0], a[1], a[2], b[0], b[1], b[2]);
  const onFixed = (x: number, z: number) => {
    if (!insidePlanform(x, z)) return false;
    const az = Math.abs(z);
    // keep off elevon chord on the outer wing (it rotates)
    if (az > 2.45 && (xLE(az) - x) / chord(az) > HINGE_S - 0.02) return false;
    return true;
  };
  const surfaces: ((x: number, z: number) => number[])[] = [
    (x, z) => [x, outerTop(x, z) + lift, z],
    (x, z) => [x, hLo(x, z) - lift, z],
  ];
  // body stations (across the span), every 0.5 m
  for (let x = TAIL_X + 0.3; x < NOSE_X - 0.2; x += 0.5) {
    for (const S of surfaces) {
      let prev: number[] | null = null;
      for (let z = -HALF_SPAN; z <= HALF_SPAN + 1e-9; z += 0.04) {
        const ok = onFixed(x, z);
        const p = ok ? S(x, z) : null;
        if (p && prev) push(prev, p);
        prev = p;
      }
    }
  }
  // spanwise lines (along the chord), every 0.6 m
  for (let z = -HALF_SPAN + 0.3; z < HALF_SPAN - 0.2; z += 0.6) {
    for (const S of surfaces) {
      let prev: number[] | null = null;
      for (let x = xTE(z); x <= xLE(z) + 1e-9; x += 0.04) {
        const ok = onFixed(x, z);
        const p = ok ? S(x, z) : null;
        if (p && prev) push(prev, p);
        prev = p;
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  return g;
}
