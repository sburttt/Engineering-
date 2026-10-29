/**
 * Turns the single-file Vite build (dist-single/index.html) into a page fragment for publishing:
 * keeps <title>, the Google Fonts link, inline CSS and the inline module script; drops the
 * doctype/html/head/body wrapper that the host adds itself.
 */
import fs from 'node:fs';

const src = fs.readFileSync('dist-single/index.html', 'utf8');
const pick = (re) => [...src.matchAll(re)].map((m) => m[0]);
const title = pick(/<title>[\s\S]*?<\/title>/g)[0] ?? '<title>Corvane CX-7 Nightfall</title>';
const links = pick(/<link[^>]+fonts\.(googleapis|gstatic)[^>]*>/g);
const styles = pick(/<style[^>]*>[\s\S]*?<\/style>/g);
const scripts = pick(/<script[^>]*>[\s\S]*?<\/script>/g);
const out = [title, ...links, ...styles, '<div id="root"></div>', ...scripts].join('\n');
fs.mkdirSync('artifact', { recursive: true });
fs.writeFileSync('artifact/nightfall.html', out);
console.log(`artifact/nightfall.html — ${(out.length / 1024).toFixed(0)} KB, ${scripts.length} script(s), ${styles.length} style block(s)`);
