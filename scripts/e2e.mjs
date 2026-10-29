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
  return { tab: s.tab, selectedId: s.selectedId, focusId: s.focusId, isolate: s.isolate, cutaway: s.cutaway, explode: s.explode, payloadId: s.payloadId, preset: s.preset, bayOpen: s.bayOpen, renderStatus: s.renderStatus };
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

/* ---------------- Desktop ---------------- */
const page = await newPage({ width: 1280, height: 800 });
await page.goto(URL + '#overview');
await page.waitForFunction(() => window.__nightfall?.store?.getState().renderStatus === 'ready', null, { timeout: 30000 });
await page.waitForTimeout(2500);
await shot(page, '01-overview');
check('App starts and WebGL scene reports ready', (await state(page)).renderStatus === 'ready');
check('Model is built from many named parts', (await page.evaluate(() => window.__nightfall.parts)) > 100);

// Model bounds vs specification sheet
const bounds = await page.evaluate(() => {
  const reg = window.__nightfall.registry;
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const [, set] of reg)
    for (const o of set) {
      if (!o.geometry) continue;
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
const specText = await page.evaluate(() => document.querySelector('.hero-specs')?.innerText ?? '');
const nums = [...specText.matchAll(/([\d.]+) m/g)].map((m) => +m[1]);
check('Model length matches spec (±2 %)', Math.abs(bounds.L - nums[0]) / nums[0] < 0.02, `model ${bounds.L.toFixed(2)} m vs spec ${nums[0]} m`);
check('Model span matches spec (±2 %)', Math.abs(bounds.B - nums[1]) / nums[1] < 0.02, `model ${bounds.B.toFixed(2)} m vs spec ${nums[1]} m`);
check('Model height matches spec (±5 %)', Math.abs(bounds.H - nums[2]) / nums[2] < 0.05, `model ${bounds.H.toFixed(2)} m vs spec ${nums[2]} m`);

await page.getByRole('button', { name: 'Enter 3D viewer' }).click();
await page.waitForTimeout(1600);
check('Enter 3D viewer switches to Exterior tab', (await state(page)).tab === 'exterior');
// the Display panel starts collapsed below 1400 px; open it for the control checks
await page.locator('.tools-toggle').click();
check('Display panel opens', (await page.locator('.vp-tools.open').count()) === 1);
await shot(page, '02-exterior');

// Camera presets
const camPos = () => page.evaluate(() => {
  const c = document.querySelector('canvas');
  return c ? window.__nightfall.cam?.() : null;
});
void camPos;
for (const [label, file] of [['Top', '03-top'], ['Side', '04-side'], ['Bottom', '05-bottom'], ['¾ Rear', '06-rear34'], ['Front', '07-front']]) {
  await page.locator('.vp-presets').getByRole('button', { name: label, exact: true }).click();
  await page.waitForTimeout(1500);
  await shot(page, file);
}
check('Camera preset updates state', (await state(page)).preset === 'front');

// Orbit with mouse drag (should not select anything)
await page.locator('.vp-presets').getByRole('button', { name: '¾ Front', exact: true }).click();
await page.waitForTimeout(1400);
const vp = await page.locator('.viewport canvas').boundingBox();
const cx = vp.x + vp.width / 2;
const cy = vp.y + vp.height / 2;
await page.mouse.move(cx - 200, cy + 150);
await page.mouse.down();
await page.mouse.move(cx - 60, cy + 120, { steps: 10 });
await page.mouse.up();
await page.waitForTimeout(400);
check('Mouse drag orbits without selecting', (await state(page)).selectedId === null && (await state(page)).preset === 'three-quarter-front');
await page.locator('.vp-presets').getByRole('button', { name: '¾ Front', exact: true }).click();
await page.waitForTimeout(1400);

// Zoom with wheel
await page.mouse.move(cx, cy);
await page.mouse.wheel(0, -600);
await page.waitForTimeout(600);
await shot(page, '08-zoomed');
await page.getByRole('button', { name: 'Reset camera' }).click();
await page.waitForTimeout(1400);

// Click-select on the actual geometry (scan the viewport until a hit)
let picked = null;
for (const [dx, dy] of [[0, 0], [40, 20], [-60, 10], [80, -20], [-120, 40], [140, 30], [0, 60], [200, 60]]) {
  await page.mouse.click(cx + dx, cy + dy);
  await page.waitForTimeout(250);
  picked = (await state(page)).selectedId;
  if (picked) break;
}
check('Clicking the model selects a real component', !!picked, picked ?? 'no hit');
await page.waitForTimeout(1300);
const title = await page.locator('.insp .insp-title').innerText();
check('Inspector shows the selected component', title.length > 3 && title !== 'No component selected', title);
await shot(page, '09-selected');

// Wing → enlarge → pick subcomponent via tree
await page.locator('.side').getByRole('button', { name: /Starboard Outer Wing/ }).click();
await page.waitForTimeout(1300);
await page.locator('.insp').getByRole('button', { name: 'Enlarge' }).click();
await page.waitForTimeout(1400);
let st = await state(page);
check('Enlarge enters detail mode for the wing', st.focusId === 'wing-stbd');
await shot(page, '10-wing-detail');
// clicking the elevon geometry inside the enlarged wing selects the elevon itself
const sub = await pickComponent(page, 'elevon-stbd-out', (id) => id === 'elevon-stbd-out');
check('Sub-components are pickable inside detail mode', sub === 'elevon-stbd-out', sub ?? 'none');
await page.waitForTimeout(1200);
await shot(page, '10b-elevon-selected');
await page.locator('.focus-bar').getByRole('button', { name: 'Isolate' }).click();
await page.waitForTimeout(1300);
check('Isolate hides the rest of the aircraft', (await state(page)).isolate === true);
await shot(page, '11-isolated');
await page.locator('.focus-bar').getByRole('button', { name: 'Return to aircraft' }).click();
await page.waitForTimeout(1400);
st = await state(page);
check('Return to aircraft leaves detail mode', st.focusId === null && st.isolate === false);

// Landing gear subparts
await page.locator('.side').getByRole('button', { name: /Nose Landing Gear/ }).click();
await page.waitForTimeout(400);
await page.locator('.insp').getByRole('button', { name: 'Enlarge' }).click();
await page.waitForTimeout(1500);
await shot(page, '12-gear-detail');
await page.locator('.focus-bar').getByRole('button', { name: 'Return to aircraft' }).click();
await page.waitForTimeout(800);

// Cutaway modes
await page.locator('.vp-tools').getByRole('button', { name: 'Partial' }).click();
await page.locator('.vp-presets').getByRole('button', { name: 'Internal', exact: true }).click();
await page.waitForTimeout(1500);
await shot(page, '13-partial');
check('Partial cutaway active', (await state(page)).cutaway === 'partial');
await page.locator('.vp-tools').getByRole('button', { name: 'Internal' }).click();
await page.waitForTimeout(800);
await shot(page, '14-internal');
await page.locator('.side').getByRole('button', { name: /Autonomous Flight-Computing/ }).click();
await page.waitForTimeout(1500);
await shot(page, '15-afcm');
check('Internal module selectable from systems list', (await state(page)).selectedId === 'afcm');
check('AFCM shows architecture diagram', (await page.locator('.insp svg.diagram').count()) === 1);

// Click an internal module in 3D while in internal view
await page.locator('.vp-presets').getByRole('button', { name: 'Internal', exact: true }).click();
await page.waitForTimeout(1500);
const toggleDisplay = () => page.locator('.tools-toggle').click();
await toggleDisplay(); // collapse the Display panel so it does not cover the modules
const internalHit = await pickComponent(page, 'nav', (id) => id === 'nav');
await toggleDisplay();
check('Clicking inside internal view selects an internal module', internalHit === 'nav', internalHit ?? 'none');
// In partial cutaway, clicks pass through the removed shell to the modules behind it
await page.locator('.vp-tools').getByRole('button', { name: 'Partial' }).click();
await page.locator('.vp-presets').getByRole('button', { name: 'Internal', exact: true }).click();
await page.waitForTimeout(1500);
await toggleDisplay();
const cutHit = await pickComponent(page, 'power', (id) => id === 'power');
await toggleDisplay();
check('Partial cutaway: clicks reach modules behind the removed shell', cutHit === 'power', cutHit ?? 'none');

// Exploded view
await page.locator('.vp-tools').getByRole('button', { name: 'Exterior' }).click();
await page.locator('#explode').fill('1');
await page.locator('.vp-presets').getByRole('button', { name: '¾ Front', exact: true }).click();
await page.waitForTimeout(2200);
await shot(page, '16-exploded');
check('Explode slider drives explode state', (await state(page)).explode === 1);
const moved = await page.evaluate(() => {
  const set = window.__nightfall.registry.get('wing-stbd');
  const o = [...set][0];
  return o.parent.position.z;
});
check('Exploded view physically moves components', moved > 1, `starboard wing offset z=${moved.toFixed(2)} m`);
// Repeated toggling
for (let i = 0; i < 8; i++) {
  await page.locator('#explode').fill(i % 2 ? '0' : '0.7');
  await page.locator('.vp-tools').getByRole('button', { name: ['Exterior', 'Partial', 'Internal'][i % 3] }).click();
}
await page.getByRole('button', { name: 'Reset all' }).click();
await page.waitForTimeout(2200);
st = await state(page);
const back = await page.evaluate(() => [...window.__nightfall.registry.get('wing-stbd')][0].parent.position.length());
check('Reset all restores initial viewer state', st.explode === 0 && st.cutaway === 'exterior' && st.selectedId === null && back < 0.02, `residual offset ${back.toFixed(3)} m`);

// Control surfaces
await page.locator('#pitch').fill('20');
await page.locator('#roll').fill('12');
await page.locator('.vp-presets').getByRole('button', { name: '¾ Rear', exact: true }).click();
await page.waitForTimeout(1800);
await shot(page, '17-elevons');
const rot = await page.evaluate(() => [...window.__nightfall.registry.get('elevon-stbd-out')][0].parent.quaternion.w);
check('Elevon sliders rotate the elevons', rot < 0.999, `quaternion w=${rot.toFixed(4)}`);
await page.locator('#pitch').fill('0');
await page.locator('#roll').fill('0');

// Equipment bay
await page.getByRole('tab', { name: 'Equipment bay' }).click();
await page.waitForTimeout(2600);
st = await state(page);
check('Equipment bay tab opens doors and focuses bay', st.bayOpen && st.selectedId === 'bay');
await shot(page, '18-bay');
await page.locator('.side').getByRole('button', { name: /Scientific Research Rack/ }).first().click();
await page.waitForTimeout(1500);
st = await state(page);
const sciVisible = await page.evaluate(() => [...window.__nightfall.registry.get('payload-sci')].every((o) => o.parent.visible));
const mapHidden = await page.evaluate(() => [...window.__nightfall.registry.get('payload-map')].every((o) => !o.parent.visible));
check('Switching equipment module changes the model', st.payloadId === 'payload-sci' && sciVisible && mapHidden);
await shot(page, '19-bay-sci');

// Autonomy
await page.getByRole('tab', { name: 'Autonomy' }).click();
await page.waitForTimeout(800);
await page.locator('.arch .node').nth(3).click();
await page.getByRole('button', { name: /Simulated mission abort/ }).click();
await page.waitForTimeout(3200);
await shot(page, '20-autonomy');
const authVisible = await page.getByRole('button', { name: 'Authorise abort' }).isVisible();
check('Abort scenario asks for human authorisation', authVisible);
if (authVisible) await page.getByRole('button', { name: 'Authorise abort' }).click();
await page.waitForTimeout(500);
const logText = await page.locator('.log').innerText();
check('Authorisation is written to the audit log', /terminated safely/.test(logText));
check('Status bar reflects scenario', /SIM SIMULATED MISSION ABORT/.test(await page.locator('.status').innerText()));

// Specs
await page.getByRole('tab', { name: 'Specifications' }).click();
await page.waitForTimeout(600);
await shot(page, '21-specs');
await page.locator('.spec-tabs').getByRole('tab', { name: 'Propulsion' }).click();
check('Specification tabs filter categories', (await page.locator('.doc table').count()) === 1);
check('Three-view drawings render', (await page.locator('svg.drawing').count()) === 3);

// Research
await page.getByRole('tab', { name: 'Research library' }).click();
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
await shot(page, '22-research');

// Back to viewer keeps context
await page.getByRole('tab', { name: 'Exterior' }).click();
await page.waitForTimeout(1200);
check('Returning to viewer keeps fitted module', (await state(page)).payloadId === 'payload-sci');

await page.close(); // free the WebGL context before the next viewport

/* ---------------- Mobile ---------------- */
const m = await newPage({ width: 390, height: 844 });
await m.goto(URL + '#exterior');
await m.waitForFunction(() => window.__nightfall?.store?.getState().renderStatus === 'ready', null, { timeout: 30000 });
await m.waitForTimeout(2500);
await shot(m, '30-mobile-exterior');
const overflow = await m.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
check('Mobile: no horizontal page scroll', !overflow);
await m.getByRole('button', { name: 'Systems' }).click();
await m.waitForTimeout(500);
await shot(m, '31-mobile-systems');
await m.locator('.side').getByRole('button', { name: /Centre Body/ }).click();
await m.waitForTimeout(1500);
check('Mobile: selecting opens inspection sheet', await m.locator('.insp.open').count() === 1);
await shot(m, '32-mobile-inspector');
await m.goto(URL + '#overview');
await m.waitForTimeout(2500);
await shot(m, '33-mobile-overview');
await m.goto(URL + '#autonomy');
await m.waitForTimeout(800);
await shot(m, '34-mobile-autonomy');
await m.close();
const t = await newPage({ width: 820, height: 1180 });
await t.goto(URL + '#cutaway');
await t.waitForFunction(() => window.__nightfall?.store?.getState().renderStatus === 'ready', null, { timeout: 30000 });
await t.waitForTimeout(2500);
await shot(t, '35-tablet-cutaway');

const relevant = errors.filter((e) => !/GPU stall|ReadPixels|WebGL-|swiftshader|Automatic fallback/i.test(e));
check('No console errors', relevant.length === 0, relevant.slice(0, 5).join(' | '));

await browser.close();

/* ---------------- WebGL unavailable ---------------- */
const noGl = await playwright.chromium.launch({ args: ['--disable-3d-apis', '--disable-webgl', '--disable-gpu'] });
const ng = await noGl.newPage({ viewport: { width: 1280, height: 800 } });
const ngErrors = [];
ng.on('pageerror', (e) => ngErrors.push(e.message));
await ng.goto(URL + '#exterior');
await ng.waitForTimeout(2500);
check('WebGL missing: helpful fallback is shown', (await ng.getByText('WebGL could not start').count()) === 1);
check('WebGL missing: status bar reports it', /UNAVAILABLE/.test(await ng.locator('.status').innerText()));
await ng.getByRole('tab', { name: 'Specifications' }).click();
check('WebGL missing: other sections still work', (await ng.locator('.doc svg.drawing').count()) >= 3 && ngErrors.length === 0, ngErrors.join(' | '));
await ng.screenshot({ path: `${OUT}/40-no-webgl.png` });
await noGl.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
process.exit(failed.length ? 1 : 0);
