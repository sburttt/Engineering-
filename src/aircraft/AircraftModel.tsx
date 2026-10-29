import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { buildParts, type Part } from './parts';
import { createMaterial, BASE_OPACITY } from './materials';
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

const HIGHLIGHT = new THREE.Color('#bfe0e8');
const NO_RAY = () => null;

type Vis = { hidden: boolean; ghost: number; clip: boolean; sel: number; hov: boolean; reach: boolean };

/** Components that own geometry (an assembly without its own meshes highlights its children fully). */
const OWN_GEOMETRY = new Set<string>();

function visualKey(s: ReturnType<typeof useStore.getState>, part: Part): string {
  const cid = part.componentId;
  const inFocus = !s.focusId || isDescendant(cid, s.focusId);
  const focusedHere = !!s.focusId && inFocus;
  const selectedHere = !!s.selectedId && isDescendant(cid, s.selectedId);
  const hidden = (!!part.payload && part.payload !== s.payloadId) || (s.isolate && !inFocus);
  // Focus keeps the rest of the aircraft solid (context matters); only the systems view ghosts the shell.
  let ghost = 0;
  if (part.role === 'shell' && s.cutaway === 'internal' && !focusedHere && !selectedHere) ghost = 0.07;
  const clip = part.role === 'shell' && s.cutaway === 'partial' && !focusedHere && !selectedHere;
  const hov = !!s.hoveredId && isDescendant(cid, s.hoveredId);
  // sel: 0 none, 1 selected, 2 selected but also the enlarged assembly (soft), 3 child of a selected part (soft)
  let sel = 0;
  if (selectedHere) {
    if (s.focusId && s.focusId === s.selectedId) sel = 2;
    else if (cid !== s.selectedId && OWN_GEOMETRY.has(s.selectedId!)) sel = 3;
    else sel = 1;
  }
  // Internal parts sit behind a closed skin in the exterior views; small gaps between panels must
  // not let a click reach them. They become clickable once they are actually exposed.
  const exposedBay = s.bayOpen && (cid === 'bay' || cid.startsWith('payload-'));
  const reach = part.role !== 'internal' || s.cutaway !== 'exterior' || exposedBay || focusedHere;
  return [hidden ? 1 : 0, ghost, clip ? 1 : 0, sel, hov ? 1 : 0, reach ? 1 : 0].join('|');
}
const parseKey = (k: string): Vis => {
  const [h, g, c, s, v, r] = k.split('|');
  return { hidden: h === '1', ghost: +g, clip: c === '1', sel: +s, hov: v === '1', reach: r === '1' };
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
    if (!o || part.kind === 'lines' || part.decor) return;
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
    const baseOpacity = BASE_OPACITY[part.mat] ?? 1;
    const isDecal = part.mat.startsWith('decal-');
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

  const pickable = !vis.hidden && vis.ghost === 0 && part.kind !== 'lines' && !part.decor && vis.reach;
  const shadows = !part.decor && part.kind !== 'lines' && vis.ghost === 0;

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
  // Always pass an explicit function: React Three Fiber does not restore the prototype method
  // when this prop changes back to undefined, which would leave a part unclickable.
  const rayFn = part.kind === 'instanced' ? THREE.InstancedMesh.prototype.raycast : THREE.Mesh.prototype.raycast;
  const noRay = pickable ? rayFn : NO_RAY;

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
        castShadow={shadows}
        receiveShadow={shadows}
        {...handlers}
      />
    );
  } else {
    inner = (
      <mesh ref={obj as never} geometry={geometry} material={material} name={part.key} raycast={noRay as never} castShadow={shadows} receiveShadow={shadows} {...handlers} />
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

export function AircraftModel() {
  const parts = useMemo(() => {
    const list = buildParts();
    list.forEach((p) => OWN_GEOMETRY.add(p.componentId));
    return list;
  }, []);
  useEffect(() => {
    useStore.getState().setRenderStatus('ready');
    const w = window as unknown as { __nightfall?: Record<string, unknown> };
    w.__nightfall = {
      ...(w.__nightfall ?? {}),
      parts: parts.length,
      registry,
      store: useStore,
      resolvePick: (id: string) => resolvePick(id, useStore.getState().focusId),
    };
  }, [parts]);
  return (
    <group name="CX-7 Nightfall">
      {parts.map((p) => (
        <PartObject key={p.key} part={p} />
      ))}
    </group>
  );
}
