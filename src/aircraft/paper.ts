import * as THREE from 'three';
import { NOSE_X, TAIL_X, HALF_SPAN } from './geometry/airframe';

/**
 * Materials and props for the white-sheet looks.
 *  sheet: a pencil-shaded technical illustration (pale surfaces, dark feature edges, structure showing through)
 *  flow:  an illustrative aerodynamic surface field (a nose-to-tail colour ramp with flow arrows). It is a
 *         picture of the idea, not a computation: no CFD or pressure data exists for this concept.
 */

export const PAPER_BG = '#f5f5f2';

/** Pale, matte surface used for every solid part on the sheet. */
export function paperMaterial(tone: 'skin' | 'hardware' | 'glass') {
  const color = tone === 'glass' ? '#cfd6da' : tone === 'hardware' ? '#d9d9d6' : '#eceeea';
  return new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1.5, polygonOffsetUnits: 2 });
}

/**
 * Surface-field material: colour from the part's position along the aircraft (red at the nose through
 * yellow and green to blue at the tail and tips), with ordinary shading on top so the shape still reads.
 */
export function flowMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85, metalness: 0, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1.5, polygonOffsetUnits: 2 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uNose = { value: NOSE_X };
    sh.uniforms.uTail = { value: TAIL_X };
    sh.uniforms.uSpan = { value: HALF_SPAN };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vNfPos;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvNfPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vNfPos;
uniform float uNose; uniform float uTail; uniform float uSpan;
vec3 nfRamp(float t) {
  // red → orange → yellow → green → cyan → blue
  vec3 c0 = vec3(0.86, 0.24, 0.10); vec3 c1 = vec3(0.98, 0.62, 0.12); vec3 c2 = vec3(0.98, 0.90, 0.25);
  vec3 c3 = vec3(0.30, 0.78, 0.42); vec3 c4 = vec3(0.16, 0.72, 0.86); vec3 c5 = vec3(0.16, 0.36, 0.86);
  t = clamp(t, 0.0, 1.0) * 5.0;
  if (t < 1.0) return mix(c0, c1, t);
  if (t < 2.0) return mix(c1, c2, t - 1.0);
  if (t < 3.0) return mix(c2, c3, t - 2.0);
  if (t < 4.0) return mix(c3, c4, t - 3.0);
  return mix(c4, c5, t - 4.0);
}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
{
  float along = (uNose - vNfPos.x) / (uNose - uTail);          // 0 at the nose, 1 at the tail
  float outboard = abs(vNfPos.z) / uSpan;                       // 0 on the centreline, 1 at the tip
  float t = clamp(along * 0.72 + outboard * 0.42, 0.0, 1.0);
  diffuseColor.rgb = nfRamp(t);
}`,
      );
  };
  m.customProgramCacheKey = () => 'nf-flow';
  return m;
}

/** Edge line colours on the sheet. */
export const SHEET_LINES = { shell: '#2c2d2e', internal: '#7b7d80', dim: '#c8c9c6', sel: '#0b6f85', hov: '#555' };

/**
 * Hand-drawn style flow arrows around the aircraft, all pointing aft (the direction the air moves over
 * the airframe). Positions come from a fixed pseudo-random sequence so the picture is stable.
 */
export function buildFlowArrows(): { geometry: THREE.BufferGeometry; count: number } {
  const v: number[] = [];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const arrow = (x: number, y: number, z: number, len: number) => {
    const x1 = x - len;
    // a slightly bowed shaft (two segments) and an open head
    const my = y + (rnd() - 0.5) * 0.12;
    v.push(x, y, z, (x + x1) / 2, my, z, (x + x1) / 2, my, z, x1, y, z);
    const h = 0.22 + len * 0.06;
    v.push(x1, y, z, x1 + h, y + h * 0.55, z, x1, y, z, x1 + h, y - h * 0.3, z + h * 0.35);
  };
  let n = 0;
  for (let i = 0; i < 46; i++) {
    const z = (rnd() * 2 - 1) * (HALF_SPAN + 3.5);
    const x = TAIL_X - 2 + rnd() * (NOSE_X - TAIL_X + 7);
    const y = 0.6 + rnd() * 2.6 - (Math.abs(z) > HALF_SPAN ? 0.4 : 0);
    arrow(x, y, z, 1.2 + rnd() * 1.6);
    n++;
  }
  for (let i = 0; i < 10; i++) {
    const z = (rnd() * 2 - 1) * (HALF_SPAN + 2);
    const x = TAIL_X - 1 + rnd() * (NOSE_X - TAIL_X + 5);
    arrow(x, -1.3 - rnd() * 0.8, z, 1.2 + rnd() * 1.2);
    n++;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  return { geometry: g, count: n };
}
