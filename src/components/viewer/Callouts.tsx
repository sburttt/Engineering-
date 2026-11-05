import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useStore } from '../../state/store';
import { COMPONENT_MAP } from '../../data/components';
import { ASSEMBLY_MAP, assemblyLabels, codeOf } from '../../data/assemblies';
import { boundsOf, view } from '../../aircraft/runtime';
import { calloutsAt, cine } from '../../aircraft/cinema';
import { DIMENSIONS } from '../../data/aircraft';

/** Components labelled in the blueprint presentation (general arrangement). */
const BLUEPRINT_PLAN = ['fwd-fuselage', 'sensor-fwd', 'inlet', 'fairing', 'ctr-body', 'aft-body', 'exhaust', 'wing-stbd', 'tip-stbd', 'elevon-stbd-out'];
const BLUEPRINT_ELEVATION = ['fwd-fuselage', 'inlet', 'fairing', 'exhaust', 'gear-nose', 'gear-stbd'];

interface Item {
  id: string;
  /** label width estimated from its text (12 px body face) */
  lw: number;
  ax: number;
  ay: number;
  side: -1 | 1;
  ly: number;
  lx: number;
}
interface Dim {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label: string;
  value: string;
  vertical: boolean;
}

const ROW = 40;

const shortName = (id: string) => {
  const n = COMPONENT_MAP[id]?.name ?? id;
  return n.replace(/^(Port|Starboard) Main Gear — /, '').replace(/^Nose Landing Gear — /, 'Nose gear — ');
};

/**
 * Technical callouts: an anchor dot on the part, a thin leader line with one elbow, and a label in
 * an ordered column at the side of the frame. Columns are relaxed so labels never overlap.
 */
export function Callouts() {
  const [items, setItems] = useState<Item[]>([]);
  const [dims, setDims] = useState<Dim[]>([]);
  const [box, setBox] = useState({ w: 1, h: 1 });
  const raf = useRef(0);

  useEffect(() => {
    const v = new THREE.Vector3();
    const cam = new THREE.Vector3();
    let whole: THREE.Box3 | null = null;
    const tick = () => {
      raf.current = requestAnimationFrame(tick);
      const s = useStore.getState();
      const camera = view.camera;
      if (!camera || s.tab !== 'aircraft') return;
      const w = view.width;
      const h = view.height;
      const narrow = w < 900;
      let ids: string[] = [];
      if (s.cinema) ids = calloutsAt(cine.t);
      else if (s.explodeAsm) ids = assemblyLabels(ASSEMBLY_MAP[s.explodeAsm]);
      else if (s.selectedId && !narrow) ids = [s.selectedId];
      else if (s.render === 'blueprint' && !narrow) {
        // plan views carry more labels than the thin side / front elevations
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        ids = Math.abs(dir.y) > 0.7 ? BLUEPRINT_PLAN : BLUEPRINT_ELEVATION;
      }
      if (narrow && ids.length > 4) ids = ids.slice(0, 4);

      // frame available for labels (between the left rail and the information panel)
      const left = s.cinema || s.immersive || narrow ? 16 : 290;
      const right = w - (s.selectedId && !s.cinema && !s.immersive && !narrow ? 400 : 16);
      const cx = (left + right) / 2;
      camera.getWorldPosition(cam);

      // In the blueprint the silhouette carries dimension lines just outside it: keep label columns clear of them.
      let silhouette: { x0: number; x1: number } | null = null;
      if (s.render === 'blueprint' && !s.explodeAsm) {
        if (!whole) {
          whole = new THREE.Box3();
          for (const wid of ['fwd-fuselage', 'ctr-body', 'aft-body', 'wing-port', 'wing-stbd', 'fairing', 'gear-nose', 'gear-port', 'gear-stbd']) {
            const bb = boundsOf(wid);
            if (bb) whole.union(bb);
          }
        }
        let a0 = Infinity, a1 = -Infinity;
        for (let k = 0; k < 8; k++) {
          v.set(k & 1 ? whole.max.x : whole.min.x, k & 2 ? whole.max.y : whole.min.y, k & 4 ? whole.max.z : whole.min.z).project(camera);
          const px = ((v.x + 1) / 2) * w;
          a0 = Math.min(a0, px);
          a1 = Math.max(a1, px);
        }
        silhouette = { x0: a0, x1: a1 };
      }
      const next: Item[] = [];
      for (const id of ids) {
        const b = boundsOf(id);
        if (!b) continue;
        b.getCenter(v);
        v.project(camera);
        if (v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1) continue;
        const ax = ((v.x + 1) / 2) * w;
        const ay = ((1 - v.y) / 2) * h;
        const side: -1 | 1 = ids.length === 1 ? (ax > cx + (right - left) * 0.18 ? 1 : -1) : ax < cx ? -1 : 1;
        const lw = Math.min(narrow ? 150 : 300, Math.max(110, shortName(id).length * 6.7 + 8));
        next.push({ id, ax, ay, side, ly: ay, lx: 0, lw });
      }
      // columns: one label per row, ordered by anchor height, kept inside the frame
      for (const side of [-1, 1] as const) {
        // Fan order: sort by the leader's slope seen from the column, so leaders never cross.
        const raw = next.filter((i) => i.side === side);
        const colX = side < 0 ? left : right;
        const midY = raw.reduce((m, i) => m + i.ay, 0) / Math.max(1, raw.length);
        const col = raw.sort((a, b) => (a.ay - midY) / (Math.abs(a.ax - colX) + 1) - (b.ay - midY) / (Math.abs(b.ax - colX) + 1));
        col.forEach((it, i) => (it.ly = midY + (i - (col.length - 1) / 2) * ROW));
        const top = 90;
        const bottom = h - (narrow ? 90 : 110);
        for (let i = 0; i < col.length; i++) col[i].ly = Math.max(col[i].ly, i ? col[i - 1].ly + ROW : top);
        for (let i = col.length - 1; i >= 0; i--) col[i].ly = Math.min(col[i].ly, i < col.length - 1 ? col[i + 1].ly - ROW : bottom);
        for (const it of col) {
          if (ids.length === 1) it.lx = side < 0 ? Math.max(left, it.ax - 150 - it.lw) : Math.min(right - it.lw, it.ax + 150);
          else {
            let extreme = side < 0 ? Math.min(...col.map((c) => c.ax)) : Math.max(...col.map((c) => c.ax));
            const extremeFix = (sd: number) => {
              // clear the silhouette and the vertical dimension line beside it
              if (silhouette) extreme = sd < 0 ? Math.min(extreme, silhouette.x0 - 20) : Math.max(extreme, silhouette.x1 + 40);
            };
            const gap = silhouette ? 70 : 90;
            const colW = Math.max(...col.map((c) => c.lw));
            if (silhouette) extremeFix(side);
            it.lx = side < 0 ? Math.max(left, Math.min(extreme - gap - colW, cx - 260 - colW)) : Math.min(right - colW, Math.max(extreme + gap, cx + 260));
            if (side < 0) it.lx += colW - it.lw; // right-align the left column on its leaders
            if (narrow) it.lx = side < 0 ? 12 : w - it.lw - 12;
          }
        }
      }
      setItems((prev) => (JSON.stringify(prev.map((p) => [p.id, Math.round(p.ax), Math.round(p.ay), Math.round(p.lx), Math.round(p.ly)])) === JSON.stringify(next.map((p) => [p.id, Math.round(p.ax), Math.round(p.ay), Math.round(p.lx), Math.round(p.ly)])) ? prev : next));
      setBox((b) => (b.w === w && b.h === h ? b : { w, h }));

      // dimension guides in the blueprint: overall length, span and height where an axis lies across the view
      const nd: Dim[] = [];
      if (s.render === 'blueprint' && !s.explodeAsm && !s.cinema) {
        if (!whole) {
          whole = new THREE.Box3();
          for (const id of ['fwd-fuselage', 'ctr-body', 'aft-body', 'wing-port', 'wing-stbd', 'fairing', 'gear-nose', 'gear-port', 'gear-stbd']) {
            const bb = boundsOf(id);
            if (bb) whole.union(bb);
          }
        }
        const c = whole.getCenter(new THREE.Vector3());
        const camDir = new THREE.Vector3();
        camera.getWorldDirection(camDir);
        const proj = (p: THREE.Vector3) => {
          const q = p.clone().project(camera);
          return [((q.x + 1) / 2) * w, ((1 - q.y) / 2) * h];
        };
        // projected silhouette rectangle (8 corners)
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (let k = 0; k < 8; k++) {
          const [px, py] = proj(new THREE.Vector3(k & 1 ? whole.max.x : whole.min.x, k & 2 ? whole.max.y : whole.min.y, k & 4 ? whole.max.z : whole.min.z));
          x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
        }
        const axes: [THREE.Vector3, THREE.Vector3, string, number][] = [
          [new THREE.Vector3(whole.min.x, c.y, c.z), new THREE.Vector3(whole.max.x, c.y, c.z), 'LENGTH', DIMENSIONS.length],
          [new THREE.Vector3(c.x, c.y, whole.min.z), new THREE.Vector3(c.x, c.y, whole.max.z), 'SPAN', DIMENSIONS.span],
          [new THREE.Vector3(c.x, whole.min.y, c.z), new THREE.Vector3(c.x, whole.max.y, c.z), 'HEIGHT', DIMENSIONS.height],
        ];
        for (const [a, b2, label, value] of axes) {
          const axis = b2.clone().sub(a).normalize();
          if (Math.abs(axis.dot(camDir)) > 0.35) continue;
          const [ax, ay] = proj(a);
          const [bx, by] = proj(b2);
          const len = Math.hypot(bx - ax, by - ay);
          if (len < 90) continue;
          const vertical = Math.abs(by - ay) > Math.abs(bx - ax);
          if (vertical) {
            const xx = Math.min(x1 + 40, w - 60);
            nd.push({ x1: xx, y1: Math.min(ay, by), x2: xx, y2: Math.max(ay, by), label, value: `${value.toFixed(2)} m`, vertical });
          } else {
            const yy = Math.min(y1 + 44, h - 140);
            nd.push({ x1: Math.min(ax, bx), y1: yy, x2: Math.max(ax, bx), y2: yy, label, value: `${value.toFixed(1)} m`, vertical });
          }
        }
      }
      setDims((prev) => (JSON.stringify(prev.map((d) => [Math.round(d.x1), Math.round(d.y1), Math.round(d.x2), Math.round(d.y2), d.label])) === JSON.stringify(nd.map((d) => [Math.round(d.x1), Math.round(d.y1), Math.round(d.x2), Math.round(d.y2), d.label])) ? prev : nd));
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, []);

  const narrow = box.w < 900;
  return (
    <svg className="callouts" width={box.w} height={box.h} viewBox={`0 0 ${box.w} ${box.h}`} aria-hidden>
      {dims.map((d) => (
        <g key={d.label} className="dim">
          {d.vertical ? (
            <>
              <line x1={d.x1 - 26} y1={d.y1} x2={d.x1 + 6} y2={d.y1} className="ext" />
              <line x1={d.x1 - 26} y1={d.y2} x2={d.x1 + 6} y2={d.y2} className="ext" />
              <line x1={d.x1} y1={d.y1} x2={d.x2} y2={d.y2} />
              <path d={`M${d.x1 - 4} ${d.y1 + 9} L${d.x1} ${d.y1} L${d.x1 + 4} ${d.y1 + 9}`} />
              <path d={`M${d.x1 - 4} ${d.y2 - 9} L${d.x1} ${d.y2} L${d.x1 + 4} ${d.y2 - 9}`} />
              <text x={d.x1 + 12} y={(d.y1 + d.y2) / 2} className="dv">{d.value}</text>
              <text x={d.x1 + 12} y={(d.y1 + d.y2) / 2 + 14} className="dl">{d.label}</text>
            </>
          ) : (
            <>
              <line x1={d.x1} y1={d.y1 - 30} x2={d.x1} y2={d.y1 + 6} className="ext" />
              <line x1={d.x2} y1={d.y1 - 30} x2={d.x2} y2={d.y1 + 6} className="ext" />
              <line x1={d.x1} y1={d.y1} x2={d.x2} y2={d.y2} />
              <path d={`M${d.x1 + 9} ${d.y1 - 4} L${d.x1} ${d.y1} L${d.x1 + 9} ${d.y1 + 4}`} />
              <path d={`M${d.x2 - 9} ${d.y2 - 4} L${d.x2} ${d.y2} L${d.x2 - 9} ${d.y2 + 4}`} />
              <text x={(d.x1 + d.x2) / 2} y={d.y1 - 8} textAnchor="middle" className="dv">
                {d.label} · {d.value}
              </text>
            </>
          )}
        </g>
      ))}
      {items.map((it) => {
        const lw = it.lw;
        const edge = it.side < 0 ? it.lx + lw : it.lx;
        const bend = edge - it.side * 18;
        return (
          <g key={it.id} className="co">
            <polyline points={`${it.ax},${it.ay} ${bend},${it.ly} ${edge},${it.ly}`} />
            <circle cx={it.ax} cy={it.ay} r={3} className="co-dot" />
            <circle cx={it.ax} cy={it.ay} r={7} className="co-ring" />
            <g transform={`translate(${it.lx} ${it.ly - 15})`}>
              <line x1={0} y1={15} x2={lw} y2={15} className="co-rule" />
              <text x={it.side < 0 ? lw : 0} y={9} textAnchor={it.side < 0 ? 'end' : 'start'} className="co-code">
                {codeOf(it.id)}
              </text>
              <text x={it.side < 0 ? lw : 0} y={30} textAnchor={it.side < 0 ? 'end' : 'start'} className="co-name">
                {narrow && shortName(it.id).length > 21 ? shortName(it.id).slice(0, 20) + '…' : shortName(it.id)}
              </text>
            </g>
          </g>
        );
      })}
    </svg>
  );
}
