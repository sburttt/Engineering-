import { useEffect, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, GizmoHelper, GizmoViewport, Grid, Lightformer, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { AircraftModel } from './AircraftModel';
import { Animator } from './Animator';
import { boundsOf } from './runtime';
import { GROUND_Y } from './geometry/airframe';
import { useStore } from '../state/store';
import { PRESETS } from './presets';
import { COMPONENT_MAP } from '../data/components';

export const TARGET0 = new THREE.Vector3(0, 0.1, 0);

/** `?render=low` lowers resolution and drops contact shadows (used by automated tests on software GL). */
const LOW_POWER = (() => {
  try {
    return new URLSearchParams(location.search).get('render') === 'low';
  } catch {
    return false;
  }
})();

/** Preferred viewing directions for components that are best seen from a particular side. */
const VIEW_HINT: Record<string, [number, number, number]> = {
  bay: [0.3, -0.8, 0.5],
  'bay-doors': [0.3, -0.8, 0.5],
  'gear-nose': [0.7, -0.05, 0.75],
  'gear-port': [0.5, -0.05, -0.85],
  'gear-stbd': [0.5, -0.05, 0.85],
  exhaust: [-1, 0.35, 0.35],
  'aft-body': [-0.8, 0.6, 0.5],
  inlet: [1, 0.45, 0.35],
  'sensor-fwd': [0.7, -0.5, 0.5],
  'sensor-ventral': [0.4, -1, 0.4],
  'wing-port': [0.2, 0.9, -0.5],
  'wing-stbd': [0.2, 0.9, 0.5],
};

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function CameraRig() {
  const { camera, controls, size } = useThree() as unknown as { camera: THREE.PerspectiveCamera; controls: OrbitControlsImpl | null; size: { width: number; height: number } };
  const getSize = useThree((st) => st.get);
  const req = useStore((s) => s.cameraRequest);
  const anim = useRef<{ p0: THREE.Vector3; p1: THREE.Vector3; t0: THREE.Vector3; t1: THREE.Vector3; t: number; dur: number; rel?: THREE.Vector3 } | null>(null);

  useEffect(() => {
    if (!controls) return;
    const cancel = () => (anim.current = null);
    controls.addEventListener('start', cancel);
    return () => controls.removeEventListener('start', cancel);
  }, [controls]);

  // First frame: frame the default preset for this viewport's aspect ratio.
  useEffect(() => {
    if (!controls) return;
    const pr = PRESETS[useStore.getState().preset ?? 'three-quarter-front'];
    const t = pr.target ? new THREE.Vector3(...pr.target) : TARGET0.clone();
    const k = Math.max(1, 1.3 / Math.max(size.width / Math.max(size.height, 1), 0.3));
    camera.position.copy(new THREE.Vector3(...pr.pos).sub(pr.target ? t : new THREE.Vector3()).multiplyScalar(k).add(t));
    controls.target.copy(t);
    controls.update();
  }, [controls, camera]);

  useEffect(() => {
    if (!req || !controls) return;
    const p0 = camera.position.clone();
    const t0 = controls.target.clone();
    let p1: THREE.Vector3;
    let t1: THREE.Vector3;
    let rel: THREE.Vector3 | undefined;
    if (req.kind === 'zoom') {
      t1 = t0.clone();
      const d = p0.clone().sub(t0);
      const len = THREE.MathUtils.clamp(d.length() * req.factor, 1.2, 70);
      p1 = t0.clone().add(d.setLength(len));
      anim.current = { p0, p1, t0, t1, t: 0, dur: 0.35 };
      return;
    }
    if (req.kind === 'preset') {
      const pr = PRESETS[req.id];
      t1 = pr.target ? new THREE.Vector3(...pr.target) : TARGET0.clone();
      // Narrow (portrait) viewports need more distance to fit the span.
      const sz = getSize().size;
      const k = Math.max(1, 1.3 / Math.max(sz.width / Math.max(sz.height, 1), 0.3));
      rel = new THREE.Vector3(...pr.pos).sub(pr.target ? t1 : new THREE.Vector3());
      p1 = rel.clone().multiplyScalar(k).add(t1);
    } else {
      const box = boundsOf(req.id);
      if (!box) return;
      const sphere = box.getBoundingSphere(new THREE.Sphere());
      const r = Math.max(sphere.radius, 0.35);
      const fov = (camera.fov * Math.PI) / 180;
      const sz = getSize().size;
      // fit against whichever field of view (vertical or horizontal) is narrower
      const half = Math.min(fov / 2, Math.atan(Math.tan(fov / 2) * (sz.width / Math.max(sz.height, 1))));
      const fit = r / Math.sin(half);
      const dist = Math.max(req.mode === 'enlarge' ? fit * 1.1 : req.mode === 'sub' ? fit * 1.8 : Math.max(fit * 1.7, 11), 1.4);
      const s = useStore.getState();
      const rec = COMPONENT_MAP[req.id];
      let dir: THREE.Vector3;
      const hint = VIEW_HINT[req.id] ?? (req.id.startsWith('payload-') ? VIEW_HINT.bay : undefined);
      if (hint) dir = new THREE.Vector3(...hint);
      else if (rec?.location === 'internal' && s.cutaway === 'partial') dir = new THREE.Vector3(0.35, 0.85, 0.6);
      else dir = p0.clone().sub(t0);
      dir.normalize();
      t1 = sphere.center.clone();
      p1 = t1.clone().add(dir.multiplyScalar(dist));
    }
    anim.current = { p0, p1, t0, t1, t: 0, dur: 1.1, rel };
  }, [req, camera, controls]);

  useEffect(() => {
    const w = window as unknown as { __nightfall?: Record<string, unknown> };
    w.__nightfall = { ...(w.__nightfall ?? {}), camera, controls };
  }, [camera, controls]);

  useFrame((_, dt) => {
    const a = anim.current;
    if (!a || !controls) return;
    a.t = Math.min(1, a.t + dt / a.dur);
    // Presets track the live aspect ratio (the layout may still be settling when they start).
    if (a.rel) {
      const sz = getSize().size;
      a.p1.copy(a.rel).multiplyScalar(Math.max(1, 1.3 / Math.max(sz.width / Math.max(sz.height, 1), 0.3))).add(a.t1);
    }
    const e = easeInOut(a.t);
    camera.position.lerpVectors(a.p0, a.p1, e);
    controls.target.lerpVectors(a.t0, a.t1, e);
    controls.update();
    if (a.t >= 1) anim.current = null;
  });
  return null;
}

/** In the overview, shift the rendered frame right so the aircraft sits beside the copy. */
function OverviewOffset() {
  const cur = useRef({ x: 0, y: 0 });
  useFrame((state, dt) => {
    const cam = state.camera as THREE.PerspectiveCamera;
    const { width, height } = state.size;
    const overview = useStore.getState().tab === 'overview';
    // Wide screens: copy on the left, aircraft to the right. Phones: copy below, aircraft above.
    const want = overview ? (width > 900 ? { x: 0.2, y: 0 } : { x: 0, y: 0.26 }) : { x: 0, y: 0 };
    const k = 1 - Math.exp(-dt * 4);
    const c = cur.current;
    c.x += (want.x - c.x) * k;
    c.y += (want.y - c.y) * k;
    if (Math.abs(c.x) < 0.001 && Math.abs(c.y) < 0.001) {
      if (cam.view?.enabled) {
        cam.clearViewOffset();
        cam.aspect = width / height;
        cam.updateProjectionMatrix();
      }
      return;
    }
    cam.setViewOffset(width, height, -c.x * width, c.y * height, width, height);
  });
  return null;
}

function Gizmo() {
  const show = useStore((s) => s.tab !== 'overview');
  const wide = useThree((st) => st.size.width > 520);
  if (!show || !wide) return null;
  return (
    <GizmoHelper alignment="bottom-right" margin={[64, 64]}>
      <GizmoViewport axisColors={['#c97b63', '#8fb873', '#6f9fc4']} labelColor="#0a0c0f" labels={['X', 'Y', 'Z']} />
    </GizmoHelper>
  );
}

function Floor() {
  const showGrid = useStore((s) => s.showGrid);
  const group = useRef<THREE.Group>(null);
  const { camera } = useThree();
  useFrame(() => {
    if (group.current) group.current.visible = camera.position.y > GROUND_Y + 0.05;
  });
  return (
    <group ref={group}>
      <mesh rotation-x={-Math.PI / 2} position={[0, GROUND_Y - 0.002, 0]} raycast={() => null}>
        <circleGeometry args={[60, 64]} />
        <meshStandardMaterial color="#0c0e11" roughness={0.95} metalness={0} />
      </mesh>
      {showGrid && (
        <Grid
          position={[0, GROUND_Y, 0]}
          args={[80, 80]}
          cellSize={1}
          cellThickness={0.6}
          cellColor="#1a2026"
          sectionSize={5}
          sectionThickness={1}
          sectionColor="#27323b"
          fadeDistance={55}
          fadeStrength={1.4}
          infiniteGrid
          raycast={() => null}
        />
      )}
      {!LOW_POWER && <ContactShadows position={[0, GROUND_Y + 0.003, 0]} scale={30} blur={2.4} opacity={0.62} far={4.5} resolution={512} color="#000000" />}
    </group>
  );
}

function Lights() {
  return (
    <>
      <ambientLight intensity={0.22} />
      <hemisphereLight args={['#c9d6e0', '#2a323b', 0.45]} />
      <directionalLight position={[9, 13, 7]} intensity={2.3} color="#f1f3f5" />
      <directionalLight position={[-10, 4, -6]} intensity={0.5} color="#9fb3c4" />
      <directionalLight position={[-12, 6, 10]} intensity={1.1} color="#d7e3ec" />
      <directionalLight position={[3, -9, 4]} intensity={1.5} color="#9fb2c2" />
      <directionalLight position={[-4, -6, -5]} intensity={0.45} color="#8a9cac" />
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={1.6} color="#e9eef2" position={[0, 9, 0]} rotation-x={Math.PI / 2} scale={[18, 6, 1]} />
        <Lightformer form="rect" intensity={0.8} color="#bccbd6" position={[12, 3, 6]} rotation-y={-Math.PI / 2.4} scale={[10, 3, 1]} />
        <Lightformer form="rect" intensity={0.6} color="#9fb5c5" position={[-12, 2, -4]} rotation-y={Math.PI / 2} scale={[10, 2, 1]} />
        <Lightformer form="ring" intensity={0.5} color="#7fb8c4" position={[0, 2, -14]} scale={4} />
        <Lightformer form="rect" intensity={1.3} color="#aab8c4" position={[0, -8, 0]} rotation-x={-Math.PI / 2} scale={[20, 8, 1]} />
      </Environment>
    </>
  );
}

function ControlsBinding() {
  const autoRotate = useStore((s) => s.autoRotate || s.tab === 'overview');
  return (
    <OrbitControls
      makeDefault
      enableDamping
      dampingFactor={0.08}
      minDistance={1.2}
      maxDistance={70}
      minPolarAngle={0}
      maxPolarAngle={Math.PI}
      autoRotate={autoRotate}
      autoRotateSpeed={0.45}
      target={TARGET0}
      zoomSpeed={0.9}
    />
  );
}

export default function AircraftScene({ active = true }: { active?: boolean }) {
  const setStatus = useStore((s) => s.setRenderStatus);
  return (
    <Canvas
      frameloop={active ? 'always' : 'never'}
      dpr={LOW_POWER ? 0.5 : [1, 2]}
      camera={{ fov: 35, position: PRESETS['three-quarter-front'].pos, near: 0.05, far: 300 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.localClippingEnabled = true;
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.15;
        gl.domElement.addEventListener('webglcontextlost', () => setStatus('unavailable'));
      }}
      onPointerMissed={() => useStore.getState().hover(null)}
    >
      <color attach="background" args={['#0a0c0f']} />
      <fog attach="fog" args={['#0a0c0f', 34, 80]} />
      <Lights />
      <Floor />
      <Animator />
      <AircraftModel />
      <ControlsBinding />
      <CameraRig />
      <OverviewOffset />
      <Gizmo />
    </Canvas>
  );
}
