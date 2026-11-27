import { REEL } from './reel';
import { orbitPose, outCubic, inOut, sine, ramp, walkShots, type Caption, type CineState, type Pose, type Programme, type Shot, type Transition } from './timeline';

export type { Caption, Pose, Programme } from './timeline';

/**
 * The cinematic presentation: five scenes on one timeline (seconds). Everything is a pure function
 * of time, so the sequence can be paused and scrubbed: camera pose, light level, render mode,
 * separation, captions and callouts.
 */

const T: [number, number, number] = [0.2, -0.15, 0];
const T_END: [number, number, number] = [0.3, -2.1, 0];

const SCENES = [
  { id: 1, title: 'Introduction', t0: 0, t1: 8 },
  { id: 2, title: 'Full aircraft', t0: 8, t1: 22 },
  { id: 3, title: 'Exterior detail', t0: 22, t1: 36 },
  { id: 4, title: 'Engineering view', t0: 36, t1: 48 },
  { id: 5, title: 'NIGHTFALL', t0: 48, t1: 58 },
] as const;
const DURATION = 58;

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

const lightAt = (t: number) => 0.04 + 0.96 * ramp(t, 1.2, 7.2) - 0.12 * ramp(t, 49, 53);

/** Render state requested by the timeline. */
function stateAt(t: number): CineState {
  if (t >= 37 && t < 47.6) return { render: 'xray', explode: t < 46.2 ? 0.55 : 0 };
  return { render: 'real', explode: 0 };
}

/** Components carrying a callout at time t. */
function calloutsAt(t: number): string[] {
  if (t >= 23.6 && t < 26.8) return ['sensor-fwd', 'fwd-fuselage'];
  if (t >= 28 && t < 31.2) return ['inlet', 'fairing'];
  if (t >= 32.6 && t < 36) return ['wing-stbd', 'elevon-stbd-out', 'tip-stbd'];
  if (t >= 39.4 && t < 46) return ['afcm', 'nav', 'spm', 'power', 'thermal', 'propulsion'];
  return [];
}

/** Titles shown over the picture: brand, designation, scene captions. */
function captionsAt(t: number): Caption[] {
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

const PRESENTATION: Programme = {
  id: 'presentation',
  scenes: SCENES,
  duration: DURATION,
  poseAt: (t) => walkShots(SHOTS, START, t),
  lightAt,
  stateAt,
  calloutsAt,
  captionsAt,
  transitions: [],
  bars: true,
};

export const PROGRAMMES = { presentation: PRESENTATION, reel: REEL } as const;
export type ProgrammeId = keyof typeof PROGRAMMES;

/**
 * Playback clock and programme (outside React; the timeline UI reads it each frame).
 * `manual`: the clock is set from outside (frame-by-frame export) and does not advance itself.
 * `snap`: the overlay canvas that holds the captured outgoing frame of a transition.
 */
export const cine = {
  t: 0,
  last: 0,
  prog: 'presentation' as ProgrammeId,
  manual: false,
  clean: false,
  snap: null as HTMLCanvasElement | null,
  active: null as Transition | null,
};

export const prog = (): Programme => PROGRAMMES[cine.prog];
export const poseAt = (t: number) => prog().poseAt(t);
export const sceneAt = (t: number) => {
  const sc = prog().scenes;
  return sc.find((s) => t >= s.t0 && t < s.t1) ?? sc[sc.length - 1];
};
