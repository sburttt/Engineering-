import * as THREE from 'three';
import {
  GROUND_Y,
  HINGE_S,
  MAIN_WHEEL_R,
  NOSE_WHEEL_R,
  NOSE_X,
  ROOT_Z,
  TAIL_X,
  TIP_Z,
  HALF_SPAN,
  X_AFT,
  X_FWD,
  FAIRING_TAIL_X,
  chord,
  fairingPoint,
  fairingWidth,
  hLo,
  hUp,
  lerp,
  smoothstep,
  xLE,
  zBody,
} from './geometry/airframe';
import {
  P3,
  baked,
  edgeCluster,
  gridSurface,
  linesGeometry,
  loftTube,
  mergeGeos,
  rbox,
  ringFace,
  ringX,
  stripBetween,
} from './geometry/builders';

export type MatKey =
  | 'skin'
  | 'skinSatin'
  | 'panel'
  | 'glass'
  | 'inletDark'
  | 'exhaust'
  | 'interior'
  | 'struct'
  | 'module'
  | 'moduleLight'
  | 'metal'
  | 'rubber'
  | 'copper'
  | 'amber'
  | 'indicator'
  | 'cable'
  | 'duct'
  | 'line'
  | 'decal-wordmark'
  | 'decal-reg'
  | 'decal-nostep'
  | 'decal-intake'
  | 'decal-belly';

export type Driver = 'elevon-port' | 'elevon-stbd' | 'bay-door';

export interface Part {
  key: string;
  componentId: string;
  geometry: THREE.BufferGeometry;
  mat: MatKey;
  /** shell: outer mould line (clipped in partial cutaway, ghosted in internal view). */
  role: 'shell' | 'internal' | 'hardware';
  kind?: 'mesh' | 'lines' | 'instanced';
  instances?: THREE.Matrix4[];
  skin?: 'up' | 'lo';
  explodeExtra?: [number, number, number];
  pivot?: { origin: P3; axis: P3; driver: Driver; sense: number };
  payload?: string;
}

const UP = new THREE.Vector3(0, 1, 0);
const DOWN = new THREE.Vector3(0, -1, 0);

type Surf = 'up' | 'lo';
const H = (s: Surf) => (s === 'up' ? hUp : hLo);
const off = (s: Surf, d: number) => (s === 'up' ? d : -d);

/* ------------------------------------------------------------------ */
/* Surface helpers                                                     */
/* ------------------------------------------------------------------ */

/** Body patch over x ∈ [x0,x1] with z between zA(x) and zB(x). */
function bodyPatch(
  x0: number,
  x1: number,
  zA: (x: number) => number,
  zB: (x: number) => number,
  s: Surf,
  nu: number,
  nv: number,
  cluster: 'both' | 'b' | 'none' = 'both',
  lift = 0,
) {
  const h = H(s);
  return gridSurface(
    nu,
    nv,
    (u, v) => {
      const x = lerp(x0, x1, u);
      let t = v;
      if (cluster === 'both') t = (edgeCluster(v) + 1) / 2;
      else if (cluster === 'b') t = Math.sin((v * Math.PI) / 2);
      const z = lerp(zA(x), zB(x), t);
      return [x, h(x, z) + off(s, lift), z];
    },
    s === 'up' ? UP : DOWN,
  );
}

/** Wing patch over z ∈ [z0,z1] (signed by side) and chord fraction s ∈ [s0,s1]. */
function wingPatch(side: number, z0: number, z1: number, s0: number, s1: number, s: Surf, nz: number, ns: number, lift = 0) {
  const h = H(s);
  return gridSurface(
    nz,
    ns,
    (u, v) => {
      const az = lerp(z0, z1, u);
      // cluster samples toward the leading edge when the patch starts there
      const sc = s0 === 0 ? s1 * (1 - Math.cos((v * Math.PI) / 2)) : lerp(s0, s1, v);
      const x = xLE(az) - sc * chord(az);
      const z = az * side;
      return [x, h(x, z) + off(s, lift), z];
    },
    s === 'up' ? UP : DOWN,
  );
}

function surfPoint(x: number, z: number, s: Surf, lift = 0.004): P3 {
  return [x, H(s)(x, z) + off(s, lift), z];
}

/** Sample a plan-view polyline onto a surface (for seam lines). */
function seam(pts: [number, number][], s: Surf, lift = 0.004, step = 0.08): P3[] {
  const out: P3[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, z0] = pts[i];
    const [x1, z1] = pts[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / step));
    for (let k = 0; k < n; k++) out.push(surfPoint(lerp(x0, x1, k / n), lerp(z0, z1, k / n), s, lift));
  }
  const l = pts[pts.length - 1];
  out.push(surfPoint(l[0], l[1], s, lift));
  return out;
}

/** Wing seam at chord fraction s between |z| z0..z1. */
function wingSeamS(side: number, sc: number, z0: number, z1: number, surf: Surf) {
  const pts: [number, number][] = [];
  for (let i = 0; i <= 24; i++) {
    const az = lerp(z0, z1, i / 24);
    pts.push([xLE(az) - sc * chord(az), az * side]);
  }
  return seam(pts, surf, 0.004, 1);
}
function wingSeamZ(side: number, az: number, s0: number, s1: number, surf: Surf) {
  const pts: [number, number][] = [];
  for (let i = 0; i <= 16; i++) {
    const sc = lerp(s0, s1, i / 16);
    pts.push([xLE(az) - sc * chord(az), az * side]);
  }
  return seam(pts, surf, 0.004, 1);
}

/** Matrix that places an object tangent to the surface at (x,z), with its local Y = surface normal. */
function tangentMatrix(x: number, z: number, s: Surf, lift: number, scale = 1, upHint = new THREE.Vector3(1, 0, 0)) {
  const nUp = surfaceNormalUp(x, z, s);
  const p = new THREE.Vector3(x, H(s)(x, z) + off(s, lift), z);
  const fwd = upHint.clone().sub(nUp.clone().multiplyScalar(upHint.dot(nUp))).normalize();
  const right = new THREE.Vector3().crossVectors(nUp, fwd).normalize();
  const m = new THREE.Matrix4().makeBasis(right, nUp, fwd);
  m.setPosition(p);
  m.scale(new THREE.Vector3(scale, scale, scale));
  return m;
}
function surfaceNormalUp(x: number, z: number, s: Surf) {
  const e = 0.02;
  const h = H(s);
  const dx = (h(x + e, z) - h(x - e, z)) / (2 * e);
  const dz = (h(x, z + e) - h(x, z - e)) / (2 * e);
  return s === 'up' ? new THREE.Vector3(-dx, 1, -dz).normalize() : new THREE.Vector3(dx, -1, dz).normalize();
}

/** A flat decal quad tangent to the upper surface. `along` is the text baseline direction in plan view. */
function decal(x: number, z: number, w: number, h: number, s: Surf, along: THREE.Vector3): THREE.BufferGeometry {
  const n = surfaceNormalUp(x, z, s);
  const right = along.clone().sub(n.clone().multiplyScalar(along.dot(n))).normalize();
  const up = new THREE.Vector3().crossVectors(n, right).normalize();
  const g = new THREE.PlaneGeometry(w, h);
  const m = new THREE.Matrix4().makeBasis(right, up, n);
  m.setPosition(new THREE.Vector3(x, H(s)(x, z) + off(s, 0.006), z));
  g.applyMatrix4(m);
  return g;
}

/* ------------------------------------------------------------------ */
/* Access panel helper (patch + outline + fastener ring)                */
/* ------------------------------------------------------------------ */

const FASTENER = new THREE.CylinderGeometry(0.011, 0.011, 0.004, 8);

function accessPanel(id: string, x0: number, x1: number, z0: number, z1: number, s: Surf = 'up'): Part[] {
  const geo = gridSurface(10, 8, (u, v) => {
    const x = lerp(x0, x1, u);
    const z = lerp(z0, z1, v);
    return [x, H(s)(x, z) + off(s, 0.005), z];
  }, s === 'up' ? UP : DOWN);
  const outline = linesGeometry([seam([[x0, z0], [x1, z0], [x1, z1], [x0, z1], [x0, z0]], s, 0.008, 0.05)]);
  const inst: THREE.Matrix4[] = [];
  const inset = 0.035;
  const edges: [number, number, number, number][] = [
    [x0 + inset, z0 + inset, x1 - inset, z0 + inset],
    [x1 - inset, z0 + inset, x1 - inset, z1 - inset],
    [x1 - inset, z1 - inset, x0 + inset, z1 - inset],
    [x0 + inset, z1 - inset, x0 + inset, z0 + inset],
  ];
  for (const [ax, az, bx, bz] of edges) {
    const n = Math.max(2, Math.round(Math.hypot(bx - ax, bz - az) / 0.12));
    for (let k = 0; k < n; k++) inst.push(tangentMatrix(lerp(ax, bx, k / n), lerp(az, bz, k / n), s, 0.007));
  }
  return [
    { key: `${id}-skin`, componentId: id, geometry: geo, mat: 'panel', role: 'shell', skin: s },
    { key: `${id}-outline`, componentId: id, geometry: outline, mat: 'line', role: 'shell', kind: 'lines', skin: s },
    { key: `${id}-fasteners`, componentId: id, geometry: FASTENER, mat: 'metal', role: 'shell', kind: 'instanced', instances: inst, skin: s },
  ];
}

/* ------------------------------------------------------------------ */
/* Build                                                               */
/* ------------------------------------------------------------------ */

const BAY = { x0: -1.2, x1: 1.8, z: 0.6 };

export function buildParts(): Part[] {
  const parts: Part[] = [];
  const add = (p: Part) => parts.push(p);
  const NB = (x: number) => -zBody(x);
  const PB = (x: number) => zBody(x);

  /* ---------- Forward fuselage ---------- */
  add({ key: 'fwd-up', componentId: 'fwd-fuselage', geometry: bodyPatch(X_FWD, NOSE_X, NB, PB, 'up', 70, 56), mat: 'skin', role: 'shell', skin: 'up' });
  add({ key: 'fwd-lo', componentId: 'fwd-fuselage', geometry: bodyPatch(X_FWD, NOSE_X, NB, PB, 'lo', 70, 56), mat: 'skin', role: 'shell', skin: 'lo' });
  // radome (satin) overlay forward of the seam at X 5.2 — upper
  add({ key: 'fwd-radome', componentId: 'fwd-fuselage', geometry: bodyPatch(5.2, NOSE_X, (x) => -zBody(x) * 0.999, (x) => zBody(x) * 0.999, 'up', 40, 40, 'both', 0.002), mat: 'skinSatin', role: 'shell', skin: 'up' });

  /* ---------- Centre body ---------- */
  const FW = (x: number) => fairingWidth(x);
  add({ key: 'ctr-up-s', componentId: 'ctr-body', geometry: bodyPatch(X_AFT, X_FWD, FW, PB, 'up', 60, 30, 'b'), mat: 'skin', role: 'shell', skin: 'up' });
  add({ key: 'ctr-up-p', componentId: 'ctr-body', geometry: bodyPatch(X_AFT, X_FWD, NB, (x) => -FW(x), 'up', 60, 30, 'none'), mat: 'skin', role: 'shell', skin: 'up' });
  add({ key: 'ctr-lo-f', componentId: 'ctr-body', geometry: bodyPatch(BAY.x1, X_FWD, NB, PB, 'lo', 8, 56), mat: 'skin', role: 'shell', skin: 'lo' });
  add({ key: 'ctr-lo-a', componentId: 'ctr-body', geometry: bodyPatch(X_AFT, BAY.x0, NB, PB, 'lo', 20, 56), mat: 'skin', role: 'shell', skin: 'lo' });
  add({ key: 'ctr-lo-s', componentId: 'ctr-body', geometry: bodyPatch(BAY.x0, BAY.x1, () => BAY.z, PB, 'lo', 30, 26, 'b'), mat: 'skin', role: 'shell', skin: 'lo' });
  add({ key: 'ctr-lo-p', componentId: 'ctr-body', geometry: bodyPatch(BAY.x0, BAY.x1, NB, () => -BAY.z, 'lo', 30, 26, 'none'), mat: 'skin', role: 'shell', skin: 'lo' });

  /* ---------- Aft body ---------- */
  add({ key: 'aft-up-s', componentId: 'aft-body', geometry: bodyPatch(FAIRING_TAIL_X, X_AFT, FW, PB, 'up', 40, 30, 'b'), mat: 'skin', role: 'shell', skin: 'up' });
  add({ key: 'aft-up-p', componentId: 'aft-body', geometry: bodyPatch(FAIRING_TAIL_X, X_AFT, NB, (x) => -FW(x), 'up', 40, 30, 'none'), mat: 'skin', role: 'shell', skin: 'up' });
  add({ key: 'aft-up-t', componentId: 'aft-body', geometry: bodyPatch(TAIL_X, FAIRING_TAIL_X, NB, PB, 'up', 16, 56), mat: 'skin', role: 'shell', skin: 'up' });
  add({ key: 'aft-lo', componentId: 'aft-body', geometry: bodyPatch(TAIL_X, X_AFT, NB, PB, 'lo', 50, 56), mat: 'skin', role: 'shell', skin: 'lo' });

  /* ---------- Exhaust ---------- */
  const yMidTail = (hUp(TAIL_X, 0) + hLo(TAIL_X, 0)) / 2;
  const slotA = 0.68;
  const slotB = 0.075;
  add({
    key: 'exhaust-base',
    componentId: 'exhaust',
    geometry: ringFace(
      96,
      (th) => {
        const z = 0.949 * Math.cos(th);
        const y = Math.sin(th) >= 0 ? hUp(TAIL_X, z) : hLo(TAIL_X, z);
        return [TAIL_X, y, z];
      },
      (th) => {
        const s = Math.sin(th);
        return [TAIL_X, yMidTail + Math.sign(s) * Math.pow(Math.abs(s), 0.5) * slotB, slotA * Math.cos(th)];
      },
      new THREE.Vector3(-1, 0, 0),
    ),
    mat: 'exhaust',
    role: 'shell',
  });
  add({
    key: 'exhaust-duct',
    componentId: 'exhaust',
    geometry: loftTube(
      (t) => new THREE.Vector3(lerp(-5.0, TAIL_X, t), lerp(0.1, yMidTail, smoothstep(0, 1, t)), 0),
      (t) => lerp(0.28, slotA, smoothstep(0, 1, t)),
      (t) => lerp(0.28, slotB, smoothstep(0, 0.9, t)),
      (t) => lerp(2, 4, t),
      30,
      40,
    ),
    mat: 'exhaust',
    role: 'internal',
  });

  /* ---------- Seams on the body ---------- */
  const bodySeams: P3[][] = [];
  for (const x of [X_FWD, X_AFT, 5.2]) {
    const pts: [number, number][] = [];
    const w = zBody(x);
    for (let i = 0; i <= 30; i++) pts.push([x, lerp(-w, w, i / 30)]);
    bodySeams.push(seam(pts, 'up'), seam(pts, 'lo'));
  }
  // root joints
  for (const sgn of [-1, 1]) {
    const pts: [number, number][] = [];
    for (let i = 0; i <= 20; i++) {
      const sc = i / 20;
      pts.push([xLE(ROOT_Z) - sc * chord(ROOT_Z), sgn * ROOT_Z]);
    }
    bodySeams.push(seam(pts, 'up'), seam(pts, 'lo'));
    // fairing edge seam
    const fe: [number, number][] = [];
    for (let i = 0; i <= 40; i++) {
      const x = lerp(FAIRING_TAIL_X, X_FWD, i / 40);
      fe.push([x, sgn * fairingWidth(x)]);
    }
    bodySeams.push(seam(fe, 'up', 0.007));
  }
  // bay door outline + centre split
  bodySeams.push(seam([[BAY.x0, -BAY.z], [BAY.x1, -BAY.z], [BAY.x1, BAY.z], [BAY.x0, BAY.z], [BAY.x0, -BAY.z]], 'lo', 0.009, 0.05));
  // gear wells
  bodySeams.push(seam([[4.3, -0.22], [5.2, -0.22], [5.2, 0.22], [4.3, 0.22], [4.3, -0.22]], 'lo', 0.006, 0.05));
  for (const sg of [-1, 1]) bodySeams.push(seam([[-2.3, sg * 1.62], [-0.9, sg * 1.62], [-0.9, sg * 2.2], [-2.3, sg * 2.2], [-2.3, sg * 1.62]], 'lo', 0.006, 0.05));
  add({ key: 'ctr-seams', componentId: 'ctr-body', geometry: linesGeometry(bodySeams), mat: 'line', role: 'shell', kind: 'lines' });

  /* ---------- Outer wings, elevons, tips ---------- */
  const EL_IN: [number, number] = [3.0, 4.8];
  const EL_OUT: [number, number] = [5.5, 7.4];
  for (const [side, sign] of [['port', -1], ['stbd', 1]] as const) {
    const wid = `wing-${side}`;
    for (const surf of ['up', 'lo'] as Surf[]) {
      add({ key: `${wid}-${surf}`, componentId: wid, geometry: wingPatch(sign, ROOT_Z, TIP_Z, 0, HINGE_S, surf, 48, 40), mat: 'skin', role: 'shell', skin: surf });
      // fixed trailing-edge strips between elevons
      for (const [a, b] of [[ROOT_Z, EL_IN[0]], [EL_IN[1], EL_OUT[0]], [EL_OUT[1], TIP_Z]]) {
        add({ key: `${wid}-te-${a}-${surf}`, componentId: wid, geometry: wingPatch(sign, a, b, HINGE_S, 1, surf, 6, 8), mat: 'skin', role: 'shell', skin: surf });
      }
      // tip blade
      add({ key: `tip-${side}-${surf}`, componentId: `tip-${side}`, geometry: wingPatch(sign, TIP_Z, HALF_SPAN, 0, 1, surf, 14, 36), mat: 'skin', role: 'shell', skin: surf });
    }
    // elevons (closed shells, hinged on s = HINGE_S)
    for (const [nm, [a, b]] of [['in', EL_IN], ['out', EL_OUT]] as const) {
      const id = `elevon-${side}-${nm}`;
      const g = mergeGeos([
        wingPatch(sign, a + 0.02, b - 0.02, HINGE_S + 0.004, 1, 'up', 16, 8, 0.001),
        wingPatch(sign, a + 0.02, b - 0.02, HINGE_S + 0.004, 1, 'lo', 16, 8, 0.001),
      ]);
      const hp = (az: number): P3 => {
        const x = xLE(az) - HINGE_S * chord(az);
        const z = az * sign;
        return [x, (hUp(x, z) + hLo(x, z)) / 2, z];
      };
      const o = hp(a);
      const e = hp(b);
      const axis: P3 = [e[0] - o[0], e[1] - o[1], e[2] - o[2]];
      // probe which rotation sense moves the trailing edge down
      const midZ = (a + b) / 2;
      const teX = xLE(midZ) - chord(midZ);
      const probe = new THREE.Vector3(teX, hUp(teX, midZ * sign), midZ * sign).sub(new THREE.Vector3(...o));
      probe.applyAxisAngle(new THREE.Vector3(...axis).normalize(), 0.1);
      const sense = probe.y + o[1] < hUp(teX, midZ * sign) ? 1 : -1;
      add({
        key: id,
        componentId: id,
        geometry: g,
        mat: 'skinSatin',
        role: 'shell',
        pivot: { origin: o, axis, driver: side === 'port' ? 'elevon-port' : 'elevon-stbd', sense },
      });
      const hingeLine = linesGeometry([wingSeamS(sign, HINGE_S, a, b, 'up'), wingSeamS(sign, HINGE_S, a, b, 'lo')]);
      add({ key: `${id}-hinge`, componentId: wid, geometry: hingeLine, mat: 'line', role: 'shell', kind: 'lines' });
    }
    // wing seams
    const ws: P3[][] = [];
    for (const surf of ['up', 'lo'] as Surf[]) {
      ws.push(wingSeamS(sign, 0.12, ROOT_Z, TIP_Z, surf));
      ws.push(wingSeamS(sign, 0.55, ROOT_Z + 0.4, TIP_Z - 0.4, surf));
      for (const az of [4.6, 6.2]) ws.push(wingSeamZ(sign, az, 0.12, HINGE_S, surf));
      ws.push(wingSeamZ(sign, TIP_Z, 0, 1, surf));
    }
    add({ key: `${wid}-seams`, componentId: wid, geometry: linesGeometry(ws), mat: 'line', role: 'shell', kind: 'lines' });
  }

  /* ---------- Dorsal fairing + inlet ---------- */
  add({
    key: 'fairing-skin',
    componentId: 'fairing',
    geometry: gridSurface(80, 40, (u, v) => fairingPoint(u, edgeCluster(v)), UP),
    mat: 'skinSatin',
    role: 'shell',
    skin: 'up',
  });
  add({
    key: 'inlet-throat',
    componentId: 'inlet',
    geometry: gridSurface(40, 6, (u, t) => {
      const v = edgeCluster(u) * 0.995;
      const top = fairingPoint(1, v);
      const z = top[2];
      const bx = X_FWD - 0.12;
      const by = hUp(X_FWD, z) + 0.004;
      return [lerp(bx, top[0] - 0.05, t), lerp(by, top[1] - 0.012, t), z];
    }, new THREE.Vector3(1, 0, 0)),
    mat: 'inletDark',
    role: 'shell',
  });
  // inlet lip trim line
  const lip: P3[] = [];
  for (let i = 0; i <= 40; i++) lip.push(fairingPoint(1, edgeCluster(i / 40)).map((n, k) => (k === 1 ? n + 0.004 : n)) as P3);
  add({ key: 'inlet-lip', componentId: 'inlet', geometry: linesGeometry([lip]), mat: 'line', role: 'shell', kind: 'lines' });

  /* ---------- Sensor apertures ---------- */
  add({
    key: 'sensor-fwd',
    componentId: 'sensor-fwd',
    geometry: bodyPatch(5.75, 6.75, (x) => -zBody(x) * 0.62, (x) => zBody(x) * 0.62, 'lo', 16, 16, 'none', 0.004),
    mat: 'glass',
    role: 'shell',
    skin: 'lo',
  });
  {
    // hexagonal ventral window
    const cx = 3.45;
    const pts: P3[] = [];
    const c = surfPoint(cx, 0, 'lo', 0.006);
    const geo = new THREE.BufferGeometry();
    const verts: number[] = [...c];
    for (let k = 0; k <= 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      const p = surfPoint(cx + Math.cos(a) * 0.17, Math.sin(a) * 0.17, 'lo', 0.006);
      verts.push(...p);
      pts.push(p);
    }
    const idx: number[] = [];
    for (let k = 1; k <= 6; k++) idx.push(0, k + 1, k);
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    add({ key: 'sensor-ventral', componentId: 'sensor-ventral', geometry: geo, mat: 'glass', role: 'shell', skin: 'lo' });
    add({ key: 'sensor-ventral-frame', componentId: 'sensor-ventral', geometry: linesGeometry([pts]), mat: 'line', role: 'shell', kind: 'lines' });
  }
  for (const sg of [-1, 1]) {
    add({
      key: `sensor-lat-${sg}`,
      componentId: 'sensor-lateral',
      geometry: gridSurface(14, 3, (u, v) => {
        const x = lerp(4.45, 4.95, u);
        const w = zBody(x);
        const z = sg * lerp(w * 0.83, w * 0.875, v);
        return [x, hUp(x, z) + 0.004, z];
      }, UP),
      mat: 'glass',
      role: 'shell',
      skin: 'up',
    });
  }

  /* ---------- Access panels ---------- */
  parts.push(...accessPanel('ap-avionics', 2.75, 3.7, -0.42, 0.42));
  parts.push(...accessPanel('ap-nav', 4.0, 4.6, -0.3, 0.3));
  parts.push(...accessPanel('ap-power', -0.15, 1.15, 0.98, 1.48));
  parts.push(...accessPanel('ap-comms', -0.15, 1.15, -1.48, -0.98));
  parts.push(...accessPanel('ap-thermal', -3.45, -2.4, 0.72, 1.22).map((p) => ({ ...p, key: p.key + '-s' })));
  parts.push(...accessPanel('ap-thermal', -3.45, -2.4, -1.22, -0.72).map((p) => ({ ...p, key: p.key + '-p' })));
  {
    const fp = (u: number, v: number): P3 => {
      const p = fairingPoint(u, v);
      return [p[0], p[1] + 0.004, p[2]];
    };
    const geo = gridSurface(16, 8, (u, v) => fp(lerp(0.3, 0.55, u), lerp(-0.5, 0.5, v)), UP);
    const ol: P3[] = [];
    const loop: [number, number][] = [[0.3, -0.5], [0.55, -0.5], [0.55, 0.5], [0.3, 0.5], [0.3, -0.5]];
    for (let i = 0; i < loop.length - 1; i++)
      for (let k = 0; k < 20; k++) {
        const t = k / 20;
        const p = fp(lerp(loop[i][0], loop[i + 1][0], t), lerp(loop[i][1], loop[i + 1][1], t));
        ol.push([p[0], p[1] + 0.003, p[2]]);
      }
    ol.push(ol[0]);
    const inst: THREE.Matrix4[] = [];
    for (let k = 0; k < 14; k++) {
      for (const v of [-0.44, 0.44]) {
        const p = fp(lerp(0.31, 0.54, k / 13), v);
        inst.push(new THREE.Matrix4().makeTranslation(p[0], p[1] + 0.003, p[2]));
      }
    }
    add({ key: 'ap-engine-skin', componentId: 'ap-engine', geometry: geo, mat: 'panel', role: 'shell', skin: 'up' });
    add({ key: 'ap-engine-ol', componentId: 'ap-engine', geometry: linesGeometry([ol]), mat: 'line', role: 'shell', kind: 'lines' });
    add({ key: 'ap-engine-f', componentId: 'ap-engine', geometry: FASTENER, mat: 'metal', role: 'shell', kind: 'instanced', instances: inst });
  }
  // conformal antenna (comms external)
  parts.push(
    ...accessPanel('comms-antenna', -0.6, 0.7, -2.25, -1.85).map((p) => ({ ...p, mat: p.mat === 'panel' ? ('skinSatin' as MatKey) : p.mat })),
  );

  /* ---------- Markings ---------- */
  add({ key: 'decal-wordmark', componentId: 'wing-port', geometry: decal(-1.35, -5.3, 1.9, 0.48, 'up', new THREE.Vector3(0, 0, 1)), mat: 'decal-wordmark', role: 'shell', skin: 'up' });
  add({ key: 'decal-reg', componentId: 'wing-stbd', geometry: decal(-1.5, 5.4, 1.5, 0.3, 'up', new THREE.Vector3(0, 0, 1)), mat: 'decal-reg', role: 'shell', skin: 'up' });
  for (const sg of [-1, 1]) {
    const az = 4.0;
    const x = xLE(az) - 0.7 * chord(az);
    add({ key: `decal-nostep-${sg}`, componentId: sg < 0 ? 'wing-port' : 'wing-stbd', geometry: decal(x, sg * az, 0.42, 0.11, 'up', new THREE.Vector3(0, 0, 1)), mat: 'decal-nostep', role: 'shell', skin: 'up' });
  }
  add({ key: 'decal-intake', componentId: 'fwd-fuselage', geometry: decal(2.95, 0, 0.95, 0.16, 'up', new THREE.Vector3(0, 0, 1)), mat: 'decal-intake', role: 'shell', skin: 'up' });
  add({ key: 'decal-belly', componentId: 'ctr-body', geometry: decal(-2.0, 0, 1.0, 0.25, 'lo', new THREE.Vector3(0, 0, -1)), mat: 'decal-belly', role: 'shell', skin: 'lo' });

  /* ---------- Landing gear ---------- */
  parts.push(...landingGear('nose', 4.75, 0, NOSE_WHEEL_R, 0.065, 0.16));
  parts.push(...landingGear('port', -1.6, -1.9, MAIN_WHEEL_R, 0.085, 0.22));
  parts.push(...landingGear('stbd', -1.6, 1.9, MAIN_WHEEL_R, 0.085, 0.22));

  /* ---------- Equipment bay + doors ---------- */
  parts.push(...equipmentBay());

  /* ---------- Interior ---------- */
  parts.push(...interior());

  return parts;
}

/* ------------------------------------------------------------------ */
/* Landing gear                                                        */
/* ------------------------------------------------------------------ */

function landingGear(side: 'nose' | 'port' | 'stbd', x: number, z: number, R: number, r: number, w: number): Part[] {
  const id = `gear-${side}`;
  const top = hLo(x, z) + 0.18;
  const axleY = GROUND_Y + R;
  const out: Part[] = [];
  const cyl = (rad: number, len: number) => new THREE.CylinderGeometry(rad, rad, len, 20);
  const outerLen = (top - axleY) * 0.58;
  const innerLen = Math.max(0.1, (top - axleY - R - 0.08) * 0.62);
  const strut = mergeGeos([
    baked(cyl(r, outerLen), [x, top - outerLen / 2, z]),
    baked(cyl(r * 0.68, innerLen), [x, axleY + R + 0.08 + innerLen / 2, z]),
    // torque link
    baked(new THREE.BoxGeometry(0.04, 0.2, 0.03), [x + 0.09, axleY + R + 0.1 + innerLen * 0.75, z], [0, 0, 0.5]),
    baked(new THREE.BoxGeometry(0.04, 0.2, 0.03), [x + 0.09, axleY + R + 0.1 + innerLen * 0.3, z], [0, 0, -0.5]),
    // fork: yoke above the tyre, two cheek plates and an axle
    baked(new THREE.BoxGeometry(0.14, 0.05, w + 0.12), [x, axleY + R + 0.07, z]),
    baked(new THREE.BoxGeometry(0.1, R + 0.1, 0.022), [x, axleY + (R + 0.1) / 2, z + w / 2 + 0.045]),
    baked(new THREE.BoxGeometry(0.1, R + 0.1, 0.022), [x, axleY + (R + 0.1) / 2, z - w / 2 - 0.045]),
    baked(new THREE.CylinderGeometry(0.03, 0.03, w + 0.14, 12), [x, axleY, z], [Math.PI / 2, 0, 0]),
    // drag brace (main gear)
    ...(side === 'nose' ? [] : [baked(cyl(0.03, 1.0), [x - 0.32, top - 0.4, z], [0, 0, -0.75])]),
  ]);
  out.push({ key: `${id}-strut`, componentId: `${id}-strut`, geometry: strut, mat: 'metal', role: 'hardware' });
  const wheelOffsets = [0];
  for (const dz of wheelOffsets) {
    const tyre = new THREE.TorusGeometry(R - w * 0.48, w * 0.48, 16, 40);
    const hub = cyl(R * 0.55, w * 0.9);
    out.push({ key: `${id}-tyre`, componentId: `${id}-wheel`, geometry: baked(tyre, [x, axleY, z + dz], [0, 0, 0], [1, 1, 1.0]), mat: 'rubber', role: 'hardware' });
    out.push({ key: `${id}-hub`, componentId: `${id}-wheel`, geometry: baked(hub, [x, axleY, z + dz], [Math.PI / 2, 0, 0]), mat: 'moduleLight', role: 'hardware' });
  }
  // doors (open, hanging)
  if (side === 'nose') {
    for (const sg of [-1, 1]) {
      const g = baked(new THREE.BoxGeometry(0.88, 0.42, 0.018), [4.75, hLo(4.75, sg * 0.22) - 0.21, sg * 0.235], [sg * 0.12, 0, 0]);
      out.push({ key: `${id}-door-${sg}`, componentId: `${id}-doors`, geometry: g, mat: 'skinSatin', role: 'hardware' });
    }
  } else {
    const sg = side === 'port' ? -1 : 1;
    const dz = sg * 2.24;
    const g = baked(new THREE.BoxGeometry(1.36, 0.54, 0.02), [-1.6, hLo(-1.6, dz) - 0.27, dz], [sg * -0.18, 0, 0]);
    out.push({ key: `${id}-door`, componentId: `${id}-doors`, geometry: g, mat: 'skinSatin', role: 'hardware' });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Equipment bay + payloads                                            */
/* ------------------------------------------------------------------ */

let payloadSeq = 0;
function equipmentBay(): Part[] {
  const out: Part[] = [];
  const { x0, x1, z } = BAY;
  const ceil = -0.08;
  const floorAt = (xx: number, zz: number) => hLo(xx, zz);
  const len = x1 - x0;
  const cx = (x0 + x1) / 2;
  const wallH = ceil - floorAt(cx, z) + 0.04;
  const shell = mergeGeos([
    baked(new THREE.BoxGeometry(len + 0.1, 0.02, z * 2 + 0.06), [cx, ceil, 0]),
    baked(new THREE.BoxGeometry(len + 0.1, wallH, 0.02), [cx, ceil - wallH / 2, z + 0.02]),
    baked(new THREE.BoxGeometry(len + 0.1, wallH, 0.02), [cx, ceil - wallH / 2, -z - 0.02]),
    baked(new THREE.BoxGeometry(0.02, wallH, z * 2 + 0.06), [x1 + 0.04, ceil - wallH / 2, 0]),
    baked(new THREE.BoxGeometry(0.02, wallH, z * 2 + 0.06), [x0 - 0.04, ceil - wallH / 2, 0]),
  ]);
  out.push({ key: 'bay-shell', componentId: 'bay', geometry: shell, mat: 'interior', role: 'internal' });
  const rails = mergeGeos([
    baked(new THREE.BoxGeometry(len - 0.1, 0.035, 0.05), [cx, ceil - 0.03, 0.3]),
    baked(new THREE.BoxGeometry(len - 0.1, 0.035, 0.05), [cx, ceil - 0.03, -0.3]),
  ]);
  out.push({ key: 'bay-rails', componentId: 'bay', geometry: rails, mat: 'metal', role: 'internal' });
  out.push({ key: 'bay-connector', componentId: 'bay', geometry: baked(rbox(0.03, 0.14, 0.32, 0.01), [x1 + 0.02, ceil - 0.14, 0]), mat: 'module', role: 'internal' });
  out.push({ key: 'bay-connector-tag', componentId: 'bay', geometry: baked(new THREE.BoxGeometry(0.01, 0.02, 0.22), [x1, ceil - 0.08, 0]), mat: 'indicator', role: 'internal' });

  // doors – hinged at the outer edges
  for (const sg of [-1, 1]) {
    const geo = gridSurface(24, 8, (u, v) => {
      const xx = lerp(x0 + 0.01, x1 - 0.01, u);
      const zz = sg * lerp(0.006, z - 0.006, v);
      return [xx, hLo(xx, zz) - 0.006, zz];
    }, DOWN);
    const o: P3 = [x0, hLo(x0, sg * z) - 0.006, sg * z];
    const e: P3 = [x1, hLo(x1, sg * z) - 0.006, sg * z];
    const axis: P3 = [e[0] - o[0], e[1] - o[1], e[2] - o[2]];
    const probe = new THREE.Vector3(cx, hLo(cx, 0), 0).sub(new THREE.Vector3(...o));
    probe.applyAxisAngle(new THREE.Vector3(...axis).normalize(), 0.2);
    const sense = probe.y + o[1] < hLo(cx, 0) ? 1 : -1;
    out.push({
      key: `bay-door-${sg}`,
      componentId: 'bay-doors',
      geometry: geo,
      mat: 'skin',
      role: 'shell',
      skin: 'lo',
      pivot: { origin: o, axis, driver: 'bay-door', sense },
    });
  }

  // payload modules – only the installed one is rendered
  const yC = -0.3;
  const P = (id: string, g: THREE.BufferGeometry, mat: MatKey): Part => ({ key: `${id}-${mat}-${payloadSeq++}`, componentId: id, geometry: g, mat, role: 'internal', payload: id });
  const cylX = (r: number, l: number, seg = 28) => {
    const g = new THREE.CylinderGeometry(r, r, l, seg);
    g.rotateZ(Math.PI / 2);
    return g;
  };
  // 1. Atmospheric survey pod
  out.push(P('payload-env', mergeGeos([baked(cylX(0.17, 1.9), [cx - 0.1, yC, 0]), baked(new THREE.SphereGeometry(0.17, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), [cx + 0.85, yC, 0], [0, 0, -Math.PI / 2])]), 'moduleLight'));
  out.push(P('payload-env', mergeGeos([baked(cylX(0.18, 0.04), [cx - 0.5, yC, 0]), baked(cylX(0.18, 0.04), [cx + 0.2, yC, 0]), baked(cylX(0.18, 0.04), [cx - 0.95, yC, 0]), baked(rbox(0.5, 0.12, 0.16, 0.01), [cx, yC + 0.2, 0])]), 'module'));
  out.push(P('payload-env', baked(new THREE.SphereGeometry(0.06, 16, 12), [cx + 1.0, yC, 0]), 'glass'));
  // 2. Mapping package
  out.push(P('payload-map', baked(rbox(2.2, 0.2, 0.8, 0.03), [cx, -0.2, 0]), 'module'));
  out.push(P('payload-map', baked(new THREE.SphereGeometry(0.16, 28, 20), [cx + 0.7, -0.4, 0]), 'moduleLight'));
  out.push(P('payload-map', baked(cylX(0.075, 0.04), [cx + 0.85, -0.42, 0]).rotateZ(0), 'glass'));
  out.push(P('payload-map', baked(new THREE.BoxGeometry(1.2, 0.01, 0.5), [cx - 0.35, -0.305, 0]), 'indicator'));
  // 3. Relay module
  out.push(P('payload-relay', baked(rbox(2.0, 0.18, 0.72, 0.03), [cx, -0.19, 0]), 'module'));
  out.push(
    P('payload-relay', mergeGeos([-0.65, 0, 0.65].map((dx) => baked(rbox(0.5, 0.025, 0.46, 0.008), [cx + dx, -0.36, 0], [0, 0, 0.18]))), 'moduleLight'),
  );
  // 4. Science rack
  {
    const cans: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 3; i++) for (const zz of [-0.18, 0.18]) cans.push(baked(new THREE.CylinderGeometry(0.1, 0.1, 0.3, 20), [cx - 0.7 + i * 0.7, -0.31, zz]));
    out.push(P('payload-sci', mergeGeos(cans), 'moduleLight'));
    // top plate plus open lower rails, so the canisters stay visible from below
    out.push(
      P(
        'payload-sci',
        mergeGeos([
          baked(new THREE.BoxGeometry(2.3, 0.03, 0.72), [cx, -0.14, 0]),
          baked(new THREE.BoxGeometry(2.3, 0.04, 0.05), [cx, -0.48, 0.34]),
          baked(new THREE.BoxGeometry(2.3, 0.04, 0.05), [cx, -0.48, -0.34]),
          ...[-1.12, 1.12].flatMap((dx) => [0.34, -0.34].map((dz) => baked(new THREE.BoxGeometry(0.05, 0.34, 0.05), [cx + dx, -0.31, dz]))),
        ]),
        'struct',
      ),
    );
    out.push(P('payload-sci', mergeGeos(cans.map((_, i) => baked(new THREE.CylinderGeometry(0.104, 0.104, 0.02, 20), [cx - 0.7 + Math.floor(i / 2) * 0.7, -0.2, i % 2 ? 0.18 : -0.18]))), 'indicator'));
  }
  // 5. Electronic systems test module
  {
    out.push(P('payload-test', baked(rbox(2.2, 0.24, 0.72, 0.03), [cx, -0.22, 0]), 'module'));
    const fins: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 22; i++) fins.push(baked(new THREE.BoxGeometry(0.012, 0.12, 0.62), [cx - 1.0 + i * 0.095, -0.4, 0]));
    out.push(P('payload-test', mergeGeos(fins), 'metal'));
  }
  // 6. Inert training mass
  out.push(P('payload-inert', baked(rbox(2.2, 0.3, 0.7, 0.02), [cx, -0.25, 0]), 'struct'));
  out.push(P('payload-inert', mergeGeos([-0.8, 0, 0.8].map((dx) => baked(new THREE.BoxGeometry(0.12, 0.31, 0.71), [cx + dx, -0.25, 0]))), 'amber'));
  return out;
}

/* ------------------------------------------------------------------ */
/* Interior systems                                                    */
/* ------------------------------------------------------------------ */

function interior(): Part[] {
  const out: Part[] = [];
  const I = (key: string, componentId: string, g: THREE.BufferGeometry, mat: MatKey, extra?: [number, number, number]): Part => ({
    key,
    componentId,
    geometry: g,
    mat,
    role: 'internal',
    explodeExtra: extra,
  });

  /* Autonomous flight-computing module */
  out.push(I('afcm-chassis', 'afcm-chassis', mergeGeos([baked(rbox(0.95, 0.26, 0.82, 0.03), [3.2, 0.02, 0]), baked(new THREE.BoxGeometry(1.0, 0.03, 0.86), [3.2, -0.13, 0])]), 'module'));
  {
    const cards: THREE.BufferGeometry[] = [];
    const strips: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 8; i++) {
      const x = 2.85 + i * 0.1;
      cards.push(baked(rbox(0.035, 0.3, 0.7, 0.006), [x, 0.27, 0]));
      strips.push(baked(new THREE.BoxGeometry(0.037, 0.012, 0.16), [x, 0.4, 0.22]));
    }
    out.push(I('afcm-cards', 'afcm-cards', mergeGeos(cards), 'moduleLight'));
    out.push(I('afcm-strips', 'afcm-cards', mergeGeos(strips), 'indicator'));
  }

  /* Navigation module */
  out.push(I('nav-box', 'nav', baked(rbox(0.55, 0.28, 0.6, 0.03), [4.3, 0.14, 0]), 'module'));
  out.push(I('nav-dome', 'nav', baked(new THREE.SphereGeometry(0.15, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), [4.3, 0.28, 0]), 'moduleLight'));
  out.push(I('nav-tag', 'nav', baked(new THREE.BoxGeometry(0.2, 0.01, 0.05), [4.12, 0.285, 0.22]), 'indicator'));

  /* Sensor-processing module */
  out.push(I('spm-box', 'spm', baked(rbox(0.8, 0.3, 0.48, 0.03), [5.35, 0.02, 0]), 'module'));
  {
    const fins: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 9; i++) fins.push(baked(new THREE.BoxGeometry(0.014, 0.06, 0.4), [5.0 + i * 0.087, 0.2, 0]));
    out.push(I('spm-fins', 'spm', mergeGeos(fins), 'metal'));
  }

  /* Communications module (port) */
  out.push(I('comms-a', 'comms', mergeGeos([baked(rbox(0.5, 0.26, 0.38, 0.025), [0.8, 0, -1.2]), baked(rbox(0.5, 0.26, 0.38, 0.025), [0.15, 0, -1.2])]), 'module'));
  out.push(I('comms-man', 'comms', baked(new THREE.CylinderGeometry(0.04, 0.04, 1.2, 12).rotateZ(Math.PI / 2), [0.47, 0.16, -1.2]), 'cable'));
  out.push(I('comms-tag', 'comms', baked(new THREE.BoxGeometry(0.3, 0.01, 0.04), [0.8, 0.135, -1.05]), 'indicator'));

  /* Electrical power module (starboard) */
  out.push(I('power-units', 'power', mergeGeos([0.05, 0.45, 0.85].map((x) => baked(rbox(0.34, 0.26, 0.4, 0.02), [x, -0.01, 1.2]))), 'module'));
  out.push(I('power-bus', 'power', baked(new THREE.BoxGeometry(1.15, 0.03, 0.06), [0.45, 0.15, 1.2]), 'copper'));
  out.push(I('power-tag', 'power', mergeGeos([0.05, 0.45, 0.85].map((x) => baked(new THREE.BoxGeometry(0.16, 0.01, 0.03), [x, 0.125, 1.05]))), 'indicator'));

  /* Thermal management (paired exchangers) */
  for (const sg of [-1, 1]) {
    const z = sg * 0.95;
    out.push(I(`thermal-core-${sg}`, 'thermal', baked(rbox(1.0, 0.2, 0.38, 0.02), [-2.9, -0.03, z]), 'moduleLight', [0, 0, sg * 0.6]));
    const fins: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 16; i++) fins.push(baked(new THREE.BoxGeometry(0.01, 0.07, 0.34), [-3.35 + i * 0.06, 0.1, z]));
    out.push(I(`thermal-fins-${sg}`, 'thermal', mergeGeos(fins), 'metal', [0, 0, sg * 0.6]));
    out.push(I(`thermal-pipe-${sg}`, 'thermal', baked(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 10).rotateZ(Math.PI / 2), [-2.9, -0.09, z - sg * 0.24]), 'cable', [0, 0, sg * 0.6]));
  }

  /* Inlet duct */
  const ductPath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(X_FWD - 0.1, hUp(X_FWD, 0) + 0.13, 0),
    new THREE.Vector3(1.0, 0.82, 0),
    new THREE.Vector3(-0.6, 0.42, 0),
    new THREE.Vector3(-2.05, 0.2, 0),
  ]);
  out.push(
    I(
      'duct',
      'inlet-duct',
      loftTube(
        (t) => ductPath.getPoint(t),
        (t) => lerp(0.7, 0.36, smoothstep(0, 0.85, t)),
        (t) => lerp(0.12, 0.36, smoothstep(0, 0.9, t)),
        (t) => lerp(3.2, 2, smoothstep(0, 0.7, t)),
        48,
        36,
      ),
      'duct',
    ),
  );

  /* Propulsion unit */
  const eY = (x: number) => lerp(0.2, 0.1, (-2.05 - x) / 2.95);
  const eR = (x: number) => lerp(0.38, 0.28, (-2.05 - x) / 2.95);
  out.push(
    I(
      'engine-case',
      'propulsion',
      loftTube((t) => new THREE.Vector3(lerp(-2.05, -5.0, t), eY(lerp(-2.05, -5.0, t)), 0), (t) => eR(lerp(-2.05, -5.0, t)), (t) => eR(lerp(-2.05, -5.0, t)), () => 2, 24, 36),
      'metal',
    ),
  );
  {
    const rings: THREE.BufferGeometry[] = [];
    for (const x of [-2.25, -3.0, -3.8, -4.6]) rings.push(baked(new THREE.TorusGeometry(eR(x) + 0.006, 0.018, 8, 40), [x, eY(x), 0], [0, Math.PI / 2, 0]));
    out.push(I('engine-rings', 'propulsion', mergeGeos(rings), 'moduleLight'));
    out.push(I('engine-fan', 'propulsion', baked(new THREE.CylinderGeometry(0.36, 0.36, 0.03, 40).rotateZ(Math.PI / 2), [-2.07, eY(-2.07), 0]), 'module'));
    out.push(I('engine-spinner', 'propulsion', baked(new THREE.ConeGeometry(0.1, 0.22, 24).rotateZ(-Math.PI / 2), [-1.98, eY(-2.0), 0]), 'moduleLight'));
    const blades: THREE.BufferGeometry[] = [];
    for (let k = 0; k < 20; k++) {
      const a = (k / 20) * Math.PI * 2;
      blades.push(baked(new THREE.BoxGeometry(0.02, 0.24, 0.07), [-2.04, eY(-2.04) + Math.cos(a) * 0.22, Math.sin(a) * 0.22], [a, 0, 0.35]));
    }
    out.push(I('engine-blades', 'propulsion', mergeGeos(blades), 'metal'));
    out.push(I('engine-gearbox', 'propulsion', baked(rbox(0.6, 0.14, 0.3, 0.02), [-3.0, eY(-3.0) - eR(-3.0) - 0.05, 0]), 'module'));
  }

  /* Harness (cable runs) */
  {
    const runs: THREE.Vector3[][] = [
      [[3.2, 0.2, 0.3], [3.8, 0.3, 0.25], [4.3, 0.2, 0.2]],
      [[3.4, 0.22, -0.25], [4.4, 0.32, -0.22], [5.1, 0.12, -0.15]],
      [[2.9, 0.1, -0.35], [2.3, 0.25, -0.75], [1.1, 0.12, -1.18]],
      [[2.9, 0.1, 0.35], [2.3, 0.25, 0.75], [0.9, 0.1, 1.2]],
      [[0.2, 0.08, 1.2], [-1.2, 0.18, 1.1], [-2.5, 0.1, 0.95]],
      [[2.8, -0.08, 0.1], [2.2, -0.05, 0.1], [1.9, -0.12, 0.05]],
    ].map((r) => r.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
    const geos = runs.map((r) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(r), 32, 0.018, 8));
    out.push(I('harness', 'harness', mergeGeos(geos), 'cable'));
  }

  /* Structure: frames, spars, ribs */
  {
    const frames: THREE.BufferGeometry[] = [];
    for (const x of [6.3, 5.2, 3.85, 2.55, -1.3, -2.0, -3.4, -5.6]) {
      const W = Math.min(zBody(x), 2.3) * 0.97;
      const ym = (hUp(x, 0) + hLo(x, 0)) / 2;
      const outer = (th: number): [number, number] => {
        const z = W * Math.cos(th);
        const y = Math.sin(th) >= 0 ? hUp(x, z) - 0.02 : hLo(x, z) + 0.02;
        return [z, y];
      };
      const inner = (th: number): [number, number] => {
        const [z, y] = outer(th);
        const f = Math.sin(th) > 0 ? 0.9 : 0.86;
        return [z * 0.86, ym + (y - ym) * f];
      };
      frames.push(ringX(x, 0.04, 120, outer, inner));
    }
    out.push(I('frames', 'structure-frames', mergeGeos(frames), 'struct'));

    const spars: THREE.BufferGeometry[] = [];
    const ribs: THREE.BufferGeometry[] = [];
    for (const sign of [-1, 1]) {
      for (const sc of [0.18, 0.72]) {
        const a: P3[] = [];
        const b: P3[] = [];
        for (let i = 0; i <= 30; i++) {
          const az = lerp(ROOT_Z - 0.4, TIP_Z, i / 30);
          const x = xLE(az) - sc * chord(az);
          const z = az * sign;
          const u = hUp(x, z);
          const l = hLo(x, z);
          const m = (u + l) / 2;
          a.push([x, m + (u - m) * 0.86, z]);
          b.push([x, m + (l - m) * 0.86, z]);
        }
        spars.push(stripBetween(a, b));
      }
      for (const az of [3.2, 4.4, 5.6, 6.8]) {
        const a: P3[] = [];
        const b: P3[] = [];
        for (let i = 0; i <= 24; i++) {
          const sc = lerp(0.06, 0.78, i / 24);
          const x = xLE(az) - sc * chord(az);
          const z = az * sign;
          const u = hUp(x, z);
          const l = hLo(x, z);
          const m = (u + l) / 2;
          a.push([x, m + (u - m) * 0.84, z]);
          b.push([x, m + (l - m) * 0.84, z]);
        }
        ribs.push(stripBetween(a, b));
      }
    }
    out.push(I('spars', 'structure-spars', mergeGeos(spars), 'struct'));
    out.push(I('ribs', 'structure-ribs', mergeGeos(ribs), 'struct'));
  }

  return out;
}
