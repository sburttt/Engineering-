import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, Grid, Lightformer, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { AircraftModel } from './AircraftModel';
import { Animator } from './Animator';
import { anim, boundsOf, boundsOfAll, publishView, view } from './runtime';
import { ASSEMBLY_MAP } from '../data/assemblies';
import { DURATION, cine, lightAt, poseAt, stateAt } from './cinema';
import { GROUND_Y, HALF_SPAN, clamp, hLo, hUp, xLE, xTE } from './geometry/airframe';
import { useStore } from '../state/store';
import { PRESETS } from './presets';
import { COMPONENT_MAP } from '../data/components';

export const TARGET0 = new THREE.Vector3(0.2, -0.15, 0);
const BG = '#0b0c0e';
/** Scene background per render mode. */
export const BACKGROUND = { real: '#0b0c0e', xray: '#0a0c0f', wire: '#0d0f12', blueprint: '#0b1d33' } as const;
/** Long lens for the blueprint: the same model read almost orthographically. */
const lensFor = (r: string) => (r === 'blueprint' ? 3.4 : 1);

/** `?render=low` lowers resolution and drops shadows (used by automated tests on software GL). */
const LOW_POWER = (() => {
  try {
    return new URLSearchParams(location.search).get('render') === 'low';
  } catch {
    return false;
  }
})();
const REDUCED_MOTION = (() => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
})();

/** Preferred viewing directions for components that are best seen from a particular side. */
const VIEW_HINT: Record<string, [number, number, number]> = {
  bay: [0.35, -0.75, 0.55],
  'bay-doors': [0.35, -0.75, 0.55],
  'gear-nose': [0.75, -0.08, 0.7],
  'gear-port': [0.5, -0.08, -0.85],
  'gear-stbd': [0.5, -0.08, 0.85],
  exhaust: [-1, 0.4, 0.4],
  'aft-body': [-0.8, 0.6, 0.5],
  inlet: [1, 0.5, 0.4],
  fairing: [0.4, 0.75, 0.55],
  'fwd-fuselage': [0.8, 0.35, 0.55],
  'sensor-fwd': [0.7, -0.5, 0.5],
  'sensor-ventral': [0.4, -1, 0.4],
  'wing-port': [0.15, 0.9, -0.45],
  'wing-stbd': [0.15, 0.9, 0.45],
  'tip-port': [0.3, 0.35, -0.9],
  'tip-stbd': [0.3, 0.35, 0.9],
};

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
/** Narrow (portrait) frames need more distance to keep the span in view. */
const aspectScale = (w: number, h: number) => Math.max(1, 1.52 / Math.max(w / Math.max(h, 1), 0.3));

/** Conservative test: is this camera position inside (or skimming) the airframe? */
function insideAirframe(p: THREE.Vector3) {
  const az = Math.abs(p.z);
  if (az > HALF_SPAN + 0.35) return false;
  const zc = Math.min(az, HALF_SPAN);
  if (p.x > xLE(zc) + 0.4 || p.x < xTE(zc) - 0.4) return false;
  const xc = clamp(p.x, xTE(zc), xLE(zc));
  const top = hUp(xc, zc) + (az < 0.95 ? 0.42 : 0) + 0.32;
  const bot = Math.min(hLo(xc, zc) - 0.32, az < 2.4 ? GROUND_Y + 0.1 : Infinity);
  return p.y < top && p.y > bot;
}

type Move = { p0: THREE.Vector3; p1: THREE.Vector3; t0: THREE.Vector3; t1: THREE.Vector3; t: number; start: number; dur: number; rel?: THREE.Vector3; ease: (t: number) => number };

function CameraRig() {
  const { camera, controls } = useThree() as unknown as { camera: THREE.PerspectiveCamera; controls: OrbitControlsImpl | null };
  const get = useThree((st) => st.get);
  const req = useStore((s) => s.cameraRequest);
  const move = useRef<Move | null>(null);
  const saved = useRef<{ pos: THREE.Vector3; target: THREE.Vector3 } | null>(null);

  useEffect(() => {
    if (!controls) return;
    const cancel = () => {
      move.current = null;
      if (useStore.getState().preset) useStore.setState({ preset: null });
    };
    controls.addEventListener('start', cancel);
    return () => controls.removeEventListener('start', cancel);
  }, [controls]);

  const presetPose = (id: keyof typeof PRESETS) => {
    const pr = PRESETS[id];
    const t = pr.target ? new THREE.Vector3(...pr.target) : TARGET0.clone();
    const rel = new THREE.Vector3(...pr.pos).sub(t);
    const { width, height } = get().size;
    // distances follow the lens currently on the camera; a lens change rescales moves in flight.
    // Blueprint sheets keep wider margins for labels and dimension lines.
    rel.multiplyScalar(camera.zoom * (useStore.getState().render === 'blueprint' ? 1.3 : 1));
    return { t, rel, p: rel.clone().multiplyScalar(aspectScale(width, height)).add(t) };
  };

  // First frame: compose the opening view, with a short settling move unless motion is reduced.
  useEffect(() => {
    if (!controls) return;
    const s = useStore.getState();
    const id = s.mode === 'cutaway' || s.render === 'xray' ? 'internal' : s.render === 'blueprint' ? 'side' : 'hero';
    const { t, rel, p } = presetPose(id);
    if (s.mode === 'payload') {
      useStore.setState({ cameraRequest: { kind: 'fit', id: 'bay', mode: 'locate', nonce: -1 } });
    }
    if (REDUCED_MOTION || LOW_POWER || id !== 'hero') {
      camera.position.copy(p);
      controls.target.copy(t);
      controls.update();
      return;
    }
    const start = p.clone().sub(t).applyAxisAngle(new THREE.Vector3(0, 1, 0), -0.32).multiplyScalar(1.22).add(t);
    start.y += 1.5;
    camera.position.copy(start);
    controls.target.copy(t);
    controls.update();
    move.current = { p0: start, p1: p, t0: t.clone(), t1: t.clone(), t: 0, start: performance.now(), dur: 2.6, rel, ease: easeOut };
  }, [controls, camera]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!req || !controls) return;
    const p0 = camera.position.clone();
    const t0 = controls.target.clone();
    const dur = REDUCED_MOTION ? 0.001 : 1.05;
    if (req.kind === 'zoom') {
      const d = p0.clone().sub(t0);
      const len = THREE.MathUtils.clamp(d.length() * req.factor, 1.2, 95 * lensFor(useStore.getState().render));
      move.current = { p0, p1: t0.clone().add(d.setLength(len)), t0, t1: t0.clone(), t: 0, start: performance.now(), dur: REDUCED_MOTION ? 0.001 : 0.35, ease: easeInOut };
      return;
    }
    if (req.kind === 'restore') {
      const back = saved.current;
      saved.current = null;
      if (back) {
        move.current = { p0, p1: back.pos, t0, t1: back.target, t: 0, start: performance.now(), dur, ease: easeInOut };
        return;
      }
      const st = useStore.getState();
      const id = st.mode === 'cutaway' || st.render === 'xray' ? 'internal' : st.render === 'blueprint' ? 'side' : 'hero';
      const { t, rel, p } = presetPose(id);
      move.current = { p0, p1: p, t0, t1: t, t: 0, start: performance.now(), dur, rel, ease: easeInOut };
      return;
    }
    if (req.kind === 'preset') {
      saved.current = null;
      const { t, rel, p } = presetPose(req.id);
      move.current = { p0, p1: p, t0, t1: t, t: 0, start: performance.now(), dur, rel, ease: easeInOut };
      return;
    }
    const fitDistance = (r: number) => {
      const fov = (camera.fov * Math.PI) / 180;
      const { width, height } = get().size;
      const half = Math.min(fov / 2, Math.atan(Math.tan(fov / 2) * (width / Math.max(height, 1))));
      return (r / Math.sin(half)) * camera.zoom;
    };
    if (req.kind === 'assembly') {
      const a = ASSEMBLY_MAP[req.id];
      const box = a && boundsOfAll(a.members);
      if (!box) return;
      if (!saved.current) saved.current = { pos: p0.clone(), target: t0.clone() };
      const sphere = box.getBoundingSphere(new THREE.Sphere());
      // leave room for the separated parts and their labels
      const r = Math.max(sphere.radius, 0.6) + 1.1;
      const centre = sphere.center.clone();
      if (a.style === 'explicit') {
        const lift = Object.values(a.offsets ?? {}).reduce((m, o) => m.add(new THREE.Vector3(...o)), new THREE.Vector3());
        centre.addScaledVector(lift, 0.5 / Math.max(1, a.members.length));
      }
      const dist = Math.max(fitDistance(r) * 1.18, 3);
      move.current = { p0, p1: centre.clone().add(new THREE.Vector3(...a.view).normalize().multiplyScalar(dist)), t0, t1: centre, t: 0, start: performance.now(), dur: REDUCED_MOTION ? 0.001 : 1.3, ease: easeInOut };
      return;
    }
    // fit
    const box = boundsOf(req.id);
    if (!box) return;
    if (req.mode === 'focus' && !saved.current) saved.current = { pos: p0.clone(), target: t0.clone() };
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const r = Math.max(sphere.radius, 0.35);
    // fit against whichever field of view (vertical or horizontal) is narrower
    const fit = fitDistance(r);
    const dist = Math.max(req.mode === 'focus' ? fit * 1.12 : Math.max(fit * 1.6, 10 * camera.zoom), 1.5);
    const s = useStore.getState();
    const rec = COMPONENT_MAP[req.id];
    const hint = VIEW_HINT[req.id] ?? (req.id.startsWith('payload-') ? VIEW_HINT.bay : undefined);
    let dir: THREE.Vector3;
    if (hint) dir = new THREE.Vector3(...hint);
    else if (rec?.location === 'internal' && s.cutaway === 'partial') dir = new THREE.Vector3(0.35, 0.85, 0.6);
    else dir = p0.clone().sub(t0);
    dir.normalize();
    const t1 = sphere.center.clone();
    move.current = { p0, p1: t1.clone().add(dir.multiplyScalar(dist)), t0, t1, t: 0, start: performance.now(), dur, ease: easeInOut };
  }, [req, camera, controls]); // eslint-disable-line react-hooks/exhaustive-deps

  // Test hook: name of the mesh under a client-space point (used by the automated checks).
  const scene = useThree((st) => st.scene);
  useEffect(() => {
    const w = window as unknown as { __nightfall?: Record<string, unknown> };
    const ray = new THREE.Raycaster();
    const probe = (x: number, y: number, all = false) => {
      const r = get().gl.domElement.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1), camera);
      const hits = ray.intersectObjects(scene.children, true).filter((h) => h.object.visible && (h.object as THREE.Mesh).isMesh && h.object.name);
      const fmt = (h: THREE.Intersection) => ({ name: h.object.name, componentId: h.object.userData.componentId ?? null, point: h.point.toArray().map((v) => +v.toFixed(2)) });
      if (all) return hits.slice(0, 8).map(fmt);
      return hits[0] ? fmt(hits[0]) : null;
    };
    w.__nightfall = { ...(w.__nightfall ?? {}), camera, controls, probe, cine };
  }, [camera, controls, scene]); // eslint-disable-line react-hooks/exhaustive-deps

  const tmp = useMemo(() => new THREE.Vector3(), []);
  const wasCinema = useRef(false);
  useFrame((_, frameDt) => {
    if (!controls) return;
    const st = useStore.getState();
    view.camera = camera;
    view.width = get().size.width;
    view.height = get().size.height;
    // Cinematic presentation: the timeline owns the camera.
    if (st.cinema) {
      wasCinema.current = true;
      move.current = null;
      controls.enabled = false;
      if (camera.zoom !== 1) {
        camera.zoom = 1;
        camera.updateProjectionMatrix();
      }
      const pose = poseAt(cine.t);
      const tg0 = new THREE.Vector3(...pose.target);
      const { width, height } = get().size;
      camera.position.set(...pose.pos).sub(tg0).multiplyScalar(aspectScale(width, height)).add(tg0);
      controls.target.copy(tg0);
      camera.lookAt(tg0);
      return;
    }
    if (wasCinema.current) {
      wasCinema.current = false;
      controls.enabled = true;
    }
    // Blueprint lens: change focal length while keeping the framing (distance scales with zoom).
    const L = lensFor(st.render);
    if (Math.abs(camera.zoom - L) > 1e-4) {
      const z0 = camera.zoom;
      const k = 1 - Math.exp(-Math.min(frameDt, 0.5) * 7);
      const z1 = REDUCED_MOTION ? L : z0 + (L - z0) * k + Math.sign(L - z0) * 0.004;
      const z = (L - z0) * (L - z1) <= 0 ? L : z1;
      tmp.copy(camera.position).sub(controls.target).multiplyScalar(z / z0);
      camera.position.copy(controls.target).add(tmp);
      if (move.current) {
        const k = z / z0;
        for (const [pv, tv] of [[move.current.p0, move.current.t0], [move.current.p1, move.current.t1]] as const) pv.sub(tv).multiplyScalar(k).add(tv);
        if (move.current.rel) move.current.rel.multiplyScalar(k);
      }
      camera.zoom = z;
      camera.updateProjectionMatrix();
      controls.maxDistance = 95 * Math.max(z, 1);
    }
    const a = move.current;
    if (a) {
      // wall-clock progress: moves finish on time even when the frame rate is low
      a.t = Math.min(1, (performance.now() - a.start) / 1000 / a.dur);
      if (a.rel) {
        // presets track the live aspect ratio (the layout may still be settling)
        const { width, height } = get().size;
        a.p1.copy(a.rel).multiplyScalar(aspectScale(width, height)).add(a.t1);
      }
      const e = a.ease(a.t);
      camera.position.lerpVectors(a.p0, a.p1, e);
      controls.target.lerpVectors(a.t0, a.t1, e);
      controls.update();
      if (a.t >= 1) move.current = null;
    }
    // Keep panning near the aircraft.
    const tg = controls.target;
    tg.set(clamp(tg.x, -9, 9), clamp(tg.y, -2.2, 3), clamp(tg.z, -10, 10));
    // Never let the camera pass into the closed airframe (systems views may go inside).
    if (st.cutaway === 'exterior' && st.render === 'real' && !st.explodeAsm && insideAirframe(camera.position)) {
      tmp.copy(camera.position).sub(tg);
      const len0 = Math.max(tmp.length(), 0.5);
      let len = len0;
      for (let i = 0; i < 60 && insideAirframe(camera.position); i++) {
        len *= 1.06;
        camera.position.copy(tg).add(tmp.setLength(len));
      }
    }
    tmp.copy(camera.position).sub(tg);
    const dist = tmp.length();
    let az = (Math.atan2(tmp.z, tmp.x) * 180) / Math.PI;
    if (az < 0) az += 360;
    publishView({ az, el: (Math.asin(clamp(tmp.y / Math.max(dist, 1e-6), -1, 1)) * 180) / Math.PI, dist });
  });
  return null;
}

/**
 * Composition: keep the aircraft clear of the interface. The frame shifts left when the component
 * panel is open (desktop) and up when the caption sits at the bottom (phones).
 */
function FrameOffset() {
  const cur = useRef({ x: 0, y: 0 });
  useFrame((state, dt) => {
    const cam = state.camera as THREE.PerspectiveCamera;
    const { width, height } = state.size;
    const s = useStore.getState();
    const panelOpen = !!s.selectedId && !s.immersive && !s.cinema;
    let want = { x: 0, y: 0 };
    if (s.cinema) want = { x: 0, y: 0 };
    else if (width > 900) {
      // the left rail takes ~250 px; the information panel ~360 px on the right
      const left = s.immersive ? 0 : 250;
      const right = panelOpen ? 380 : 0;
      want = { x: (left - right) / 2 / width, y: s.immersive ? 0 : 0.02 };
    } else if (!s.immersive) want = { x: 0, y: panelOpen ? 0.2 : 0.07 };
    const k = REDUCED_MOTION ? 1 : 1 - Math.exp(-dt * 5);
    const c = cur.current;
    c.x += (want.x - c.x) * k;
    c.y += (want.y - c.y) * k;
    if (Math.abs(c.x) < 0.0005 && Math.abs(c.y) < 0.0005) {
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

/** A soft pool of light on the studio floor under the aircraft. */
function floorPoolTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, 'rgba(255,255,255,0.055)');
  grd.addColorStop(0.45, 'rgba(255,255,255,0.025)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function Floor() {
  const showGrid = useStore((s) => s.showGrid);
  const group = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const pool = useMemo(floorPoolTexture, []);
  const render = useStore((s) => s.render);
  useFrame(() => {
    if (group.current) group.current.visible = camera.position.y > GROUND_Y + 0.05 && (render === 'real' || render === 'xray');
  });
  return (
    <group ref={group}>
      <mesh rotation-x={-Math.PI / 2} position={[0, GROUND_Y - 0.004, 0]} raycast={() => null}>
        <circleGeometry args={[80, 64]} />
        <meshStandardMaterial color="#070809" roughness={1} metalness={0} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0.5, GROUND_Y - 0.002, 0]} raycast={() => null}>
        <planeGeometry args={[34, 34]} />
        <meshBasicMaterial map={pool} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      {showGrid && (
        <Grid
          position={[0, GROUND_Y, 0]}
          args={[80, 80]}
          cellSize={1}
          cellThickness={0.5}
          cellColor="#191c20"
          sectionSize={5}
          sectionThickness={0.9}
          sectionColor="#262b31"
          fadeDistance={50}
          fadeStrength={1.5}
          infiniteGrid
          raycast={() => null}
        />
      )}
      {!LOW_POWER && <ContactShadows position={[0, GROUND_Y + 0.002, 0]} scale={34} blur={2.2} opacity={0.75} far={4.2} resolution={1024} color="#000000" />}
    </group>
  );
}

/**
 * Studio lighting: a large soft key from above-front, a cool low fill, a narrow rim from behind and
 * a weak under-fill so the belly keeps its shape. Reflections come from soft light cards only.
 */
function Lights() {
  const key = useRef<THREE.DirectionalLight>(null);
  const rig = useRef<THREE.Group>(null);
  const base = useRef<number[] | null>(null);
  const scene = useThree((st) => st.scene);
  useFrame(() => {
    const g = rig.current;
    if (!g) return;
    const lights = g.children.filter((o) => (o as THREE.Light).isLight) as THREE.Light[];
    if (!base.current) base.current = lights.map((l) => l.intensity);
    lights.forEach((l, i) => (l.intensity = base.current![i] * anim.light));
    scene.environmentIntensity = anim.light;
  });
  useEffect(() => {
    const l = key.current;
    if (!l) return;
    const c = l.shadow.camera as THREE.OrthographicCamera;
    Object.assign(c, { left: -11, right: 11, top: 11, bottom: -11, near: 1, far: 60 });
    c.updateProjectionMatrix();
    l.shadow.mapSize.set(2048, 2048);
    l.shadow.bias = -0.0003;
    l.shadow.normalBias = 0.035;
    l.shadow.radius = 3;
  }, []);
  return (
    <group ref={rig}>
      <ambientLight intensity={0.06} />
      <hemisphereLight args={['#d9dee3', '#2a2e33', 0.34]} />
      <directionalLight ref={key} position={[9, 16, 8]} intensity={2.1} color="#fff7ee" castShadow={!LOW_POWER} />
      <directionalLight position={[-11, 4.5, 3]} intensity={0.42} color="#aebccb" />
      <directionalLight position={[-13, 7, -11]} intensity={1.5} color="#e3ebf2" />
      <directionalLight position={[3, -10, 5]} intensity={1.4} color="#9aaabb" />
      <directionalLight position={[-4, -8, -6]} intensity={0.6} color="#8e9fb0" />
      <Environment resolution={LOW_POWER ? 64 : 256} frames={1}>
        {/* overhead softbox: the long, soft highlight that runs across the upper surfaces */}
        <Lightformer form="rect" intensity={1.5} color="#f4f2ef" position={[1, 11, 2]} rotation-x={Math.PI / 2} scale={[18, 5, 1]} />
        {/* strip lights: thin edge highlights along the leading edges and chines */}
        <Lightformer form="rect" intensity={2.0} color="#eef3f7" position={[11, 3.5, 9]} rotation-y={-Math.PI / 3.2} scale={[16, 0.5, 1]} />
        <Lightformer form="rect" intensity={1.8} color="#dfe7ee" position={[-12, 4.5, -7]} rotation-y={Math.PI / 2.6} scale={[16, 0.7, 1]} />
        {/* low front card and floor bounce keep the darker faces readable */}
        <Lightformer form="rect" intensity={0.55} color="#c6d0d8" position={[15, 0.4, -2]} rotation-y={-Math.PI / 2} scale={[9, 2.2, 1]} />
        <Lightformer form="rect" intensity={0.95} color="#a3acb5" position={[0, -7, 0]} rotation-x={-Math.PI / 2} scale={[24, 12, 1]} />
      </Environment>
    </group>
  );
}

/** Background and atmosphere for each render mode. */
function SceneLook() {
  const render = useStore((s) => s.render);
  const scene = useThree((st) => st.scene);
  useEffect(() => {
    scene.background = new THREE.Color(BACKGROUND[render]);
    scene.fog = render === 'real' || render === 'xray' ? new THREE.Fog(BACKGROUND[render], 38, 90) : null;
  }, [render, scene]);
  return null;
}

/** Advances the presentation clock and applies the timeline's render state and light level. */
function CinemaDriver() {
  useFrame((_, dt) => {
    const s = useStore.getState();
    if (!s.cinema) {
      if (anim.light !== 1) anim.light = Math.min(1, anim.light + dt * 1.5);
      return;
    }
    if (s.cinemaPlaying) {
      cine.t = Math.min(DURATION, cine.t + Math.min(dt, 0.5));
      if (cine.t >= DURATION) s.setCinemaPlaying(false);
    }
    anim.light = lightAt(cine.t);
    const want = stateAt(cine.t);
    if (s.render !== want.render) s.setRender(want.render);
    if (Math.abs(s.explode - want.explode) > 1e-3) s.setExplode(want.explode);
  });
  return null;
}

function ControlsBinding() {
  const autoRotate = useStore((s) => s.autoRotate);
  return (
    <OrbitControls
      makeDefault
      enableDamping
      dampingFactor={0.09}
      rotateSpeed={0.75}
      panSpeed={0.8}
      zoomSpeed={0.85}
      minDistance={1.2}
      maxDistance={95}
      minPolarAngle={0}
      maxPolarAngle={Math.PI}
      autoRotate={autoRotate}
      autoRotateSpeed={0.35}
      target={TARGET0}
    />
  );
}

export default function AircraftScene({ active = true }: { active?: boolean }) {
  const setStatus = useStore((s) => s.setRenderStatus);
  return (
    <Canvas
      frameloop={active ? 'always' : 'never'}
      dpr={LOW_POWER ? 0.5 : [1, 2]}
      shadows={!LOW_POWER}
      camera={{ fov: 32, position: PRESETS.hero.pos, near: 0.1, far: 1200 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.localClippingEnabled = true;
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
        gl.domElement.addEventListener('webglcontextlost', () => setStatus('unavailable'));
      }}
      onPointerMissed={() => useStore.getState().hover(null)}
    >
      <color attach="background" args={[BG]} />
      <SceneLook />
      <CinemaDriver />
      <Lights />
      <Floor />
      <Animator />
      <AircraftModel />
      <ControlsBinding />
      <CameraRig />
      <FrameOffset />
    </Canvas>
  );
}
