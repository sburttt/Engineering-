import * as THREE from 'three';
import type { MatKey } from './parts';
import { EMBLEM } from '../data/brand';

/** Physically based material presets. Each part gets its own clone so highlight/ghost state is per part. */
const presets: Record<string, () => THREE.Material> = {
  skin: () => new THREE.MeshPhysicalMaterial({ color: '#15181c', roughness: 0.56, metalness: 0.32, clearcoat: 0.18, clearcoatRoughness: 0.6 }),
  skinSatin: () => new THREE.MeshPhysicalMaterial({ color: '#1c2026', roughness: 0.38, metalness: 0.45, clearcoat: 0.45, clearcoatRoughness: 0.35 }),
  panel: () => new THREE.MeshPhysicalMaterial({ color: '#20252b', roughness: 0.33, metalness: 0.5, clearcoat: 0.55, clearcoatRoughness: 0.3 }),
  glass: () => new THREE.MeshPhysicalMaterial({ color: '#0a1116', roughness: 0.06, metalness: 0.85, clearcoat: 1, clearcoatRoughness: 0.05 }),
  inletDark: () => new THREE.MeshStandardMaterial({ color: '#050607', roughness: 0.95, metalness: 0.1 }),
  exhaust: () => new THREE.MeshStandardMaterial({ color: '#2b2622', roughness: 0.42, metalness: 0.8 }),
  interior: () => new THREE.MeshStandardMaterial({ color: '#4b5159', roughness: 0.72, metalness: 0.2 }),
  struct: () => new THREE.MeshStandardMaterial({ color: '#68707a', roughness: 0.55, metalness: 0.3 }),
  module: () => new THREE.MeshStandardMaterial({ color: '#2b3038', roughness: 0.45, metalness: 0.55 }),
  moduleLight: () => new THREE.MeshStandardMaterial({ color: '#8a929b', roughness: 0.38, metalness: 0.62 }),
  metal: () => new THREE.MeshStandardMaterial({ color: '#a2a9b0', roughness: 0.26, metalness: 0.92 }),
  rubber: () => new THREE.MeshStandardMaterial({ color: '#0e0e0f', roughness: 0.88, metalness: 0 }),
  copper: () => new THREE.MeshStandardMaterial({ color: '#9c6a43', roughness: 0.35, metalness: 0.9 }),
  amber: () => new THREE.MeshStandardMaterial({ color: '#b98a3c', roughness: 0.5, metalness: 0.1 }),
  indicator: () => new THREE.MeshStandardMaterial({ color: '#7fb8c4', roughness: 0.4, metalness: 0.1, emissive: '#2c5a63', emissiveIntensity: 0.4 }),
  cable: () => new THREE.MeshStandardMaterial({ color: '#30353b', roughness: 0.82, metalness: 0.1 }),
  duct: () => new THREE.MeshStandardMaterial({ color: '#7f878f', roughness: 0.6, metalness: 0.35 }),
  line: () => new THREE.LineBasicMaterial({ color: '#5d666f', transparent: true, opacity: 0.55 }),
};

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
  const ink = 'rgba(196,203,210,0.62)';
  ctx.textBaseline = 'middle';
  switch (key) {
    case 'decal-wordmark':
      drawEmblem(ctx, 8, h * 0.08, h * 0.84, ink);
      ctx.fillStyle = ink;
      ctx.font = `${Math.round(h * 0.42)}px ${FONT_DISPLAY}`;
      ctx.fillText('CORVANE', h * 1.0, h * 0.48);
      break;
    case 'decal-reg':
      ctx.fillStyle = 'rgba(196,203,210,0.5)';
      ctx.font = `500 ${Math.round(h * 0.5)}px ${FONT_MONO}`;
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
      ctx.fillStyle = 'rgba(178,92,72,0.6)';
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
  return m;
}

export const ACCENT = new THREE.Color('#5fa9b8');
