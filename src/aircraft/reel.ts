import { orbitPose, outCubic, inOut, sine, ramp, win, walkShots, type Caption, type CineState, type Pose, type Programme, type Shot, type Transition } from './timeline';

/**
 * The showcase reel: a fast, ~31-second edit of the existing looks in a fixed order —
 * realistic → transparent → flow field → illustration → bay and pod release → final reveal.
 * Every look, part and motion is one the viewer already has; the reel only sequences them.
 * Like the presentation it is a pure function of time, so it scrubs, and it can be exported
 * frame by frame (`?reel` with the manual clock).
 *
 * The camera never cuts inside a look: scenes 01–03 are one continuous orbit, and the look changes
 * happen under captured-frame transitions (a scan line or a dissolve).
 */

const T: [number, number, number] = [0.2, -0.15, 0];
const T_SYS: [number, number, number] = [0.4, -0.1, 0.3];
const T_REL: [number, number, number] = [0.0, -2.2, 0];
const T_END: [number, number, number] = [0.3, -1.9, 0];

export const REEL_SCENES = [
  { id: 1, title: 'Aircraft', t0: 0, t1: 4.6 },
  { id: 2, title: 'Transparent', t0: 4.6, t1: 7.8 },
  { id: 3, title: 'Flow field', t0: 7.8, t1: 11 },
  { id: 4, title: 'Illustration', t0: 11, t1: 19.4 },
  { id: 5, title: 'Bay and pod', t0: 19.4, t1: 26.2 },
  { id: 6, title: 'NIGHTFALL', t0: 26.2, t1: 31.5 },
] as const;
const DURATION = 31.5;

/** Where each look begins; the frame before is captured and handed over with a transition. */
const TRANSITIONS: Transition[] = [
  { t: 4.6, dur: 0.75, kind: 'scan', from: 'left' },
  { t: 7.8, dur: 0.75, kind: 'scan', from: 'right' },
  { t: 11, dur: 0.9, kind: 'dissolve' },
  { t: 26.2, dur: 0.85, kind: 'scan', from: 'left' },
];

// scene 01 opens close on the nose and pulls out while turning: motion from the first frame
const START: Pose = orbitPose(T, -44, 5, 19);

const SHOTS: Shot[] = [
  // 01–03: one continuous orbit from the port bow over the top to the starboard quarter
  { t0: 0, t1: 4.6, kind: 'orbit', target: T, az: [-44, -20], el: [5, 14], r: [19, 25], ease: outCubic },
  { t0: 4.6, t1: 7.8, kind: 'orbit', target: T_SYS, az: [-24, 22], el: [14, 36], r: [25, 22.5], ease: sine },
  { t0: 7.8, t1: 11, kind: 'orbit', target: T, az: [22, 64], el: [36, 20], r: [22.5, 25], ease: sine },
  // 04: the illustration — whole aircraft from the starboard quarter, then nose, then outer wing
  { t0: 11, t1: 13.2, kind: 'orbit', target: T, az: [64, 118], el: [20, 30], r: [25, 24], ease: inOut },
  { t0: 13.2, t1: 15.4, kind: 'move', to: { pos: [9.4, 2.4, 5.6], target: [4.4, 0.05, 0.3] } },
  { t0: 15.4, t1: 17.4, kind: 'move', to: { pos: [3.4, 6.6, 14.8], target: [-2.9, -0.25, 5.6] } },
  // 05: down and out to the low starboard view that holds the aircraft and the release below it
  { t0: 17.4, t1: 19.6, kind: 'move', to: orbitPose(T_REL, 62, -11, 20.5) },
  { t0: 19.6, t1: 26.2, kind: 'orbit', target: T_REL, az: [62, 54], el: [-11, -8], r: [20.5, 19.5], ease: sine },
  // 06: the assembled aircraft, high in frame so the title has the lower third
  { t0: 26.2, t1: 31.5, kind: 'orbit', target: T_END, az: [30, 46], el: [9, 13], r: [23.5, 25.5], ease: sine },
];

const PAYLOAD = 'payload-env';

function stateAt(t: number): CineState {
  if (t < 4.6) return { render: 'real', explode: 0, bay: 0, release: 0, payload: PAYLOAD };
  // systems rise slightly out of the transparent shell to show their depth
  if (t < 7.8) return { render: 'xray', explode: 0.42 * ramp(t, 5.0, 7.3), bay: 0, release: 0, payload: PAYLOAD };
  if (t < 11) return { render: 'flow', explode: 0, bay: 0, release: 0, payload: PAYLOAD };
  if (t < 26.2)
    return {
      render: 'sheet',
      explode: 0,
      bay: ramp(t, 20.0, 21.3),
      release: Math.min(1, Math.max(0, (t - 21.6) / 3.4)),
      payload: PAYLOAD,
    };
  return { render: 'real', explode: 0, bay: 0, release: 0, payload: PAYLOAD };
}

function calloutsAt(t: number): string[] {
  if (t >= 14.2 && t < 15.5) return ['sensor-fwd', 'fwd-fuselage'];
  if (t >= 16.4 && t < 17.6) return ['wing-stbd', 'elevon-stbd-out', 'tip-stbd'];
  return [];
}

/** One small line per technical scene; it states what the picture is (and is not). */
const LABELS: { a: number; b: number; text: string }[] = [
  { a: 5.0, b: 7.6, text: 'Internal arrangement · transparent shell' },
  { a: 8.2, b: 10.8, text: 'Surface flow · illustrative, not CFD' },
  { a: 11.4, b: 13.4, text: 'General arrangement' },
  { a: 20.0, b: 25.9, text: 'Atmospheric survey pod · non-weapon research module · conceptual sequence' },
];

function captionsAt(t: number, clean = false): Caption[] {
  const out: Caption[] = [];
  if (!clean)
    for (const l of LABELS) {
      const o = win(t, l.a, l.b, 0.35);
      if (o > 0.001) out.push({ kind: 'label', opacity: o, text: l.text });
    }
  const end = ramp(t, 27.6, 28.9);
  if (end > 0.001) out.push({ kind: 'end', opacity: end });
  return out;
}

export const REEL: Programme = {
  id: 'reel',
  scenes: REEL_SCENES,
  duration: DURATION,
  poseAt: (t) => walkShots(SHOTS, START, t),
  // the lights are already coming up on the first frame; a slight settle for the end card
  lightAt: (t) => 0.8 + 0.2 * ramp(t, 0, 0.8) - 0.1 * ramp(t, 28, 30),
  stateAt,
  calloutsAt,
  captionsAt,
  transitions: TRANSITIONS,
  bars: false,
};
