/**
 * CX-7 NIGHTFALL — parametric airframe definition (FICTIONAL CONCEPT GEOMETRY)
 *
 * Coordinate convention (used everywhere: model, camera, picking, explode, drawings):
 *   +X  forward (nose points to +X)      units: metres
 *   +Y  up
 *   +Z  starboard (right wing, seen from behind the aircraft)
 *   Origin: on the centreline, roughly mid-length, at the nominal wing reference plane.
 *   Ground plane (gear extended) sits at Y = GROUND_Y.
 *
 * The planform is a pair of polylines (leading and trailing edge) over half-span z >= 0.
 * Surface heights come from one shared function pair `hUp` / `hLo`, so the 3D mesh,
 * the orthographic three-view drawing and the specification sheet all derive from the
 * same numbers. Nothing here is aerodynamically or signature-validated; it is art direction.
 */

export type Vec2 = [number, number];

/** Leading edge as [z, x] pairs (half-span → chordwise station). */
export const LE_PTS: Vec2[] = [
  [0, 7.4],
  [0.3, 6.75],
  [0.65, 5.75],
  [1.2, 4.0],
  [2.3, 1.3],
  [8.4, -3.85],
];

/** Trailing edge as [z, x] pairs. The flat centre segment carries the slot exhaust. */
export const TE_PTS: Vec2[] = [
  [0, -6.8],
  [0.95, -6.8],
  [2.7, -4.7],
  [5.3, -5.7],
  [8.4, -4.6],
];

export const NOSE_X = 7.4;
export const TAIL_X = -6.8;
export const HALF_SPAN = 8.4;
export const ROOT_Z = 2.4; // centre-body / outer-wing joint
export const TIP_Z = 7.6; // outer-wing / drooped tip-blade joint
export const X_FWD = 2.3; // forward fuselage / centre body joint (also the inlet station)
export const X_AFT = -2.6; // centre body / aft body joint
export const GROUND_Y = -1.75;
export const HINGE_S = 0.8; // elevon hinge line as chord fraction

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

function interp(pts: Vec2[], z: number): number {
  const az = Math.abs(z);
  if (az <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    const [z1, x1] = pts[i];
    const [z0, x0] = pts[i - 1];
    if (az <= z1) return lerp(x0, x1, (az - z0) / (z1 - z0));
  }
  return pts[pts.length - 1][1];
}

export const xLE = (z: number) => interp(LE_PTS, z);
export const xTE = (z: number) => interp(TE_PTS, z);
export const chord = (z: number) => Math.max(1e-6, xLE(z) - xTE(z));

/** Is the plan-view point inside the planform? */
export const insidePlanform = (x: number, z: number) =>
  Math.abs(z) <= HALF_SPAN && x <= xLE(z) + 1e-9 && x >= xTE(z) - 1e-9;

/**
 * Half-width of the contiguous planform strip starting at the centreline.
 * (Outboard lobes behind the trailing-edge notch are excluded on purpose.)
 */
const EDGE_TABLE: number[] = [];
const EDGE_X0 = TAIL_X;
const EDGE_DX = 0.005;
(function buildEdgeTable() {
  for (let x = EDGE_X0; x <= NOSE_X + 1e-9; x += EDGE_DX) {
    let z = 0;
    const step = 0.002;
    while (z + step <= HALF_SPAN && insidePlanform(x, z + step)) z += step;
    EDGE_TABLE.push(z);
  }
})();
export function zEdgeInner(x: number): number {
  const f = (clamp(x, TAIL_X, NOSE_X) - EDGE_X0) / EDGE_DX;
  const i = Math.floor(f);
  const a = EDGE_TABLE[Math.min(i, EDGE_TABLE.length - 1)];
  const b = EDGE_TABLE[Math.min(i + 1, EDGE_TABLE.length - 1)];
  return lerp(a, b, f - i);
}
/** Body-region half width: planform edge or the root joint, whichever is nearer. */
export const zBody = (x: number) => Math.min(zEdgeInner(x), ROOT_Z);

/** Symmetric closed-trailing-edge thickness form, normalised so max ≈ 1 near s = 0.3. */
export function af(s: number): number {
  const t = clamp(s);
  return (
    (0.2969 * Math.sqrt(t) - 0.126 * t - 0.3516 * t * t + 0.2843 * t * t * t - 0.1036 * t * t * t * t) / 0.1
  );
}

/** Chord fraction (0 at leading edge, 1 at trailing edge). */
export const sOf = (x: number, z: number) => clamp((xLE(z) - x) / chord(z));

const p = (x: number) => clamp((NOSE_X - x) / (NOSE_X - TAIL_X));

/** Dorsal centre-body profile (added on top of the wing section). */
export function bodyUpper(x: number): number {
  const q = p(x);
  if (q < 0.42) return 0.68 * Math.pow(Math.sin((Math.PI / 2) * (q / 0.42)), 0.9);
  return 0.68 - 0.46 * smoothstep(0.42, 1, q);
}
/** Ventral centre-body depth (positive number, subtracted). */
export function bodyLower(x: number): number {
  const q = p(x);
  if (q < 0.35) return 0.4 * Math.pow(Math.sin((Math.PI / 2) * (q / 0.35)), 0.7);
  return 0.4 - 0.26 * smoothstep(0.35, 1, q);
}
/** Centre-body half width before it is limited by the planform edge. */
export const bodyWidth = (x: number) => (x >= -1 ? 1.65 : lerp(0.98, 1.65, smoothstep(-6.8, -1, x)));

/** Fade the body hump to zero at the swept trailing edge (keeps the shell closed). */
function teFade(x: number, z: number) {
  const az = Math.abs(z);
  const atTE = clamp((x - xTE(az)) / 0.35);
  return lerp(1, atTE, smoothstep(0.75, 0.95, az));
}

/** Drooped "tip blade" — a CX-7 signature cue. */
export const droop = (z: number) => {
  const az = Math.abs(z);
  return az > TIP_Z ? -0.3 * Math.pow((az - TIP_Z) / (HALF_SPAN - TIP_Z), 2) : 0;
};

function wingThickness(z: number) {
  const az = Math.abs(z);
  const tc = lerp(0.085, 0.055, clamp((az - ROOT_Z) / (HALF_SPAN - ROOT_Z)));
  return tc * Math.min(chord(az), 6.2);
}

function bodyCross(x: number, z: number, exp: number) {
  const wB = Math.min(zEdgeInner(x), bodyWidth(x));
  if (wB <= 1e-6) return 0;
  const t = Math.abs(z) / wB;
  if (t >= 1) return 0;
  return Math.pow(1 - t * t, exp);
}

/** Upper outer-mould-line height at plan position (x, z). */
export function hUp(x: number, z: number): number {
  const s = sOf(x, z);
  const A = af(s);
  const wing = 0.56 * wingThickness(z) * A;
  const body = bodyUpper(x) * bodyCross(x, z, 1.6) * teFade(x, z);
  return wing + body + droop(z);
}

/** Lower outer-mould-line height at plan position (x, z). */
export function hLo(x: number, z: number): number {
  const s = sOf(x, z);
  const A = af(s);
  const wing = -0.44 * wingThickness(z) * A;
  const body = -bodyLower(x) * bodyCross(x, z, 0.85) * teFade(x, z);
  return wing + body + droop(z);
}

/* ---------------- Dorsal propulsion fairing (engine housing + inlet) ---------------- */

export const FAIRING_TAIL_X = -5.6;
export const FAIRING_LIP_RAKE = 0.3;
export const fairingWidth = (x: number) => lerp(0.4, 0.85, smoothstep(-5.6, -1.5, x));
/** Fairing extra height as a function of u (0 tail → 1 lip). */
export function fairingRise(u: number): number {
  if (u < 0.75) return 0.36 * Math.pow(Math.sin((Math.PI / 2) * (u / 0.75)), 0.8);
  return lerp(0.36, 0.3, (u - 0.75) / 0.25);
}
/** Fairing point from (u ∈ [0,1], v ∈ [-1,1]). Returns [x, y, z]. */
export function fairingPoint(u: number, v: number): [number, number, number] {
  const xFront = X_FWD + FAIRING_LIP_RAKE * (1 - v * v) * smoothstep(0.85, 1, u);
  const xBase = lerp(FAIRING_TAIL_X, X_FWD, u);
  const x = u > 0.85 ? lerp(xBase, xFront, smoothstep(0.85, 1, u)) : xBase;
  const w = fairingWidth(xBase);
  const z = v * w;
  const cross = Math.pow(Math.max(0, 1 - v * v), 1.2);
  const y = hUp(x, z) + fairingRise(u) * cross + 0.004;
  return [x, y, z];
}

/* ---------------- Derived envelope (used by spec sheet + validation) ---------------- */

export const MAIN_WHEEL_R = 0.36;
export const NOSE_WHEEL_R = 0.28;

export function envelope() {
  let maxY = -Infinity;
  for (let u = 0; u <= 1.0001; u += 0.01) {
    const [, y] = fairingPoint(u, 0);
    maxY = Math.max(maxY, y);
  }
  for (let x = TAIL_X; x <= NOSE_X; x += 0.02) maxY = Math.max(maxY, hUp(x, 0));
  return {
    length: NOSE_X - TAIL_X,
    span: HALF_SPAN * 2,
    heightGearDown: maxY - GROUND_Y,
    topY: maxY,
  };
}

/** Planform area (both halves) by numeric integration — concept estimate only. */
export function planformArea(): number {
  let a = 0;
  const dz = 0.01;
  for (let z = 0; z < HALF_SPAN; z += dz) a += chord(z + dz / 2) * dz;
  return 2 * a;
}
