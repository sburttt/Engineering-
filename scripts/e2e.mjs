/**
 * End-to-end check of the running app in headless Chromium (Playwright).
 *   npm run dev            (in another terminal)
 *   npm run test:e2e -- http://127.0.0.1:5173/  [screenshot-dir]
 * Uses the globally installed Playwright if the project does not depend on it.
 */
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require('playwright');
} catch {
  playwright = require(execSync('npm root -g').toString().trim() + '/playwright');
}

// `?render=low` keeps software-GL runs fast; pass a URL without it to test full quality.
const URL = process.argv[2] || 'http://127.0.0.1:5173/?render=low';
const OUT = process.argv[3] || 'e2e-shots';
fs.mkdirSync(OUT, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

const browser = await playwright.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
async function newPage(viewport) {
  const page = await browser.newPage({ viewport });
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  return page;
}
const state = (page) => page.evaluate(() => {
  const s = window.__nightfall.store.getState();
  return { tab: s.tab, mode: s.mode, pitch: s.pitch, selectedId: s.selectedId, focusId: s.focusId, isolate: s.isolate, cutaway: s.cutaway, explode: s.explode, payloadId: s.payloadId, preset: s.preset, bayOpen: s.bayOpen, renderStatus: s.renderStatus };
});
/** Click on triangles of a component's real geometry (projected to screen) until the expected selection happens. */
async function pickComponent(page, id, ok) {
  const pts = await page.evaluate((id) => {
    const nf = window.__nightfall;
    const set = nf.registry.get(id);
    const out = [];
    if (!set) return out;
    const rect = document.querySelector('.viewport canvas').getBoundingClientRect();
    for (const o of set) {
      const g = o.geometry;
      if (!g || o.isInstancedMesh) continue;
      const pos = g.attributes.position;
      const idx = g.index;
      const tris = idx ? idx.count / 3 : pos.count / 3;
      o.updateWorldMatrix(true, false);
      // bounding-box centre first, then triangle centroids
      g.computeBoundingBox();
      const c = g.boundingBox.getCenter(g.boundingBox.min.clone()).applyMatrix4(o.matrixWorld).project(nf.camera);
      if (Math.abs(c.x) < 0.95 && Math.abs(c.y) < 0.95 && c.z < 1) {
        const sx = rect.left + ((c.x + 1) / 2) * rect.width;
        const sy = rect.top + ((1 - c.y) / 2) * rect.height;
        if (document.elementFromPoint(sx, sy)?.tagName === 'CANVAS') out.unshift([sx, sy]);
      }
      for (let k = 0; k < 16; k++) {
        const t = Math.floor(((k + 0.5) / 16) * tris);
        const v = o.position.clone().set(0, 0, 0);
        for (let j = 0; j < 3; j++) {
          const i = idx ? idx.getX(t * 3 + j) : t * 3 + j;
          v.x += pos.getX(i) / 3;
          v.y += pos.getY(i) / 3;
          v.z += pos.getZ(i) / 3;
        }
        v.applyMatrix4(o.matrixWorld).project(nf.camera);
        if (Math.abs(v.x) < 0.95 && Math.abs(v.y) < 0.95 && v.z < 1) {
          const sx = rect.left + ((v.x + 1) / 2) * rect.width;
          const sy = rect.top + ((1 - v.y) / 2) * rect.height;
          // skip points covered by interface panels
          if (document.elementFromPoint(sx, sy)?.tagName === 'CANVAS') out.push([sx, sy]);
        }
      }
    }
    return out;
  }, id);
  for (const [x, y] of pts) {
    await page.mouse.click(x, y);
    await page.waitForTimeout(150);
    const sel = (await state(page)).selectedId;
    if (ok(sel)) return sel;
  }
  return (await state(page)).selectedId;
}
const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png` });

/** Projected screen rectangle of the whole aircraft (meshes only), relative to the canvas. */
const aircraftRect = (page) =>
  page.evaluate(() => {
    const nf = window.__nightfall;
    const c = document.querySelector('.viewport canvas').getBoundingClientRect();
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const v = nf.camera.position.clone();
    for (const [id, set] of nf.registry) {
      if (id.startsWith('payload-')) continue;
      for (const o of set) {
        if (!o.geometry || !o.parent.visible) continue;
        o.updateWorldMatrix(true, false);
        o.geometry.computeBoundingBox();
        const b = o.geometry.boundingBox;
        for (let k = 0; k < 8; k++) {
          v.set(k & 1 ? b.max.x : b.min.x, k & 2 ? b.max.y : b.min.y, k & 4 ? b.max.z : b.min.z).applyMatrix4(o.matrixWorld).project(nf.camera);
          const sx = ((v.x + 1) / 2) * c.width;
          const sy = ((1 - v.y) / 2) * c.height;
          x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
        }
      }
    }
    return { x0, y0, x1, y1, w: c.width, h: c.height };
  });
const camState = (page) =>
  page.evaluate(() => {
    const { camera, controls } = window.__nightfall;
    return { p: camera.position.toArray(), t: controls.target.toArray(), d: camera.position.distanceTo(controls.target) };
  });
const settle = (page, ms = 1800) => page.waitForTimeout(ms);
const presetBtn = (page, label) => page.locator('.presets').getByRole('button', { name: label, exact: true });

/* ---------------- Desktop ---------------- */
const page = await newPage({ width: 1440, height: 900 });
await page.goto(URL);
await page.waitForFunction(() => window.__nightfall?.store?.getState().renderStatus === 'ready', null, { timeout: 60000 });
await settle(page, 3000);
await shot(page, '01-hero');
let st = await state(page);
check('Opens directly on the aircraft viewer (Hero preset)', st.tab === 'aircraft' && st.preset === 'hero');
check('Model is built from many named parts', (await page.evaluate(() => window.__nightfall.parts)) > 100);
check('Opening caption shows the NIGHTFALL designation', (await page.locator('.caption-wrap.on .nf-title').count()) === 1);
check('CORVANE logo is in the header', (await page.locator('.hdr .brand svg[aria-label="Corvane emblem"]').count()) === 1);
let r = await aircraftRect(page);
check('Hero frame: aircraft uncropped and dominant', r.x0 > 0 && r.y0 > 0 && r.x1 < r.w && r.y1 < r.h && (r.x1 - r.x0) / r.w > 0.45, `spans ${Math.round(r.x0)}–${Math.round(r.x1)} of ${r.w}px`);

// Presets: direction and framing
const DIRS = { Front: [1, 0, 0], Side: [0, 0, 1], Top: [0, 1, 0], Rear: [-1, 0, 0], Under: [0, -1, 0], Hero: [0.67, 0.27, 0.69] };
for (const label of ['Front', 'Side', 'Top', 'Rear', 'Under', 'Hero']) {
  await presetBtn(page, label).click();
  await settle(page, 2200);
  await shot(page, `02-preset-${label.toLowerCase()}`);
  const c = await camState(page);
  const d = c.p.map((v, i) => v - c.t[i]);
  const len = Math.hypot(...d);
  const want = DIRS[label];
  const wl = Math.hypot(...want);
  const dot = d.reduce((a, v, i) => a + (v / len) * (want[i] / wl), 0);
  r = await aircraftRect(page);
  const inFrame = r.x0 > -2 && r.y0 > -2 && r.x1 < r.w + 2 && r.y1 < r.h + 2;
  check(`Preset ${label}: correct direction and whole aircraft in frame`, dot > 0.97 && inFrame, `dot ${dot.toFixed(3)}, x ${Math.round(r.x0)}–${Math.round(r.x1)}, y ${Math.round(r.y0)}–${Math.round(r.y1)}`);
}
check('Preset state follows the selected view', (await state(page)).preset === 'hero');

// Orbit with mouse drag
const vp = await page.locator('.viewport canvas').boundingBox();
const cx = vp.x + vp.width / 2;
const cy = vp.y + vp.height / 2;
const before = await camState(page);
await page.mouse.move(cx + 250, cy - 200);
await page.mouse.down();
await page.mouse.move(cx + 80, cy - 160, { steps: 12 });
await page.mouse.up();
await settle(page, 900);
st = await state(page);
const afterOrbit = await camState(page);
check('Drag orbits the camera without selecting', st.selectedId === null && Math.hypot(...afterOrbit.p.map((v, i) => v - before.p[i])) > 1, `moved ${Math.hypot(...afterOrbit.p.map((v, i) => v - before.p[i])).toFixed(2)} m`);
check('Exploring hides the opening caption (free orbit)', st.preset === null && (await page.locator('.caption-wrap.on').count()) === 0);

// Zoom: wheel, limits, never inside the airframe
await page.mouse.move(cx, cy);
const d0 = (await camState(page)).d;
await page.mouse.wheel(0, -500);
await settle(page, 700);
const d1 = (await camState(page)).d;
check('Wheel zooms toward the aircraft centre', d1 < d0 - 0.5, `${d0.toFixed(1)} → ${d1.toFixed(1)} m`);
for (let i = 0; i < 25; i++) await page.mouse.wheel(0, -600);
await settle(page, 900);
const inside = await page.evaluate(() => ({ d: window.__nightfall.camera.position.distanceTo(window.__nightfall.controls.target) }));
check('Zoom stops at a minimum distance', inside.d >= 1.15, `${inside.d.toFixed(2)} m`);
await shot(page, '03-zoomed-in');
await settle(page, 1500);
await page.locator('.tools').getByRole('button', { name: 'Reset view' }).click();
await settle(page, 2400);
{
  const s1 = await state(page);
  const c = await camState(page);
  check('Reset view returns to Hero', s1.preset === 'hero' && Math.abs(c.d - before.d) < 1.5, `preset ${s1.preset}, d ${c.d.toFixed(1)} vs ${before.d.toFixed(1)}`);
}

// Clicks select exactly the part under the pointer (incl. near edges)
let agree = 0;
let tested = 0;
for (let gx = 0.12; gx <= 0.88; gx += 0.06)
  for (let gy = 0.25; gy <= 0.75; gy += 0.06) {
    const x = vp.x + vp.width * gx;
    const y = vp.y + vp.height * gy;
    const hit = await page.evaluate(([x, y]) => window.__nightfall.probe(x, y), [x, y]);
    if (!hit || !hit.componentId) continue;
    const covered = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.tagName !== 'CANVAS', [x, y]);
    if (covered) continue;
    await page.mouse.click(x, y);
    await page.waitForTimeout(120);
    const sel = (await state(page)).selectedId;
    const expected = await page.evaluate((id) => window.__nightfall.resolvePick(id), hit.componentId);
    tested++;
    if (sel === expected) agree++;
    await page.keyboard.press('Escape');
  }
check('Clicks select the component under the pointer', tested >= 15 && agree === tested, `${agree}/${tested} sample points`);

// Click-select → panel, no automatic camera jump
const camBeforeSel = await camState(page);
const picked = await pickComponent(page, 'wing-stbd', (id) => id === 'wing-stbd');
check('Clicking the wing geometry selects the wing', picked === 'wing-stbd', picked ?? 'none');
await settle(page, 900);
const title = (await page.locator('.cp-title').innerText()).trim();
check('Information panel names the selected component', title === 'Starboard Outer Wing', title);
check('Panel explains the design role', (await page.locator('.cp-body').innerText()).includes('DESIGN ROLE') || (await page.locator('.cp-body h3').first().innerText()).length > 0);
check('Selecting does not move the camera by itself', Math.hypot(...(await camState(page)).p.map((v, i) => v - camBeforeSel.p[i])) < 0.05);
await shot(page, '04-selected');

// Focus view → sub-component → isolate → back
const camBeforeFocus = await camState(page);
await page.locator('.cp').getByRole('button', { name: 'Focus view' }).click();
await settle(page, 2000);
st = await state(page);
const camFocus = await camState(page);
check('Focus view moves the camera to the component', st.focusId === 'wing-stbd' && camFocus.d < camBeforeFocus.d - 2, `${camBeforeFocus.d.toFixed(1)} → ${camFocus.d.toFixed(1)} m`);
const wingStillSolid = await page.evaluate(() => [...window.__nightfall.registry.get('ctr-body')].every((o) => o.material.opacity === 1 && o.parent.visible));
check('Focus keeps the rest of the aircraft visible (no ghosting)', wingStillSolid);
await shot(page, '05-focus');
const sub = await pickComponent(page, 'elevon-stbd-out', (id) => id === 'elevon-stbd-out');
check('Sub-components are pickable in focus', sub === 'elevon-stbd-out', sub ?? 'none');
await page.locator('.focus-bar').getByRole('button', { name: 'Isolate' }).click();
await settle(page, 900);
const ctrHidden = await page.evaluate(() => [...window.__nightfall.registry.get('ctr-body')].every((o) => !o.parent.visible));
check('Isolate hides everything else', (await state(page)).isolate && ctrHidden);
await shot(page, '06-isolated');
await page.locator('.focus-bar').getByRole('button', { name: 'Back to aircraft' }).click();
await settle(page, 2000);
st = await state(page);
const camBack = await camState(page);
check('Back to aircraft restores the previous camera', st.focusId === null && !st.isolate && Math.hypot(...camBack.p.map((v, i) => v - camBeforeFocus.p[i])) < 0.3);
await page.keyboard.press('Escape');
check('Esc clears the selection', (await state(page)).selectedId === null);

// Component index
await page.locator('.tools').getByRole('button', { name: /Components/ }).click();
await page.locator('.index-panel').getByRole('button', { name: /Nose Landing Gear/ }).click();
await settle(page, 2000);
check('Component index selects and locates a part', (await state(page)).selectedId === 'gear-nose');
await shot(page, '07-index-gear');
await page.locator('.index-panel').getByRole('button', { name: 'Close component index' }).click();
await page.keyboard.press('Escape');

// Modes
await page.locator('.mode-index').getByRole('button', { name: /Cutaway/ }).click();
await settle(page, 2000);
check('Cutaway mode clips the shell', (await state(page)).cutaway === 'partial');
await shot(page, '08-cutaway');
const cutHit = await pickComponent(page, 'power', (id) => id === 'power');
check('Cutaway: clicks reach modules behind the removed skin', cutHit === 'power', cutHit ?? 'none');
await page.keyboard.press('Escape');
await page.locator('.mode-index').getByRole('button', { name: /Systems/ }).click();
await settle(page, 2000);
check('Systems mode ghosts the shell', (await state(page)).cutaway === 'internal');
const navHit = await pickComponent(page, 'nav', (id) => id === 'nav');
check('Systems: internal modules are selectable in 3D', navHit === 'nav', navHit ?? 'none');
await page.keyboard.press('Escape');
await page.locator('.tools-toggle').click();
await page.locator('#explode').fill('1');
await settle(page, 2200);
await shot(page, '09-exploded');
const moved = await page.evaluate(() => [...window.__nightfall.registry.get('wing-stbd')][0].parent.position.z);
check('Exploded view separates assemblies', moved > 1, `wing offset ${moved.toFixed(2)} m`);
await page.locator('.mode-index').getByRole('button', { name: /Exterior/ }).click();
await settle(page, 2200);
const back = await page.evaluate(() => [...window.__nightfall.registry.get('wing-stbd')][0].parent.position.length());
check('Leaving systems re-assembles the aircraft', back < 0.02 && (await state(page)).cutaway === 'exterior', `residual ${back.toFixed(3)} m`);
if ((await page.locator('.pop').count()) === 0) await page.locator('.tools-toggle').click();
await page.locator('#pitch').fill('20');
await page.locator('#roll').fill('12');
await settle(page, 1200);
const rot = await page.evaluate(() => [...window.__nightfall.registry.get('elevon-stbd-out')][0].parent.quaternion.w);
check('Elevon controls move the elevons', rot < 0.999, `quaternion w=${rot.toFixed(4)}`);
await page.locator('.pop').getByRole('button', { name: /Reset viewer/ }).click();
await settle(page, 1500);
st = await state(page);
check('Reset viewer restores the opening state', st.preset === 'hero' && st.pitch === 0 && st.mode === 'exterior' && st.selectedId === null, JSON.stringify({ p: st.preset, m: st.mode, s: st.selectedId }));

await page.locator('.mode-index').getByRole('button', { name: /Payload/ }).click();
await settle(page, 2600);
st = await state(page);
check('Payload mode opens the bay with the fitted module', st.bayOpen && st.selectedId === 'payload-map');
await shot(page, '10-payload');
await page.locator('.cp-list').getByRole('button', { name: /Scientific Research Rack/ }).click();
await settle(page, 800);
const sciVisible = await page.evaluate(() => [...window.__nightfall.registry.get('payload-sci')].every((o) => o.parent.visible));
const mapHidden = await page.evaluate(() => [...window.__nightfall.registry.get('payload-map')].every((o) => !o.parent.visible));
check('Swapping the mission module changes the model', (await state(page)).payloadId === 'payload-sci' && sciVisible && mapHidden);
await page.keyboard.press('Escape');
await page.locator('.mode-index').getByRole('button', { name: /Exterior/ }).click();
await settle(page, 1500);

// Full-screen inspection
await page.locator('.hdr').getByRole('button', { name: /Inspect/ }).click();
await settle(page, 1200);
const imm = await page.evaluate(() => {
  const c = document.querySelector('.viewport canvas').getBoundingClientRect();
  return { on: document.querySelector('.app').classList.contains('is-immersive'), w: c.width, h: c.height, hdr: getComputedStyle(document.querySelector('.hdr')).visibility };
});
check('Inspection mode: canvas fills the window, header hidden', imm.on && imm.w >= 1438 && imm.h >= 898 && imm.hdr === 'hidden', `${imm.w}×${imm.h}`);
check('Inspection mode keeps presets and the Corvane mark', (await page.locator('.presets').isVisible()) && (await page.locator('.imm-brand').isVisible()));
await shot(page, '11-inspection');
await presetBtn(page, 'Side').click();
await settle(page, 2000);
check('Presets work in inspection mode', (await state(page)).preset === 'side');
await page.keyboard.press('Escape');
await settle(page, 600);
check('Esc leaves inspection mode', !(await page.evaluate(() => document.querySelector('.app').classList.contains('is-immersive'))));

// Resize
await page.setViewportSize({ width: 1024, height: 700 });
await settle(page, 1200);
const rs = await page.evaluate(() => document.querySelector('.viewport canvas').getBoundingClientRect().width);
check('Canvas follows window resizing', Math.abs(rs - 1024) < 2, `${rs}px`);
await page.setViewportSize({ width: 1440, height: 900 });
await settle(page, 600);

// Technical overview
await page.locator('.hdr').getByRole('link', { name: 'Overview' }).click();
await settle(page, 800);
await shot(page, '12-overview');
const bounds = await page.evaluate(() => {
  const reg = window.__nightfall.registry;
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const [id, set] of reg)
    for (const o of set) {
      if (!o.geometry || id.startsWith('payload-')) continue;
      o.updateWorldMatrix(true, false);
      o.geometry.computeBoundingBox();
      const b = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
      ['x', 'y', 'z'].forEach((k, i) => {
        min[i] = Math.min(min[i], b.min[k]);
        max[i] = Math.max(max[i], b.max[k]);
      });
    }
  return { L: max[0] - min[0], H: max[1] - min[1], B: max[2] - min[2] };
});
const dims = (await page.locator('.kv.big dd').allInnerTexts()).map((t) => parseFloat(t.replace('≈', '')));
check('Overview length matches the model (±2 %)', Math.abs(bounds.L - dims[0]) / dims[0] < 0.02, `model ${bounds.L.toFixed(2)} vs ${dims[0]}`);
check('Overview span matches the model (±2 %)', Math.abs(bounds.B - dims[1]) / dims[1] < 0.02, `model ${bounds.B.toFixed(2)} vs ${dims[1]}`);
check('Overview height matches the model (±5 %)', Math.abs(bounds.H - dims[2]) / dims[2] < 0.05, `model ${bounds.H.toFixed(2)} vs ${dims[2]}`);
const na = await page.locator('ul.na li').allInnerTexts();
check('Performance figures are marked not established, none invented', na.length >= 6 && na.every((t) => /—\s*$/.test(t.trim())));
await page.locator('ol.features li').filter({ hasText: 'Dorsal propulsion fairing' }).getByRole('button', { name: /Show in 3D/ }).click();
await settle(page, 2200);
st = await state(page);
check('“Show in 3D” opens the viewer on that part', st.tab === 'aircraft' && st.selectedId === 'fairing');
await shot(page, '13-show-in-3d');

// Autonomy
await page.locator('.hdr').getByRole('link', { name: 'Autonomy' }).click();
await settle(page, 800);
await page.locator('.arch .node').nth(3).click();
await page.getByRole('button', { name: /Simulated mission abort/ }).click();
await page.waitForTimeout(3200);
await shot(page, '14-autonomy');
const authVisible = await page.getByRole('button', { name: 'Authorise abort' }).isVisible();
check('Abort scenario asks for human authorisation', authVisible);
if (authVisible) await page.getByRole('button', { name: 'Authorise abort' }).click();
await page.waitForTimeout(500);
check('Authorisation is written to the audit log', /terminated safely/.test(await page.locator('.log').innerText()));

// Specification
await page.locator('.hdr').getByRole('link', { name: 'Specification' }).click();
await page.waitForTimeout(600);
await shot(page, '15-specs');
await page.locator('.spec-tabs').getByRole('tab', { name: 'Propulsion' }).click();
check('Specification tabs filter categories', (await page.locator('.doc table').count()) === 1);
check('Three-view drawings render', (await page.locator('svg.drawing').count()) === 3);

// Research
await page.locator('.hdr').getByRole('link', { name: 'Research' }).click();
await page.waitForTimeout(400);
const all = await page.locator('.research-card').count();
await page.locator('.filters').getByRole('button', { name: 'Stealth bomber' }).click();
const bombers = await page.locator('.research-card').count();
check('Research filter narrows entries', all > bombers && bombers === 2, `${all} → ${bombers}`);
await page.locator('#research-q').fill('zzzz-no-match');
check('Empty research result handled', (await page.getByText('No references match these filters.').count()) === 1);
await page.getByRole('button', { name: 'Clear filters' }).click();
const links = await page.locator('.research-card .sources a').evaluateAll((as) => as.map((a) => a.href));
check('Every research card has https source links', links.length >= 20 && links.every((h) => h.startsWith('https://')), `${links.length} links`);
await shot(page, '16-research');
await page.close();

/* ---------------- Phone (touch) ---------------- */
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
const m = await ctx.newPage();
m.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()));
m.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
await m.goto(URL);
await m.waitForFunction(() => window.__nightfall?.store?.getState().renderStatus === 'ready', null, { timeout: 60000 });
await settle(m, 2500);
await shot(m, '30-phone-hero');
check('Phone: no horizontal page scroll', !(await m.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)));
r = await aircraftRect(m);
check('Phone: whole aircraft visible above the caption', r.x0 > -2 && r.x1 < r.w + 2 && r.y0 > 0, `x ${Math.round(r.x0)}–${Math.round(r.x1)} of ${r.w}`);
check('Phone: brand and NIGHTFALL visible', (await m.locator('.hdr .brand').isVisible()) && (await m.locator('.nf-title').isVisible()));
const cdp = await ctx.newCDPSession(m);
const box = await m.locator('.viewport canvas').boundingBox();
const tx = box.x + box.width / 2;
const ty = box.y + box.height * 0.35;
const c0 = await camState(m);
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: tx, y: ty }] });
for (let i = 1; i <= 10; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: tx + i * 12, y: ty }] });
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await settle(m, 900);
const c1 = await camState(m);
check('Phone: one-finger drag orbits', Math.hypot(...c1.p.map((v, i) => v - c0.p[i])) > 1);
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: tx - 30, y: ty, id: 1 }, { x: tx + 30, y: ty, id: 2 }] });
for (let i = 1; i <= 10; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: tx - 30 - i * 9, y: ty, id: 1 }, { x: tx + 30 + i * 9, y: ty, id: 2 }] });
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await settle(m, 900);
const c2 = await camState(m);
check('Phone: pinch zooms in', c2.d < c1.d - 0.5, `${c1.d.toFixed(1)} → ${c2.d.toFixed(1)} m`);
await m.locator('.presets').getByRole('button', { name: 'Hero', exact: true }).tap();
await settle(m, 2000);
const mp = await pickComponent(m, 'ctr-body', (id) => !!id);
check('Phone: tapping the model selects a part', !!mp, mp ?? 'none');
await settle(m, 900);
check('Phone: selection opens the bottom sheet', (await m.locator('.cp-wrap.open .cp-title').count()) === 1);
await shot(m, '31-phone-selected');
await m.locator('.cp').getByRole('button', { name: 'Clear selection' }).tap();
await m.locator('.menu-btn').tap();
check('Phone: menu shows all sections', (await m.locator('.hdr-nav.open .hdr-link').count()) === 5);
await shot(m, '32-phone-menu');
await m.locator('.hdr-nav').getByRole('link', { name: 'Overview' }).tap();
await settle(m, 800);
check('Phone: overview readable without horizontal scroll', !(await m.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)));
await shot(m, '33-phone-overview');
await ctx.close();

const t = await newPage({ width: 820, height: 1180 });
await t.goto(URL);
await t.waitForFunction(() => window.__nightfall?.store?.getState().renderStatus === 'ready', null, { timeout: 60000 });
await settle(t, 2500);
await shot(t, '35-tablet');
r = await aircraftRect(t);
check('Tablet: aircraft uncropped', r.x0 > -2 && r.x1 < r.w + 2 && r.y0 > 0 && r.y1 < r.h, `x ${Math.round(r.x0)}–${Math.round(r.x1)}`);
await t.close();

const relevant = errors.filter((e) => !/GPU stall|ReadPixels|WebGL-|swiftshader|Automatic fallback/i.test(e));
check('No console errors', relevant.length === 0, relevant.slice(0, 5).join(' | '));

await browser.close();

/* ---------------- WebGL unavailable ---------------- */
const noGl = await playwright.chromium.launch({ args: ['--disable-3d-apis', '--disable-webgl', '--disable-gpu'] });
const ng = await noGl.newPage({ viewport: { width: 1280, height: 800 } });
const ngErrors = [];
ng.on('pageerror', (e) => ngErrors.push(e.message));
await ng.goto(URL);
await ng.waitForTimeout(2500);
check('WebGL missing: helpful fallback is shown', (await ng.getByText('WebGL could not start').count()) === 1);
await ng.screenshot({ path: `${OUT}/40-no-webgl.png` });
await ng.locator('.hdr').getByRole('link', { name: 'Specification' }).click();
check('WebGL missing: other sections still work', (await ng.locator('.doc svg.drawing').count()) >= 3 && ngErrors.length === 0, ngErrors.join(' | '));
await noGl.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
process.exit(failed.length ? 1 : 0);
