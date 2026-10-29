import * as THREE from 'three';
import type { MatKey } from './parts';
import { EMBLEM } from '../data/brand';

/**
 * Very restrained micro-surface: a two-octave world-space value noise nudges roughness by a few
 * percent, so broad reflections break up slightly like a real coated composite skin. It is
 * invisible at a distance and never competes with the geometry.
 */
function microSurface(m: THREE.MeshPhysicalMaterial, amount: number) {
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vNfWorld;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvNfWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vNfWorld;
float nfHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float nfNoise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(nfHash(i), nfHash(i + vec3(1,0,0)), f.x), mix(nfHash(i + vec3(0,1,0)), nfHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(nfHash(i + vec3(0,0,1)), nfHash(i + vec3(1,0,1)), f.x), mix(nfHash(i + vec3(0,1,1)), nfHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
float nfN = nfNoise(vNfWorld * 1.6) * 0.65 + nfNoise(vNfWorld * 11.0) * 0.35;
roughnessFactor = clamp(roughnessFactor * (1.0 + ${amount.toFixed(3)} * (nfN - 0.5)), 0.04, 1.0);`,
      );
  };
  m.customProgramCacheKey = () => 'nf-micro-' + amount;
  return m;
}

const physical = (o: THREE.MeshPhysicalMaterialParameters, micro = 0) => {
  const m = new THREE.MeshPhysicalMaterial(o);
  return micro ? microSurface(m, micro) : m;
};

/**
 * Physically based material presets. Each part gets its own clone so highlight/ghost state is per part.
 * Airframe finish: a deep graphite coated composite — low metalness, satin clear coat — with the
 * radome, control surfaces and service panels separated only by small roughness differences.
 */
const presets: Record<string, () => THREE.Material> = {
  skin: () => physical({ color: '#1c1f23', roughness: 0.52, metalness: 0.08, clearcoat: 0.3, clearcoatRoughness: 0.42, specularIntensity: 0.5 }, 0.22),
  skinSatin: () => physical({ color: '#1e2125', roughness: 0.47, metalness: 0.08, clearcoat: 0.34, clearcoatRoughness: 0.38, specularIntensity: 0.52 }, 0.2),
  panel: () =>
    physical({ color: '#1d2024', roughness: 0.53, metalness: 0.08, clearcoat: 0.3, clearcoatRoughness: 0.42, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }, 0.2),
  glass: () =>
    physical({
      color: '#06090b',
      roughness: 0.14,
      metalness: 0.1,
      clearcoat: 1,
      clearcoatRoughness: 0.04,
      specularIntensity: 0.7,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -4,
    }),
  inletDark: () => new THREE.MeshStandardMaterial({ color: '#040505', roughness: 0.92, metalness: 0.05 }),
  exhaust: () => new THREE.MeshStandardMaterial({ color: '#2e2a26', roughness: 0.46, metalness: 0.75 }),
  interior: () => new THREE.MeshStandardMaterial({ color: '#4b5159', roughness: 0.72, metalness: 0.2 }),
  struct: () => new THREE.MeshStandardMaterial({ color: '#68707a', roughness: 0.55, metalness: 0.3 }),
  module: () => new THREE.MeshStandardMaterial({ color: '#2b3038', roughness: 0.45, metalness: 0.55 }),
  moduleLight: () => new THREE.MeshStandardMaterial({ color: '#8a929b', roughness: 0.38, metalness: 0.62 }),
  metal: () => new THREE.MeshStandardMaterial({ color: '#a2a9b0', roughness: 0.28, metalness: 0.9 }),
  rubber: () => new THREE.MeshStandardMaterial({ color: '#111112', roughness: 0.86, metalness: 0 }),
  copper: () => new THREE.MeshStandardMaterial({ color: '#9c6a43', roughness: 0.35, metalness: 0.9 }),
  amber: () => new THREE.MeshStandardMaterial({ color: '#b98a3c', roughness: 0.5, metalness: 0.1 }),
  indicator: () => new THREE.MeshStandardMaterial({ color: '#7fb8c4', roughness: 0.4, metalness: 0.1, emissive: '#2c5a63', emissiveIntensity: 0.4 }),
  cable: () => new THREE.MeshStandardMaterial({ color: '#30353b', roughness: 0.82, metalness: 0.1 }),
  duct: () => new THREE.MeshStandardMaterial({ color: '#7f878f', roughness: 0.6, metalness: 0.35 }),
  // panel gaps: dark, matte, drawn on top of the skin without writing depth
  seam: () =>
    new THREE.MeshStandardMaterial({
      color: '#050607',
      roughness: 0.95,
      metalness: 0,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -6,
    }),
  fastener: () => new THREE.MeshStandardMaterial({ color: '#2d3237', roughness: 0.42, metalness: 0.7 }),
  line: () => new THREE.LineBasicMaterial({ color: '#5d666f', transparent: true, opacity: 0.55 }),
};

/** Resting opacity of materials that are always see-through. */
export const BASE_OPACITY: Partial<Record<MatKey, number>> = { seam: 0.62, line: 0.55 };

const DECALS = new Map<string, THREE.CanvasTexture>();
const FONT_DISPLAY = 'Michroma, "Eurostile", "Arial Black", sans-serif';
const FONT_MONO = '"IBM Plex Mono", ui-monospace, Menlo, monospace';

function drawEmblem(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
  const s = size / 64;
  ctx.fillStyle = color;
  for (const poly of Object.values(EMBLEM)) {
    ctx.beginPath();
    poly.forEach(([px, py], i) => (i ? ctx.lineTo(x + px * s, y + py * s) : ctx.moveTo(x + px * s, y + py * s)));
    ctx.closePath();
    ctx.fill();
  }
}

function paintDecal(key: string, ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.clearRect(0, 0, w, h);
  const ink = 'rgba(200,205,210,0.5)';
  ctx.textBaseline = 'middle';
  switch (key) {
    case 'decal-wordmark':
      drawEmblem(ctx, 8, h * 0.08, h * 0.84, ink);
      ctx.fillStyle = ink;
      ctx.font = `${Math.round(h * 0.42)}px ${FONT_DISPLAY}`;
      ctx.fillText('CORVANE', h * 1.0, h * 0.48);
      break;
    case 'decal-reg':
      ctx.fillStyle = 'rgba(200,205,210,0.45)';
      ctx.font = `500 ${Math.round(h * 0.4)}px ${FONT_MONO}`;
      ctx.fillText('CX-7   NF-01   CVR', 6, h * 0.5);
      break;
    case 'decal-nostep':
      ctx.strokeStyle = 'rgba(196,203,210,0.45)';
      ctx.lineWidth = 3;
      ctx.strokeRect(4, 4, w - 8, h - 8);
      ctx.fillStyle = 'rgba(196,203,210,0.5)';
      ctx.font = `500 ${Math.round(h * 0.5)}px ${FONT_MONO}`;
      ctx.textAlign = 'center';
      ctx.fillText('NO STEP', w / 2, h / 2 + 2);
      break;
    case 'decal-intake':
      ctx.fillStyle = 'rgba(170,96,78,0.5)';
      ctx.font = `500 ${Math.round(h * 0.46)}px ${FONT_MONO}`;
      ctx.textAlign = 'center';
      ctx.fillText('▲  INTAKE DANGER AREA  ▲', w / 2, h / 2 + 2);
      break;
    case 'decal-belly':
      ctx.fillStyle = 'rgba(196,203,210,0.32)';
      ctx.font = `${Math.round(h * 0.62)}px ${FONT_DISPLAY}`;
      ctx.textAlign = 'center';
      ctx.fillText('CX-7', w / 2, h / 2 + 4);
      break;
  }
}

function decalTexture(key: string): THREE.CanvasTexture {
  const hit = DECALS.get(key);
  if (hit) return hit;
  const sizes: Record<string, [number, number]> = {
    'decal-wordmark': [1024, 256],
    'decal-reg': [1024, 200],
    'decal-nostep': [512, 132],
    'decal-intake': [1024, 172],
    'decal-belly': [512, 128],
  };
  const [w, h] = sizes[key] ?? [512, 128];
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  paintDecal(key, ctx, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  DECALS.set(key, tex);
  // Repaint once web fonts are ready (falls back to system faces if they never load).
  document.fonts?.ready.then(() => {
    paintDecal(key, ctx, w, h);
    tex.needsUpdate = true;
  });
  return tex;
}

export function createMaterial(key: MatKey): THREE.Material {
  if (key.startsWith('decal-')) {
    return new THREE.MeshStandardMaterial({
      map: decalTexture(key),
      transparent: true,
      roughness: 0.6,
      metalness: 0.1,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
    });
  }
  const m = presets[key]();
  m.side = THREE.DoubleSide;
  if (key === 'skin' || key === 'skinSatin' || key === 'panel') m.shadowSide = THREE.BackSide;
  return m;
}

export const ACCENT = new THREE.Color('#5fa9b8');
