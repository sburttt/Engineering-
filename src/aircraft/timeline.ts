import * as THREE from 'three';
import type { RenderMode } from '../state/store';

/** Shared timeline vocabulary for the cinematic programmes: shots, easing, state, transitions. */

/** The full timeline state a programme requests at time t. */
export interface CineState {
  render: RenderMode;
  explode: number;
  /** Programmes that drive the bay and the module release directly (0..1); omitted: left alone. */
  bay?: number;
  release?: number;
  payload?: string;
}

/** A render-mode change on the timeline, shown with a captured-frame transition. */
export interface Transition {
  t: number;
  dur: number;
  kind: 'scan' | 'dissolve';
  /** scan direction: the new look is revealed from this side */
  from?: 'left' | 'right';
}

export interface Caption {
  kind: 'logo' | 'title' | 'scene' | 'end' | 'label';
  opacity: number;
  text?: string;
}

export interface Programme {
  id: 'presentation' | 'reel';
  scenes: readonly { id: number; title: string; t0: number; t1: number }[];
  duration: number;
  poseAt: (t: number) => Pose;
  lightAt: (t: number) => number;
  stateAt: (t: number) => CineState;
  calloutsAt: (t: number) => string[];
  captionsAt: (t: number, clean?: boolean) => Caption[];
  transitions: Transition[];
  /** letterbox bars over the picture */
  bars: boolean;
}

export interface Pose {
  pos: [number, number, number];
  target: [number, number, number];
}
export type Ease = (t: number) => number;
export const inOut: Ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const sine: Ease = (t) => 0.5 - 0.5 * Math.cos(Math.PI * t);
export const outCubic: Ease = (t) => 1 - Math.pow(1 - t, 3);

export type Shot =
  | { t0: number; t1: number; kind: 'move'; to: Pose; ease?: Ease }
  | { t0: number; t1: number; kind: 'orbit'; target: [number, number, number]; az: [number, number]; el: [number, number]; r: [number, number]; ease?: Ease };

const D = Math.PI / 180;

export function orbitPose(target: [number, number, number], az: number, el: number, r: number): Pose {
  return {
    pos: [target[0] + r * Math.cos(el * D) * Math.cos(az * D), target[1] + r * Math.sin(el * D), target[2] + r * Math.cos(el * D) * Math.sin(az * D)],
    target,
  };
}

const v3 = (a: [number, number, number]) => new THREE.Vector3(...a);

export function evalShot(s: Shot, t: number, from: Pose): Pose {
  const u = THREE.MathUtils.clamp((t - s.t0) / (s.t1 - s.t0), 0, 1);
  const e = (s.ease ?? inOut)(u);
  if (s.kind === 'orbit') return orbitPose(s.target, THREE.MathUtils.lerp(s.az[0], s.az[1], e), THREE.MathUtils.lerp(s.el[0], s.el[1], e), THREE.MathUtils.lerp(s.r[0], s.r[1], e));
  const p = v3(from.pos).lerp(v3(s.to.pos), e);
  const g = v3(from.target).lerp(v3(s.to.target), e);
  return { pos: p.toArray() as [number, number, number], target: g.toArray() as [number, number, number] };
}

/** Camera pose at time t (moves start exactly where the previous shot ended: no cuts). */
export function walkShots(shots: Shot[], start: Pose, t: number): Pose {
  let prev = start;
  for (const s of shots) {
    if (t <= s.t1) return evalShot(s, Math.max(t, s.t0), prev);
    prev = evalShot(s, s.t1, prev);
  }
  return prev;
}

export const ramp = (t: number, a: number, b: number) => THREE.MathUtils.smoothstep(t, a, b);
/** 0 → 1 → 0 window with soft edges of length f. */
export const win = (t: number, a: number, b: number, f = 0.5) => Math.min(ramp(t, a, a + f), 1 - ramp(t, b - f, b));
