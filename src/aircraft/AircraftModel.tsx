import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { buildParts, type Part } from './parts';
import { createMaterial, ACCENT } from './materials';
import { explodeOffset, isDescendant, resolvePick, COMPONENT_MAP } from '../data/components';
import { useStore } from '../state/store';
import { anim, registry } from './runtime';

/** Partial cutaway removes the upper starboard shell of the body (0 < z < 2.5, y > CLIP_Y). */
export const CLIP_Y = -0.12;
const CLIP_PLANES = [
  new THREE.Plane(new THREE.Vector3(0, 0, -1), 0),
  new THREE.Plane(new THREE.Vector3(0, -1, 0), CLIP_Y),
  new THREE.Plane(new THREE.Vector3(0, 0, 1), -2.5),
];
const isClippedPoint = (p: THREE.Vector3) => p.z > 0 && p.y > CLIP_Y && p.z < 2.5;

type Vis = { hidden: boolean; ghost: number; clip: boolean; sel: number; hov: boolean };

/** Components that own geometry (an assembly without its own meshes highlights its children fully). */
const OWN_GEOMETRY = new Set<string>();

function visualKey(s: ReturnType<typeof useStore.getState>, part: Part): string {
  const cid = part.componentId;
  const inFocus = !s.focusId || isDescendant(cid, s.focusId);
  const focusedHere = !!s.focusId && inFocus;
  const selectedHere = !!s.selectedId && isDescendant(cid, s.selectedId);
  const hidden = (!!part.payload && part.payload !== s.payloadId) || (s.isolate && !inFocus);
  let ghost = 0;
  if (s.focusId && !inFocus && !s.isolate) ghost = 0.1;
  if (part.role === 'shell' && s.cutaway === 'internal' && !focusedHere && !selectedHere) ghost = ghost ? Math.min(ghost, 0.07) : 0.07;
  const clip = part.role === 'shell' && s.cutaway === 'partial' && !focusedHere && !selectedHere;
  const hov = s.tab !== 'overview' && !!s.hoveredId && isDescendant(cid, s.hoveredId);
  // sel: 0 none, 1 selected, 2 selected but also the enlarged assembly (soft), 3 child of a selected part (soft)
  let sel = 0;
  if (selectedHere && s.tab !== 'overview') {
    if (s.focusId && s.focusId === s.selectedId) sel = 2;
    else if (cid !== s.selectedId && OWN_GEOMETRY.has(s.selectedId!)) sel = 3;
    else sel = 1;
  }
  return [hidden ? 1 : 0, ghost, clip ? 1 : 0, sel, hov ? 1 : 0].join('|');
}
const parseKey = (k: string): Vis => {
  const [h, g, c, s, v] = k.split('|');
  return { hidden: h === '1', ghost: +g, clip: c === '1', sel: +s, hov: v === '1' };
};

function PartObject({ part }: { part: Part }) {
  const group = useRef<THREE.Group>(null);
  const pivot = useRef<THREE.Group>(null);
  const obj = useRef<THREE.Object3D>(null);
  const material = useMemo(() => createMaterial(part.mat), [part.mat]);
  const key = useStore((s) => visualKey(s, part));
  const vis = parseKey(key);

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

  // Instanced matrices
  useLayoutEffect(() => {
    if (part.kind === 'instanced' && obj.current && part.instances) {
      const im = obj.current as THREE.InstancedMesh;
      part.instances.forEach((m, i) => im.setMatrixAt(i, m));
      im.instanceMatrix.needsUpdate = true;
      im.computeBoundingSphere();
    }
  }, [part]);

  // Register for camera fitting
  useEffect(() => {
    const o = obj.current;
    if (!o || part.kind === 'lines') return;
    o.userData.componentId = part.componentId;
    let set = registry.get(part.componentId);
    if (!set) registry.set(part.componentId, (set = new Set()));
    set.add(o);
    return () => {
      set!.delete(o);
    };
  }, [part]);

  // Apply visual state to the material
  useLayoutEffect(() => {
    const m = material as THREE.MeshStandardMaterial & THREE.LineBasicMaterial;
    const baseOpacity = part.mat === 'line' ? 0.55 : 1;
    const isDecal = part.mat.startsWith('decal-');
    const ghosted = vis.ghost > 0;
    m.transparent = ghosted || part.mat === 'line' || isDecal;
    m.opacity = ghosted ? (part.mat === 'line' ? vis.ghost * 2 : vis.ghost) : baseOpacity;
    m.depthWrite = !ghosted && !isDecal && part.mat !== 'line';
    m.clippingPlanes = vis.clip ? CLIP_PLANES : null;
    m.clipIntersection = true;
    if ('emissive' in m && m.emissive && part.mat !== 'indicator') {
      if (vis.sel === 1) {
        m.emissive.copy(ACCENT);
        m.emissiveIntensity = 0.13;
      } else if (vis.hov) {
        m.emissive.copy(ACCENT);
        m.emissiveIntensity = 0.07;
      } else if (vis.sel === 3) {
        m.emissive.copy(ACCENT);
        m.emissiveIntensity = 0.04;
      } else if (vis.sel === 2) {
        m.emissive.copy(ACCENT);
        m.emissiveIntensity = 0.025;
      } else {
        m.emissive.setRGB(0, 0, 0);
        m.emissiveIntensity = 0;
      }
    }
    if (part.mat === 'line') {
      (m as THREE.LineBasicMaterial).color.set(vis.sel === 1 ? '#9fd3de' : '#5d666f');
    }
    m.needsUpdate = true;
  }, [key, material, part.mat, vis.clip, vis.ghost, vis.hov, vis.sel]);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    g.position.copy(explodeVec).multiplyScalar(anim.explode);
    if (part.pivot && pivot.current && axis) {
      let a = 0;
      if (part.pivot.driver === 'elevon-port') a = anim.pitch + anim.roll;
      else if (part.pivot.driver === 'elevon-stbd') a = anim.pitch - anim.roll;
      else if (part.pivot.driver === 'bay-door') a = anim.bay * 1.55;
      pivot.current.quaternion.setFromAxisAngle(axis, a * part.pivot.sense);
    }
  });

  const pickable = !vis.hidden && vis.ghost === 0 && part.kind !== 'lines';

  const accept = (e: ThreeEvent<PointerEvent | MouseEvent>) => {
    if (!pickable) return false;
    if (vis.clip && isClippedPoint(e.point)) return false;
    return true;
  };
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    if (!accept(e)) return;
    e.stopPropagation();
    const s = useStore.getState();
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
    s.select(resolvePick(part.componentId, s.focusId));
  };

  const handlers = pickable ? { onPointerMove: onMove, onPointerOut: onOut, onClick } : {};
  const noRay = pickable ? undefined : () => null;

  let inner: React.ReactNode;
  if (part.kind === 'lines') {
    inner = <lineSegments ref={obj as never} geometry={geometry} material={material} raycast={() => null} name={part.key} />;
  } else if (part.kind === 'instanced') {
    inner = (
      <instancedMesh
        ref={obj as never}
        args={[geometry, material, part.instances!.length]}
        name={part.key}
        raycast={noRay as never}
        {...handlers}
      />
    );
  } else {
    inner = <mesh ref={obj as never} geometry={geometry} material={material} name={part.key} raycast={noRay as never} {...handlers} />;
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

export function AircraftModel() {
  const parts = useMemo(() => {
    const list = buildParts();
    list.forEach((p) => OWN_GEOMETRY.add(p.componentId));
    return list;
  }, []);
  useEffect(() => {
    useStore.getState().setRenderStatus('ready');
    const w = window as unknown as { __nightfall?: Record<string, unknown> };
    w.__nightfall = { ...(w.__nightfall ?? {}), parts: parts.length, registry, store: useStore };
  }, [parts]);
  return (
    <group name="CX-7 Nightfall">
      {parts.map((p) => (
        <PartObject key={p.key} part={p} />
      ))}
    </group>
  );
}
