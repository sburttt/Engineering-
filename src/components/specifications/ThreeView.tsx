import { useMemo } from 'react';
import {
  LE_PTS,
  TE_PTS,
  NOSE_X,
  TAIL_X,
  HALF_SPAN,
  GROUND_Y,
  FAIRING_TAIL_X,
  X_FWD,
  ROOT_Z,
  TIP_Z,
  HINGE_S,
  MAIN_WHEEL_R,
  NOSE_WHEEL_R,
  fairingPoint,
  fairingWidth,
  hLo,
  hUp,
  xLE,
  chord,
  lerp,
  envelope,
} from '../../aircraft/geometry/airframe';

/** Orthographic views computed from the same functions that build the 3D mesh. */
const f = (n: number) => n.toFixed(3);
const path = (pts: [number, number][], close = true) => 'M' + pts.map(([a, b]) => `${f(a)} ${f(b)}`).join(' L') + (close ? ' Z' : '');

function fairingTopAt(x: number): number | null {
  if (x < FAIRING_TAIL_X || x > X_FWD + 0.3) return null;
  let best: number | null = null;
  for (let u = 0; u <= 1.0001; u += 0.005) {
    const p = fairingPoint(u, 0);
    if (Math.abs(p[0] - x) < 0.04) best = Math.max(best ?? -9, p[1]);
  }
  return best;
}

export function TopView() {
  const d = useMemo(() => {
    const stbd: [number, number][] = [...LE_PTS.map(([z, x]) => [x, z] as [number, number]), ...[...TE_PTS].reverse().map(([z, x]) => [x, z] as [number, number])];
    const port = [...stbd].reverse().map(([x, z]) => [x, -z] as [number, number]);
    const outline = path([...stbd, ...port]);
    const fair: [number, number][] = [];
    for (let i = 0; i <= 40; i++) {
      const x = lerp(FAIRING_TAIL_X, X_FWD, i / 40);
      fair.push([x, fairingWidth(x)]);
    }
    const fairing = path([...fair, ...[...fair].reverse().map(([x, z]) => [x, -z] as [number, number])]);
    const elevons: string[] = [];
    for (const sgn of [-1, 1])
      for (const [a, b] of [[3.0, 4.8], [5.5, 7.4]]) {
        const pts: [number, number][] = [
          [xLE(a) - HINGE_S * chord(a), sgn * a],
          [xLE(b) - HINGE_S * chord(b), sgn * b],
          [xLE(b) - chord(b), sgn * b],
          [xLE(a) - chord(a), sgn * a],
        ];
        elevons.push(path(pts));
      }
    const seams = [ROOT_Z, TIP_Z].flatMap((z) => [-z, z]).map((z) => path([[xLE(z), z], [xLE(z) - chord(z), z]], false));
    return { outline, fairing, elevons, seams };
  }, []);
  const pad = 1.2;
  // Nose up: drawing coordinates are (x, z) rotated so svg-x = z (starboard right), svg-y = −x.
  return (
    <svg className="drawing" viewBox={`${-HALF_SPAN - pad} ${-NOSE_X - pad} ${HALF_SPAN * 2 + pad * 2} ${NOSE_X - TAIL_X + pad * 2 + 0.9}`} role="img" aria-label="Plan view, nose up">
      <g transform="matrix(0 -1 1 0 0 0)">
        <path className="ol" d={d.outline} />
        <path className="det" d={d.fairing} />
        {d.elevons.map((p, i) => <path key={i} className="det" d={p} />)}
        {d.seams.map((p, i) => <path key={i} className="det" d={p} strokeDasharray="0.15 0.12" />)}
      </g>
      <line className="dim" x1={-HALF_SPAN} y1={-TAIL_X + 0.6} x2={HALF_SPAN} y2={-TAIL_X + 0.6} />
      <text x={0} y={-TAIL_X + 1.25} textAnchor="middle" style={{ fontSize: 0.42 }}>
        SPAN {(HALF_SPAN * 2).toFixed(1)} m
      </text>
      <line className="dim" x1={HALF_SPAN + 0.5} y1={-NOSE_X} x2={HALF_SPAN + 0.5} y2={-TAIL_X} />
      <text x={HALF_SPAN + 0.95} y={-(NOSE_X + TAIL_X) / 2} transform={`rotate(90 ${HALF_SPAN + 0.95} ${-(NOSE_X + TAIL_X) / 2})`} textAnchor="middle" style={{ fontSize: 0.42 }}>
        LENGTH {(NOSE_X - TAIL_X).toFixed(1)} m
      </text>
      <text x={-HALF_SPAN} y={-NOSE_X + 0.2} style={{ fontSize: 0.38 }}>
        PLAN · NOSE UP
      </text>
    </svg>
  );
}

export function SideView() {
  const d = useMemo(() => {
    const up: [number, number][] = [];
    const lo: [number, number][] = [];
    for (let i = 0; i <= 160; i++) {
      const x = lerp(TAIL_X, NOSE_X, i / 160);
      const ft = fairingTopAt(x);
      up.push([x, -Math.max(hUp(x, 0), ft ?? -9)]);
      lo.push([x, -hLo(x, 0)]);
    }
    const outline = path([...up, ...[...lo].reverse()]);
    // drooped tip seen from the side
    const tip: [number, number][] = [];
    for (let i = 0; i <= 20; i++) {
      const s = i / 20;
      const x = xLE(HALF_SPAN) - s * chord(HALF_SPAN);
      tip.push([x, -hLo(x, HALF_SPAN)]);
    }
    return { outline, tip: path(tip, false) };
  }, []);
  const gear = [
    { x: 4.75, r: NOSE_WHEEL_R, top: hLo(4.75, 0) },
    { x: -1.6, r: MAIN_WHEEL_R, top: hLo(-1.6, 1.9) },
  ];
  const env = envelope();
  return (
    <svg className="drawing" viewBox={`${TAIL_X - 1} ${-env.topY - 0.9} ${NOSE_X - TAIL_X + 2.6} ${env.topY - GROUND_Y + 1.6}`} role="img" aria-label="Side view (profile)">
      <line className="gnd" x1={TAIL_X - 1} y1={-GROUND_Y} x2={NOSE_X + 1.6} y2={-GROUND_Y} />
      {gear.map((g) => (
        <g key={g.x}>
          <line className="det" x1={g.x} y1={-g.top} x2={g.x} y2={-(GROUND_Y + g.r)} />
          <circle className="det" cx={g.x} cy={-(GROUND_Y + g.r)} r={g.r} />
        </g>
      ))}
      <path className="det" d={d.tip} />
      <path className="ol" d={d.outline} />
      <line className="dim" x1={NOSE_X + 0.9} y1={-env.topY} x2={NOSE_X + 0.9} y2={-GROUND_Y} />
      <text x={NOSE_X + 1.25} y={-(env.topY + GROUND_Y) / 2} transform={`rotate(90 ${NOSE_X + 1.25} ${-(env.topY + GROUND_Y) / 2})`} textAnchor="middle" style={{ fontSize: 0.32 }}>
        H {env.heightGearDown.toFixed(2)} m
      </text>
      <text x={TAIL_X - 0.6} y={-env.topY - 0.35} style={{ fontSize: 0.32 }}>
        PROFILE · CENTRELINE
      </text>
    </svg>
  );
}

export function FrontView() {
  const d = useMemo(() => {
    const up: [number, number][] = [];
    const lo: [number, number][] = [];
    const n = 120;
    for (let i = 0; i <= n; i++) {
      const z = lerp(-HALF_SPAN, HALF_SPAN, i / n);
      let mu = -9;
      let ml = 9;
      for (let x = TAIL_X; x <= NOSE_X; x += 0.05) {
        if (x > xLE(z) || x < xLE(z) - chord(z)) continue;
        mu = Math.max(mu, hUp(x, z));
        ml = Math.min(ml, hLo(x, z));
      }
      if (Math.abs(z) < fairingWidth(0)) {
        for (let u = 0; u <= 1; u += 0.02) mu = Math.max(mu, fairingPoint(u, z / fairingWidth(lerp(FAIRING_TAIL_X, X_FWD, u)))[1]);
      }
      up.push([z, -mu]);
      lo.push([z, -ml]);
    }
    return path([...up, ...[...lo].reverse()]);
  }, []);
  const env = envelope();
  const gear = [
    { z: 0, r: NOSE_WHEEL_R, top: hLo(4.75, 0), w: 0.16 },
    { z: -1.9, r: MAIN_WHEEL_R, top: hLo(-1.6, 1.9), w: 0.22 },
    { z: 1.9, r: MAIN_WHEEL_R, top: hLo(-1.6, 1.9), w: 0.22 },
  ];
  return (
    <svg className="drawing" viewBox={`${-HALF_SPAN - 0.6} ${-env.topY - 0.9} ${HALF_SPAN * 2 + 1.2} ${env.topY - GROUND_Y + 1.6}`} role="img" aria-label="Front view">
      <line className="gnd" x1={-HALF_SPAN - 0.6} y1={-GROUND_Y} x2={HALF_SPAN + 0.6} y2={-GROUND_Y} />
      {gear.map((g) => (
        <g key={g.z}>
          <line className="det" x1={g.z} y1={-g.top} x2={g.z} y2={-(GROUND_Y + g.r)} />
          <rect className="det" x={g.z - g.w / 2} y={-(GROUND_Y + 2 * g.r)} width={g.w} height={2 * g.r} />
        </g>
      ))}
      <path className="ol" d={d} />
      <text x={-HALF_SPAN} y={-env.topY - 0.35} style={{ fontSize: 0.32 }}>
        FRONT ELEVATION
      </text>
    </svg>
  );
}
