import * as THREE from 'three';

export type P3 = [number, number, number];

/**
 * Build an indexed grid surface from a parametric function.
 * `want` is the outward direction the surface should face on average; winding is
 * flipped automatically if the computed normals point the other way.
 */
export function gridSurface(
  nu: number,
  nv: number,
  fn: (u: number, v: number) => P3,
  want?: THREE.Vector3 | ((p: THREE.Vector3) => THREE.Vector3),
): THREE.BufferGeometry {
  const pos = new Float32Array((nu + 1) * (nv + 1) * 3);
  const uvs = new Float32Array((nu + 1) * (nv + 1) * 2);
  let k = 0;
  for (let i = 0; i <= nu; i++) {
    for (let j = 0; j <= nv; j++) {
      const [x, y, z] = fn(i / nu, j / nv);
      pos[k * 3] = x;
      pos[k * 3 + 1] = y;
      pos[k * 3 + 2] = z;
      uvs[k * 2] = i / nu;
      uvs[k * 2 + 1] = j / nv;
      k++;
    }
  }
  const idx: number[] = [];
  const row = nv + 1;
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) {
      const a = i * row + j;
      const b = (i + 1) * row + j;
      const c = (i + 1) * row + j + 1;
      const d = i * row + j + 1;
      idx.push(a, b, d, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  if (want) orient(g, want);
  return g;
}

/** Flip triangle winding if the average normal disagrees with the wanted direction. */
export function orient(g: THREE.BufferGeometry, want: THREE.Vector3 | ((p: THREE.Vector3) => THREE.Vector3)) {
  const n = g.getAttribute('normal') as THREE.BufferAttribute;
  const p = g.getAttribute('position') as THREE.BufferAttribute;
  let dot = 0;
  const vp = new THREE.Vector3();
  const vn = new THREE.Vector3();
  for (let i = 0; i < n.count; i += 3) {
    vp.fromBufferAttribute(p, i);
    vn.fromBufferAttribute(n, i);
    const w = typeof want === 'function' ? want(vp) : want;
    dot += vn.dot(w);
  }
  if (dot < 0) {
    const index = g.getIndex()!;
    const arr = index.array as Uint32Array | Uint16Array;
    for (let i = 0; i < arr.length; i += 3) {
      const t = arr[i + 1];
      arr[i + 1] = arr[i + 2];
      arr[i + 2] = t;
    }
    index.needsUpdate = true;
    g.computeVertexNormals();
  }
}

/** Cosine clustering toward both ends of [0,1]. */
export const cos01 = (t: number) => (1 - Math.cos(Math.PI * t)) / 2;
/** Map [0,1] → [-1,1] with clustering near ±1 (sharp chine edges). */
export const edgeCluster = (t: number) => Math.sin((t * 2 - 1) * (Math.PI / 2));

/**
 * Closed ring (flat frame / bulkhead) between an outer and inner loop sampled by angle,
 * extruded along X by `depth`.
 */
export function ringX(
  x: number,
  depth: number,
  n: number,
  outer: (th: number) => [number, number],
  inner: (th: number) => [number, number],
): THREE.BufferGeometry {
  const verts: number[] = [];
  const idx: number[] = [];
  const loops: [number, number][][] = [[], []];
  for (let k = 0; k < n; k++) {
    const th = (k / n) * Math.PI * 2;
    loops[0].push(outer(th));
    loops[1].push(inner(th));
  }
  // 4 vertex rings: outer-front, inner-front, outer-back, inner-back  (pos: y, z)
  const rings = [
    [loops[0], x],
    [loops[1], x],
    [loops[0], x - depth],
    [loops[1], x - depth],
  ] as const;
  for (const [loop, xx] of rings) for (const [z, y] of loop) verts.push(xx, y, z);
  const R = (r: number, k: number) => r * n + (k % n);
  const quad = (a: number, b: number, c: number, d: number) => idx.push(a, b, d, b, c, d);
  for (let k = 0; k < n; k++) {
    quad(R(0, k), R(0, k + 1), R(1, k + 1), R(1, k)); // front face
    quad(R(2, k), R(3, k), R(3, k + 1), R(2, k + 1)); // back face
    quad(R(0, k), R(2, k), R(2, k + 1), R(0, k + 1)); // outer wall
    quad(R(1, k), R(1, k + 1), R(3, k + 1), R(3, k)); // inner wall
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Flat ring face (no depth) – used for the exhaust base plate. */
export function ringFace(n: number, outer: (th: number) => P3, inner: (th: number) => P3, want: THREE.Vector3) {
  return gridSurface(n, 1, (u, v) => {
    const th = u * Math.PI * 2;
    const a = outer(th);
    const b = inner(th);
    return [a[0] + (b[0] - a[0]) * v, a[1] + (b[1] - a[1]) * v, a[2] + (b[2] - a[2]) * v];
  }, want);
}

/**
 * Loft an elliptical (super-elliptical) tube along a path.
 * a(t): half-width in Z, b(t): half-height in Y, e(t): superellipse exponent (2 = ellipse).
 */
export function loftTube(
  path: (t: number) => THREE.Vector3,
  a: (t: number) => number,
  b: (t: number) => number,
  e: (t: number) => number = () => 2,
  nt = 40,
  nr = 32,
): THREE.BufferGeometry {
  return gridSurface(nt, nr, (u, v) => {
    const c = path(u);
    const th = v * Math.PI * 2;
    const ex = 2 / e(u);
    const cz = Math.cos(th);
    const sy = Math.sin(th);
    const z = Math.sign(cz) * Math.pow(Math.abs(cz), ex) * a(u);
    const y = Math.sign(sy) * Math.pow(Math.abs(sy), ex) * b(u);
    return [c.x, c.y + y, c.z + z];
  }, (p) => {
    // outward from path centre: approximate using nearest x
    return new THREE.Vector3(0, p.y, p.z).normalize();
  });
}

/** Thin quad strip between two polylines (spars, ribs, doors). Double-sided material expected. */
export function stripBetween(a: P3[], b: P3[]): THREE.BufferGeometry {
  const verts: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i < a.length; i++) verts.push(...a[i], ...b[i]);
  for (let i = 0; i < a.length - 1; i++) {
    const p0 = i * 2;
    idx.push(p0, p0 + 2, p0 + 1, p0 + 1, p0 + 2, p0 + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Thickened strip: extrudes a strip by `t` along a fixed direction to read as a plate. */
export function plateBetween(a: P3[], b: P3[], t: number, dir: THREE.Vector3): THREE.BufferGeometry {
  const off = (p: P3): P3 => [p[0] + dir.x * t, p[1] + dir.y * t, p[2] + dir.z * t];
  const geos = [stripBetween(a, b), stripBetween(a.map(off), b.map(off))];
  // edges
  geos.push(stripBetween(a, a.map(off)), stripBetween(b, b.map(off)));
  return mergeGeos(geos);
}

/** Polyline points → LineSegments geometry. */
export function linesGeometry(polylines: P3[][]): THREE.BufferGeometry {
  const v: number[] = [];
  for (const pl of polylines) for (let i = 0; i < pl.length - 1; i++) v.push(...pl[i], ...pl[i + 1]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  return g;
}

/** Minimal merge for non-indexed + indexed geometries with position/normal only. */
export function mergeGeos(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const pos: number[] = [];
  const nor: number[] = [];
  const idx: number[] = [];
  let base = 0;
  for (const g0 of list) {
    const g = g0.getAttribute('normal') ? g0 : (g0.computeVertexNormals(), g0);
    const p = g.getAttribute('position');
    const n = g.getAttribute('normal');
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
      nor.push(n.getX(i), n.getY(i), n.getZ(i));
    }
    const ix = g.getIndex();
    if (ix) for (let i = 0; i < ix.count; i++) idx.push(ix.getX(i) + base);
    else for (let i = 0; i < p.count; i++) idx.push(i + base);
    base += p.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setIndex(idx);
  return out;
}

/** A transformed primitive, baked into world coordinates (for merging small hardware). */
export function baked(g: THREE.BufferGeometry, pos: P3, rot: P3 = [0, 0, 0], scale: P3 = [1, 1, 1]) {
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(...pos),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)),
    new THREE.Vector3(...scale),
  );
  const c = g.clone();
  c.applyMatrix4(m);
  return c;
}

/** Rounded box helper (bevelled look on small equipment). */
export function rbox(w: number, h: number, d: number, r = 0.02): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  const rr = Math.min(r, w / 2, h / 2);
  shape.moveTo(x + rr, y);
  shape.lineTo(x + w - rr, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + rr);
  shape.lineTo(x + w, y + h - rr);
  shape.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  shape.lineTo(x + rr, y + h);
  shape.quadraticCurveTo(x, y + h, x, y + h - rr);
  shape.lineTo(x, y + rr);
  shape.quadraticCurveTo(x, y, x + rr, y);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: d - rr * 2,
    bevelEnabled: true,
    bevelThickness: rr,
    bevelSize: rr * 0.6,
    bevelSegments: 2,
    curveSegments: 3,
  });
  g.translate(0, 0, -(d - rr * 2) / 2);
  return g;
}
