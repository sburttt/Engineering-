/**
 * Data-integrity checks (no browser needed):
 *   npm run validate
 * - every mesh part references a known component
 * - every component, related id, interface and parent is valid
 * - every component that should be pickable has geometry
 * - research entries have https sources and labelled claims
 * - specification dimensions equal the parametric model envelope
 */
import { buildParts } from '../src/aircraft/parts.ts';
import { COMPONENTS, COMPONENT_MAP, chainOf } from '../src/data/components.ts';
import { RESEARCH } from '../src/data/research.ts';
import { DIMENSIONS } from '../src/data/aircraft.ts';
import { EQUIPMENT_MODULES } from '../src/data/equipmentModules.ts';
import { LAYERS, LINKS, SCENARIOS } from '../src/data/autonomy.ts';
import { envelope } from '../src/aircraft/geometry/airframe.ts';

let failures = 0;
const check = (name: string, ok: boolean, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

const parts = buildParts();
const unknown = parts.filter((p) => !COMPONENT_MAP[p.componentId]).map((p) => p.componentId);
check('All mesh parts reference known components', unknown.length === 0, unknown.join(', '));

const withGeometry = new Set(parts.map((p) => p.componentId));
const missing = COMPONENTS.filter((c) => !withGeometry.has(c.id) && !COMPONENTS.some((k) => k.parent === c.id)).map((c) => c.id);
check('Every leaf component has geometry in the model', missing.length === 0, missing.join(', '));

const badRefs: string[] = [];
for (const c of COMPONENTS) {
  if (c.parent && !COMPONENT_MAP[c.parent]) badRefs.push(`${c.id}.parent→${c.parent}`);
  for (const r of c.related) if (!COMPONENT_MAP[r]) badRefs.push(`${c.id}.related→${r}`);
  for (const i of c.interfaces ?? []) if (!COMPONENT_MAP[i.to]) badRefs.push(`${c.id}.interface→${i.to}`);
  if (chainOf(c.id).length > 4) badRefs.push(`${c.id} hierarchy too deep`);
}
check('Component parents, relations and interfaces resolve', badRefs.length === 0, badRefs.join(', '));
check('Component ids are unique', new Set(COMPONENTS.map((c) => c.id)).size === COMPONENTS.length);
check('Every equipment module has a component record', EQUIPMENT_MODULES.every((m) => COMPONENT_MAP[m.id]));

const nonNumericGeom = parts.filter((p) => {
  const a = p.geometry.getAttribute('position').array as ArrayLike<number>;
  for (let i = 0; i < a.length; i++) if (!Number.isFinite(a[i])) return true;
  return false;
});
check('All geometry is finite', nonNumericGeom.length === 0, nonNumericGeom.map((p) => p.key).join(', '));

const badSources = RESEARCH.flatMap((r) => (r.sources.length ? r.sources.filter((s) => !/^https:\/\//.test(s.url)).map((s) => r.id + ':' + s.url) : [r.id + ': none']));
check('Research entries have https sources', badSources.length === 0, badSources.join(', '));
check('Research claims are labelled', RESEARCH.every((r) => [...r.overview, ...r.design, ...r.autonomy, ...r.learned].every((c) => ['VERIFIED', 'INTERP', 'FICTIONAL'].includes(c.label))));
check('Every "learned" claim is marked fictional', RESEARCH.every((r) => r.learned.every((c) => c.label === 'FICTIONAL')));

const env = envelope();
check('Spec length equals model', Math.abs(DIMENSIONS.length - env.length) < 0.01, `${DIMENSIONS.length} vs ${env.length}`);
check('Spec span equals model', Math.abs(DIMENSIONS.span - env.span) < 0.01, `${DIMENSIONS.span} vs ${env.span}`);
check('Spec height equals model', Math.abs(DIMENSIONS.height - env.heightGearDown) < 0.01, `${DIMENSIONS.height} vs ${env.heightGearDown.toFixed(3)}`);

const layerIds = new Set(LAYERS.map((l) => l.id));
check('Autonomy links reference layers', LINKS.every(([a, b]) => layerIds.has(a) && layerIds.has(b)));
check('Scenario affected layers exist', SCENARIOS.every((s) => s.affected.every((a) => layerIds.has(a))));

console.log(`\n${failures ? failures + ' check(s) failed' : 'All data checks passed'} · ${parts.length} parts · ${COMPONENTS.length} components · ${RESEARCH.length} research entries`);
process.exit(failures ? 1 : 0);
