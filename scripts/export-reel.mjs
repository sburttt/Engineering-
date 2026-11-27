/**
 * Frame-by-frame export of the showcase reel to video (or to stills).
 *
 *   npm run build && npx vite preview --port 4173 &
 *   node scripts/export-reel.mjs                         # reel/nightfall-reel-1080p.mp4, 1920×1080, 30 fps
 *   node scripts/export-reel.mjs --size 1080x1350 --out reel/nightfall-reel-4x5.mp4
 *   node scripts/export-reel.mjs --clean                 # no scene labels (end card kept)
 *   node scripts/export-reel.mjs --at 1,6,9,14 --out reel/frames   # stills at those seconds
 *
 * The page is opened with ?reel, the timeline clock is switched to manual and set for every frame,
 * so the video is exact whatever the render speed of this machine. No audio track is written: the
 * timing is left free for music to be laid in afterwards.
 */
import { createRequire } from 'node:module';
import { execSync, spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require('playwright');
} catch {
  playwright = require(execSync('npm root -g').toString().trim() + '/playwright');
}
const { chromium } = playwright;

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i < 0 ? d : process.argv[i + 1];
};
const flag = (k) => process.argv.includes(`--${k}`);

const url = arg('url', 'http://localhost:4173/');
const [W, H] = arg('size', '1920x1080').split('x').map(Number);
const fps = Number(arg('fps', 30));
const at = arg('at', null);
const out = arg('out', at ? 'reel/frames' : `reel/nightfall-reel-${H >= W ? `${W}x${H}` : `${H}p`}.mp4`);
const from = Number(arg('from', 0));

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.error('page error:', e.message));
await page.goto(`${url}?reel${flag('clean') ? '=clean' : ''}&export#aircraft`);
await page.waitForFunction(() => window.__nightfall?.step && document.querySelector('.cinema'), null, { timeout: 180000 });
const duration = await page.evaluate(() => {
  const c = window.__nightfall.cine;
  c.manual = true;
  c.t = 0;
  c.last = 0;
  return window.__nightfall.duration();
});
const to = Number(arg('to', duration));

// one rendered frame at time t, then one browser frame so the interface overlays catch up
const step = (t, dt = 1 / fps) =>
  page.evaluate(
    ([t, dt]) => {
      window.__nightfall.step(t, dt);
      return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    },
    [t, dt],
  );
const shot = (opts) => page.screenshot({ timeout: 900000, ...opts });

// warm up: let shaders compile and the environment map render before the first frame
for (let i = 0; i < 4; i++) await step(from, 0);

if (at) {
  mkdirSync(out, { recursive: true });
  const times = at.split(',').map(Number).sort((a, b) => a - b);
  for (const target of times) {
    // arrive from a fraction of a second earlier, so a look change on the way is captured as in playback
    await step(Math.max(0, target - 0.3), 1);
    await step(Math.max(0, target - 0.1), 0.2);
    await step(target);
    await shot({ path: `${out}/reel-${target.toFixed(2).padStart(5, '0')}.png` });
    console.log('still', target);
  }
  await browser.close();
  process.exit(0);
}

mkdirSync(dirname(out), { recursive: true });
const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
const n = Math.round((to - from) * fps);
const t0 = Date.now();
for (let i = 0; i <= n; i++) {
  await step(from + i / fps);
  const buf = await shot({ type: 'jpeg', quality: 95 });
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
  if (i % 30 === 0) console.log(`frame ${i}/${n}  ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
ff.stdin.end();
await new Promise((r) => ff.on('close', r));
await browser.close();
console.log('wrote', out);
