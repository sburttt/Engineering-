import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { buildParts, type Part } from './parts';
import { createMaterial, BASE_OPACITY } from './materials';
import { explodeOffset, isDescendant, resolvePick, COMPONENT_MAP } from '../data/components';
import { ASSEMBLY_MAP } from '../data/assemblies';
import { useStore, type RenderMode } from '../state/store';
import { anim, asmOffsets, registry, smoother } from './runtime';
import { assemblyOffsets, hidesWhenSeparated, memberOf } from './assemblyOffsets';
import { buildIsoLines } from './isoLines';
import { SHEET_LINES, flowMaterial, paperMaterial } from './paper';

/** Partial cutaway removes the upper starboard shell of the body (0 < z < 2.5, y > CLIP_Y). */
export const CLIP_Y = -0.12;
const CLIP_PLANES = [
  new THREE.Plane(new THREE.Vector3(0, 0, -1), 0),
  new THREE.Plane(new THREE.Vector3(0, -1, 0), CLIP_Y),
  new THREE.Plane(new THREE.Vector3(0, 0, 1), -2.5),
];
const isClippedPoint = (p: THREE.Vector3) => p.z > 0 && p.y > CLIP_Y && p.z < 2.5;

const HIGHLIGHT = new THREE.Color('#bfe0e8');
const NO_RAY = () => null;

/** Line colours of the technical render modes: [normal, dimmed context, selected, hovered]. */
export const LINE_STYLE: Record<Exclude<RenderMode, 'real'>, { base: string; dim: string; sel: string; hov: string; op: number }> = {
  wire: { base: '#a3a9af', dim: '#30343a', sel: '#9fd3de', hov: '#d5dade', op: 0.9 },
  blueprint: { base: '#c4d8ea', dim: '#3a5774', sel: '#ffffff', hov: '#eaf3fb', op: 0.85 },
  xray: { base: '#8fa3b3', dim: '#2a3138', sel: '#9fd3de', hov: '#c8d6e0', op: 0.22 },
  sheet: { base: SHEET_LINES.shell, dim: SHEET_LINES.dim, sel: SHEET_LINES.sel, hov: SHEET_LINES.hov, op: 0.85 },
  flow: { base: '#5a5c5e', dim: '#c8c9c6', sel: SHEET_LINES.sel, hov: '#333', op: 0.35 },
};
const technical = (r: RenderMode) => r === 'wire' || r === 'blueprint';
const paper = (r: RenderMode) => r === 'sheet' || r === 'flow';
/** Shared sheet materials (one instance each; highlight state is carried by the edge lines). */
const PAPER_MATS = { skin: paperMaterial('skin'), hardware: paperMaterial('hardware'), glass: paperMaterial('glass'), flow: flowMaterial() };

/** Depth-only fill for hidden-line drawing: surfaces hide the lines behind them but are not drawn. */
const DEPTH_ONLY = new THREE.MeshBasicMaterial({
  colorWrite: false,
  side: THREE.DoubleSide,
  polygonOffset: true,
  polygonOffsetFactor: 1.5,
  polygonOffsetUnits: 2,
});

type Vis = { hidden: boolean; ghost: number; clip: boolean; sel: number; hov: boolean; reach: boolean; ctx: boolean };

/** Components that own geometry (an assembly without its own meshes highlights its children fully). */
const OWN_GEOMETRY = new Set<string>();

function visualKey(s: ReturnType<typeof useStore.getState>, part: Part): string {
  const cid = part.componentId;
  const inFocus = !s.focusId || isDescendant(cid, s.focusId);
  const focusedHere = !!s.focusId && inFocus;
  const selectedHere = !!s.selectedId && isDescendant(cid, s.selectedId);
  const asm = s.explodeAsm ? ASSEMBLY_MAP[s.explodeAsm] : null;
  const inAsm = !!asm && !!memberOf(asm, cid);
  const ctx = !!asm && !inAsm;
  const hidden =
    (!!part.payload && part.payload !== s.payloadId) ||
    (s.isolate && !inFocus) ||
    (!!asm && inAsm && hidesWhenSeparated(asm, part)) ||
    ((technical(s.render) || paper(s.render)) && part.mat.startsWith('decal-')) ||
    (s.render === 'flow' && part.role === 'internal' && !inAsm && !s.bayOpen);
  let ghost = 0;
  if (part.role === 'shell' && s.cutaway === 'internal' && !focusedHere && !selectedHere && !inAsm) ghost = 0.07;
  if (ctx && s.render !== 'wire' && s.render !== 'blueprint') ghost = s.render === 'xray' ? 0.035 : 0.09;
  const clip = part.role === 'shell' && s.cutaway === 'partial' && !focusedHere && !selectedHere;
  const hov = !!s.hoveredId && isDescendant(cid, s.hoveredId);
  // sel: 0 none, 1 selected, 2 selected but also the focused assembly (soft), 3 child of a selected part / exploded assembly (soft)
  let sel = 0;
  if (selectedHere) {
    if (s.focusId && s.focusId === s.selectedId) sel = 2;
    else if (cid !== s.selectedId && OWN_GEOMETRY.has(s.selectedId!)) sel = 3;
    else sel = 1;
  } else if (inAsm) sel = 3;
  // Internal parts sit behind a closed skin in the exterior views; small gaps between panels must
  // not let a click reach them. They become clickable once they are actually exposed.
  const exposedBay = s.bayOpen && (cid === 'bay' || cid.startsWith('payload-'));
  const reach = part.role !== 'internal' || s.cutaway !== 'exterior' || exposedBay || focusedHere || inAsm;
  return [hidden ? 1 : 0, ghost, clip ? 1 : 0, sel, hov ? 1 : 0, reach ? 1 : 0, ctx ? 1 : 0].join('|');
}
const parseKey = (k: string): Vis => {
  const [h, g, c, s, v, r, x] = k.split('|');
  return { hidden: h === '1', ghost: +g, clip: c === '1', sel: +s, hov: v === '1', reach: r === '1', ctx: x === '1' };
};

function PartObject({ part }: { part: Part }) {
  const group = useRef<THREE.Group>(null);
  const pivot = useRef<THREE.Group>(null);
  const obj = useRef<THREE.Object3D>(null);
  const material = useMemo(() => createMaterial(part.mat), [part.mat]);
  const key = useStore((s) => visualKey(s, part));
  const render = useStore((s) => s.render);
  const vis = parseKey(key);
  const isDecal = part.mat.startsWith('decal-');

  const explodeVec = useMemo(() => {
    const o = explodeOffset(part.componentId);
    const v = new THREE.Vector3(...o);
    if (part.skin === 'up' && COMPONENT_MAP[part.componentId]?.parent === null) v.y += 0.45;
    if (part.skin === 'lo' && COMPONENT_MAP[part.componentId]?.parent === null) v.y -= 0.35;
    if (part.explodeExtra) v.add(new THREE.Vector3(...part.explodeExtra));
    return v;
  }, [part]);

  const geometry = useMemo(() => {
    if (!part.pivot) return part.geometry;
    const g = part.geometry.clone();
    g.translate(-part.pivot.origin[0], -part.pivot.origin[1], -part.pivot.origin[2]);
    return g;
  }, [part]);
  const axis = useMemo(() => (part.pivot ? new THREE.Vector3(...part.pivot.axis).normalize() : null), [part]);

  // Edge lines (feature edges and patch boundaries), built the first time a line mode needs them.
  const wantsEdges = render !== 'real' && part.kind !== 'instanced' && part.kind !== 'lines' && !part.decor && !(render === 'xray' && part.role !== 'shell') && !(render === 'flow' && part.role === 'internal');
  // on the sheet, the structure is drawn through the skin as lighter lines
  const throughSkin = render === 'sheet' && part.role === 'internal';
  const edgesRef = useRef<THREE.BufferGeometry | null>(null);
  if (wantsEdges && !edgesRef.current) edgesRef.current = new THREE.EdgesGeometry(geometry, 28);
  const lineMat = useMemo(() => new THREE.LineBasicMaterial({ transparent: true, depthWrite: false }), []);
  // seam ribbons are drawn as fine lines in the technical modes
  const seamTech = useMemo(() => new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 }), []);

  // Instanced matrices
  useLayoutEffect(() => {
    if (part.kind === 'instanced' && obj.current && part.instances) {
      const im = obj.current as THREE.InstancedMesh;
      part.instances.forEach((m, i) => im.setMatrixAt(i, m));
      im.instanceMatrix.needsUpdate = true;
      im.computeBoundingSphere();
    }
  }, [part]);

  // Register for camera fitting and callouts
  useEffect(() => {
    const o = obj.current;
    if (!o || part.kind === 'lines' || part.decor) return;
    o.userData.componentId = part.componentId;
    let set = registry.get(part.componentId);
    if (!set) registry.set(part.componentId, (set = new Set()));
    set.add(o);
    return () => {
      set!.delete(o);
    };
  }, [part]);

  // Apply visual state to the materials
  useLayoutEffect(() => {
    const m = material as THREE.MeshStandardMaterial & THREE.LineBasicMaterial;
    const baseOpacity = BASE_OPACITY[part.mat] ?? 1;
    const seeThrough = baseOpacity < 1 || isDecal;
    const ghosted = vis.ghost > 0;
    m.transparent = ghosted || seeThrough;
    m.opacity = ghosted ? (seeThrough ? vis.ghost * 1.5 : vis.ghost) : baseOpacity;
    m.depthWrite = !ghosted && !seeThrough;
    m.clippingPlanes = vis.clip ? CLIP_PLANES : null;
    m.clipIntersection = true;
    if ('emissive' in m && m.emissive && part.mat !== 'indicator') {
      // restrained, neutral-cool lift rather than a coloured glow
      const lvl = vis.sel === 1 ? 0.03 : vis.hov ? 0.016 : vis.sel === 3 ? 0.012 : vis.sel === 2 ? 0.008 : 0;
      if (lvl > 0 && part.mat !== 'seam' && part.mat !== 'fastener') {
        m.emissive.copy(HIGHLIGHT);
        m.emissiveIntensity = lvl;
      } else {
        m.emissive.setRGB(0, 0, 0);
        m.emissiveIntensity = 0;
      }
    }
    m.needsUpdate = true;
    if (render !== 'real') {
      const st = LINE_STYLE[render];
      const strong = vis.sel === 1 || vis.sel === 2;
      lineMat.color.set(strong ? st.sel : vis.hov ? st.hov : vis.ctx ? st.dim : throughSkin ? SHEET_LINES.internal : st.base);
      lineMat.opacity = vis.ctx ? Math.min(st.op, 0.5) : strong && render === 'xray' ? 0.75 : throughSkin ? 0.5 : st.op;
      lineMat.depthTest = !throughSkin;
      lineMat.clippingPlanes = vis.clip ? CLIP_PLANES : null;
      seamTech.color.set(vis.ctx ? st.dim : st.base);
      seamTech.opacity = vis.ctx ? 0.25 : render === 'flow' ? 0.3 : 0.55;
      if (paper(render)) {
        // the sheet materials are shared: fade context with a per-part opacity is not possible, so
        // context parts go to a plain lighter tone via the edge lines only
        lineMat.needsUpdate = true;
      }
    }
  }, [key, material, part.mat, vis.clip, vis.ghost, vis.hov, vis.sel, vis.ctx, render, lineMat, seamTech, isDecal, throughSkin]);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    g.position.copy(explodeVec).multiplyScalar(anim.explode);
    if (anim.asmShown && anim.asmT > 0) {
      const o = asmOffsets.get(part.key);
      if (o) g.position.addScaledVector(o, smoother(anim.asmT));
    }
    // module release: the fitted module leaves the rails, pitching slightly nose-down as it drops
    if (part.payload && anim.release > 0.001) {
      const r = smoother(anim.release);
      g.position.y -= 1.45 * r;
      g.position.x -= 0.25 * r;
      g.rotation.z = -0.1 * r;
    } else if (part.payload) g.rotation.z = 0;
    if (part.pivot && pivot.current && axis) {
      let a = 0;
      if (part.pivot.driver === 'elevon-port') a = anim.pitch + anim.roll;
      else if (part.pivot.driver === 'elevon-stbd') a = anim.pitch - anim.roll;
      else if (part.pivot.driver === 'bay-door') a = anim.bay * 1.55;
      pivot.current.quaternion.setFromAxisAngle(axis, a * part.pivot.sense);
    }
  });

  const tech = technical(render);
  const onPaper = paper(render);
  const pickable = !vis.hidden && vis.ghost === 0 && part.kind !== 'lines' && !part.decor && vis.reach && !(tech && vis.ctx);
  const shadows = render === 'real' && !part.decor && part.kind !== 'lines' && vis.ghost === 0;

  const accept = (e: ThreeEvent<PointerEvent | MouseEvent>) => {
    if (!pickable) return false;
    if (vis.clip && isClippedPoint(e.point)) return false;
    return true;
  };
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    if (!accept(e)) return;
    e.stopPropagation();
    const s = useStore.getState();
    if (s.cinema) return;
    s.hover(resolvePick(part.componentId, s.focusId));
    document.body.style.cursor = 'pointer';
  };
  const onOut = () => {
    useStore.getState().hover(null);
    document.body.style.cursor = '';
  };
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 6) return; // a drag, not a click
    if (!accept(e)) return;
    e.stopPropagation();
    const s = useStore.getState();
    if (s.cinema) return;
    s.select(resolvePick(part.componentId, s.focusId));
  };

  const handlers = pickable ? { onPointerMove: onMove, onPointerOut: onOut, onClick } : {};
  // Always pass an explicit function: React Three Fiber does not restore the prototype method
  // when this prop changes back to undefined, which would leave a part unclickable.
  const rayFn = part.kind === 'instanced' ? THREE.InstancedMesh.prototype.raycast : THREE.Mesh.prototype.raycast;
  const noRay = pickable ? rayFn : NO_RAY;

  // Which material the surface uses in this render mode
  let surfaceMat: THREE.Material = material;
  let surfaceVisible = true;
  if (tech) {
    if (part.mat === 'seam') surfaceMat = seamTech;
    else if (part.decor) surfaceVisible = false;
    else surfaceMat = DEPTH_ONLY;
  } else if (onPaper) {
    if (part.mat === 'seam') surfaceMat = seamTech;
    else if (part.decor) surfaceVisible = false;
    else if (throughSkin) surfaceVisible = false;
    else if (render === 'flow') surfaceMat = part.role === 'shell' || part.mat === 'glass' ? PAPER_MATS.flow : PAPER_MATS.hardware;
    else surfaceMat = part.mat === 'glass' ? PAPER_MATS.glass : part.role === 'shell' ? PAPER_MATS.skin : PAPER_MATS.hardware;
  }

  let inner: React.ReactNode;
  if (part.kind === 'lines') {
    inner = <lineSegments ref={obj as never} geometry={geometry} material={material} raycast={() => null} name={part.key} />;
  } else if (part.kind === 'instanced') {
    inner = (
      <instancedMesh
        ref={obj as never}
        args={[geometry, material, part.instances!.length]}
        name={part.key}
        visible={!tech && !onPaper}
        raycast={noRay as never}
        castShadow={shadows}
        receiveShadow={shadows}
        {...handlers}
      />
    );
  } else {
    inner = (
      <>
        <mesh
          ref={obj as never}
          geometry={geometry}
          material={surfaceMat}
          visible={surfaceVisible}
          name={part.key}
          raycast={noRay as never}
          castShadow={shadows}
          receiveShadow={shadows}
          {...handlers}
        />
        {wantsEdges && edgesRef.current && <lineSegments geometry={edgesRef.current} material={lineMat} raycast={NO_RAY} renderOrder={1} />}
      </>
    );
  }

  return (
    <group ref={group} visible={!vis.hidden} name={`part:${part.componentId}`}>
      {part.pivot ? (
        <group ref={pivot} position={part.pivot.origin}>
          {inner}
        </group>
      ) : (
        inner
      )}
    </group>
  );
}

/** Isoparametric surface curves for the wireframe and blueprint modes (assembled aircraft only). */
function IsoLines() {
  const render = useStore((s) => s.render);
  const ref = useRef<THREE.LineSegments>(null);
  const on = technical(render) || render === 'sheet';
  const geo = useMemo(() => (on ? buildIsoLines() : null), [on]);
  const mat = useMemo(() => new THREE.LineBasicMaterial({ transparent: true, depthWrite: false }), []);
  useLayoutEffect(() => {
    if (!on) return;
    mat.color.set(render === 'blueprint' ? '#8fb2d2' : render === 'sheet' ? '#9a9c9a' : '#5f666d');
    mat.opacity = render === 'blueprint' ? 0.45 : render === 'sheet' ? 0.4 : 0.55;
  }, [render, mat, on]);
  useFrame(() => {
    if (ref.current) ref.current.visible = anim.explode < 0.01 && !(anim.asmShown && anim.asmT > 0.01) && !useStore.getState().explodeAsm;
  });
  if (!geo) return null;
  return <lineSegments ref={ref} geometry={geo} material={mat} raycast={NO_RAY} />;
}

export function AircraftModel() {
  const parts = useMemo(() => {
    const list = buildParts();
    list.forEach((p) => OWN_GEOMETRY.add(p.componentId));
    return list;
  }, []);
  // Recompute separation vectors whenever a different assembly is shown.
  const computedFor = useRef<string | null>(null);
  useFrame(() => {
    if (anim.asmShown !== computedFor.current) {
      computedFor.current = anim.asmShown;
      asmOffsets.clear();
      if (anim.asmShown) for (const [k, v] of assemblyOffsets(anim.asmShown, parts)) asmOffsets.set(k, v);
    }
  }, -2);
  useEffect(() => {
    useStore.getState().setRenderStatus('ready');
    const w = window as unknown as { __nightfall?: Record<string, unknown> };
    w.__nightfall = {
      ...(w.__nightfall ?? {}),
      parts: parts.length,
      registry,
      store: useStore,
      anim,
      resolvePick: (id: string) => resolvePick(id, useStore.getState().focusId),
    };
  }, [parts]);
  return (
    <group name="CX-7 Nightfall">
      {parts.map((p) => (
        <PartObject key={p.key} part={p} />
      ))}
      <IsoLines />
    </group>
  );
}
