import * as THREE from 'three';
import type { RenderMode } from '../state/store';

/**
 * The cinematic presentation: five scenes on one timeline (seconds). Everything is a pure function
 * of time, so the sequence can be paused and scrubbed: camera pose, light level, render mode,
 * separation, captions and callouts.
 */

export interface Pose {
  pos: [number, number, number];
  target: [number, number, number];
}
type Ease = (t: number) => number;
const inOut: Ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const sine: Ease = (t) => 0.5 - 0.5 * Math.cos(Math.PI * t);
const outCubic: Ease = (t) => 1 - Math.pow(1 - t, 3);

type Shot =
  | { t0: number; t1: number; kind: 'move'; to: Pose; ease?: Ease }
  | { t0: number; t1: number; kind: 'orbit'; target: [number, number, number]; az: [number, number]; el: [number, number]; r: [number, number]; ease?: Ease };

const T: [number, number, number] = [0.2, -0.15, 0];
const T_END: [number, number, number] = [0.3, -2.1, 0];
const D = Math.PI / 180;

export const SCENES = [
  { id: 1, title: 'Introduction', t0: 0, t1: 8 },
  { id: 2, title: 'Full aircraft', t0: 8, t1: 22 },
  { id: 3, title: 'Exterior detail', t0: 22, t1: 36 },
  { id: 4, title: 'Engineering view', t0: 36, t1: 48 },
  { id: 5, title: 'NIGHTFALL', t0: 48, t1: 58 },
] as const;
export const DURATION = 58;

function orbitPose(target: [number, number, number], az: number, el: number, r: number): Pose {
  return {
    pos: [target[0] + r * Math.cos(el * D) * Math.cos(az * D), target[1] + r * Math.sin(el * D), target[2] + r * Math.cos(el * D) * Math.sin(az * D)],
    target,
  };
}

const START: Pose = orbitPose(T, 146, 4, 46);

const SHOTS: Shot[] = [
  // 01 — out of the dark, a slow approach on the rear three-quarter
  { t0: 0, t1: 8, kind: 'orbit', target: T, az: [146, 140], el: [4, 9], r: [46, 25], ease: outCubic },
  // 02 — continuous orbit: three-quarter → side profile (a beat) → front
  { t0: 8, t1: 13.5, kind: 'orbit', target: T, az: [140, 91], el: [9, 2], r: [25, 27], ease: inOut },
  { t0: 13.5, t1: 15.5, kind: 'orbit', target: T, az: [91, 88], el: [2, 2], r: [27, 27], ease: sine },
  { t0: 15.5, t1: 22, kind: 'orbit', target: T, az: [88, 0], el: [2, 5], r: [27, 28], ease: inOut },
  // 03 — exterior detail: nose and glazing, inlet and fairing, outer wing
  { t0: 22, t1: 26.5, kind: 'move', to: { pos: [9.4, 2.4, 5.6], target: [4.4, 0.05, 0.3] } },
  { t0: 26.5, t1: 31, kind: 'move', to: { pos: [6.2, 3.6, 4.4], target: [1.3, 0.65, 0.2] } },
  { t0: 31, t1: 36, kind: 'move', to: { pos: [3.4, 6.6, 14.8], target: [-2.9, -0.25, 5.6] } },
  // 04 — engineering view: transparent shell, systems raised, slow drift
  { t0: 36, t1: 40, kind: 'move', to: orbitPose([0.4, -0.1, 0.3], 52, 38, 22) },
  { t0: 40, t1: 48, kind: 'orbit', target: [0.4, -0.1, 0.3], az: [52, 76], el: [38, 30], r: [22, 23], ease: sine },
  // 05 — hero: back to the assembled aircraft, held
  // the final frame sits the aircraft high so the title has the lower third to itself
  { t0: 48, t1: 53.5, kind: 'move', to: orbitPose(T_END, 48, 13, 25) },
  { t0: 53.5, t1: 58, kind: 'orbit', target: T_END, az: [48, 44], el: [13, 12], r: [25, 24], ease: sine },
];

const v3 = (a: [number, number, number]) => new THREE.Vector3(...a);

function evalShot(s: Shot, t: number, from: Pose): Pose {
  const u = THREE.MathUtils.clamp((t - s.t0) / (s.t1 - s.t0), 0, 1);
  const e = (s.ease ?? inOut)(u);
  if (s.kind === 'orbit') return orbitPose(s.target, THREE.MathUtils.lerp(s.az[0], s.az[1], e), THREE.MathUtils.lerp(s.el[0], s.el[1], e), THREE.MathUtils.lerp(s.r[0], s.r[1], e));
  const p = v3(from.pos).lerp(v3(s.to.pos), e);
  const g = v3(from.target).lerp(v3(s.to.target), e);
  return { pos: p.toArray() as [number, number, number], target: g.toArray() as [number, number, number] };
}

/** Camera pose at time t (moves start exactly where the previous shot ended: no cuts). */
export function poseAt(t: number): Pose {
  let prev = START;
  for (const s of SHOTS) {
    if (t <= s.t1) return evalShot(s, Math.max(t, s.t0), prev);
    prev = evalShot(s, s.t1, prev);
  }
  return prev;
}

const ramp = (t: number, a: number, b: number) => THREE.MathUtils.smoothstep(t, a, b);

/** Studio light level: the aircraft is revealed by the lights in scene 01. */
export const lightAt = (t: number) => 0.04 + 0.96 * ramp(t, 1.2, 7.2) - 0.12 * ramp(t, 49, 53);

/** Render state requested by the timeline. */
export function stateAt(t: number): { render: RenderMode; explode: number } {
  if (t >= 37 && t < 47.6) return { render: 'xray', explode: t < 46.2 ? 0.55 : 0 };
  return { render: 'real', explode: 0 };
}

/** Components carrying a callout at time t. */
export function calloutsAt(t: number): string[] {
  if (t >= 23.6 && t < 26.8) return ['sensor-fwd', 'fwd-fuselage'];
  if (t >= 28 && t < 31.2) return ['inlet', 'fairing'];
  if (t >= 32.6 && t < 36) return ['wing-stbd', 'elevon-stbd-out', 'tip-stbd'];
  if (t >= 39.4 && t < 46) return ['afcm', 'nav', 'spm', 'power', 'thermal', 'propulsion'];
  return [];
}

/** Titles shown over the picture: brand, designation, scene captions. */
export interface Caption {
  kind: 'logo' | 'title' | 'scene' | 'end';
  opacity: number;
}
export function captionsAt(t: number): Caption[] {
  const win = (a: number, b: number, f = 0.9) => Math.min(ramp(t, a, a + f), 1 - ramp(t, b - f, b));
  const out: Caption[] = [];
  const logo = win(0.6, 4.6, 1.1);
  if (logo > 0.001) out.push({ kind: 'logo', opacity: logo });
  const title = win(4.4, 9.2, 1.1);
  if (title > 0.001) out.push({ kind: 'title', opacity: title });
  const end = ramp(t, 51, 53);
  if (end > 0.001) out.push({ kind: 'end', opacity: end });
  return out;
}

export const sceneAt = (t: number) => SCENES.find((s) => t >= s.t0 && t < s.t1) ?? SCENES[SCENES.length - 1];

/** Playback clock (outside React; the timeline UI reads it each frame). */
export const cine = { t: 0, last: 0 };
