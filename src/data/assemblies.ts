import { COMPONENTS, COMPONENT_MAP, childrenOf, type ComponentGroup } from './components';

/**
 * Component identification numbers, in the style of an illustrated parts breakdown.
 * NF-1xx exterior structure · NF-3xx interior systems · NF-4xx navigation & autonomy ·
 * NF-5xx equipment · NF-7xx service access. Sub-components add 1, 2, 3… to their parent.
 * (Fictional numbering for a concept visualisation.)
 */
const GROUP_BASE: Record<ComponentGroup, number> = { exterior: 100, interior: 300, autonomy: 400, equipment: 500, maintenance: 700 };

export const COMPONENT_CODE: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  const count: Partial<Record<ComponentGroup, number>> = {};
  for (const c of COMPONENTS) {
    if (c.parent) continue;
    const i = count[c.group] ?? 0;
    count[c.group] = i + 1;
    const n = GROUP_BASE[c.group] + i * 10;
    out[c.id] = `NF-${n}`;
    childrenOf(c.id).forEach((k, j) => {
      out[k.id] = `NF-${n + j + 1}`;
      childrenOf(k.id).forEach((kk, m) => (out[kk.id] = `NF-${n + j + 1}.${m + 1}`));
    });
  }
  return out;
})();
export const codeOf = (id: string) => COMPONENT_CODE[id] ?? 'NF-000';

/**
 * Assemblies offered in the exploded view. Each separates in a controlled, directional way:
 *  shell    skins split vertically, sub-components move away from the assembly centre,
 *           the assembly as a whole detaches from the aircraft centreline;
 *  children each member stays put and its own sub-components step away from it;
 *  normal   panels lift straight off the surface;
 *  explicit members move along the given vectors (metres at full separation).
 */
export interface Assembly {
  id: string;
  name: string;
  members: string[];
  style: 'shell' | 'children' | 'normal' | 'explicit';
  offsets?: Record<string, [number, number, number]>;
  /** preferred viewing direction for the exploded presentation */
  view: [number, number, number];
  /** components that receive a label (defaults: members and their children) */
  labels?: string[];
  /** needs the shell see-through to be understood (internal assemblies) */
  internal?: boolean;
  /** open the bay doors while exploded */
  bay?: boolean;
  note: string;
}

export const ASSEMBLIES: Assembly[] = [
  {
    id: 'asm-fwd',
    name: 'Forward fuselage',
    members: ['fwd-fuselage'],
    style: 'shell',
    view: [0.75, 0.35, 0.6],
    note: 'Radome, upper and lower skins and the three sensor apertures separate around the chined nose.',
  },
  {
    id: 'asm-centre',
    name: 'Centre body',
    members: ['ctr-body'],
    style: 'shell',
    view: [0.45, 0.6, 0.65],
    note: 'Upper and lower centre-body skins part vertically to show the blended section.',
  },
  {
    id: 'asm-wing',
    name: 'Starboard wing',
    members: ['wing-stbd'],
    style: 'shell',
    view: [0.25, 0.75, 0.6],
    note: 'The outer wing detaches at the root joint; elevons and the drooped tip blade step away along their hinge and joint lines.',
  },
  {
    id: 'asm-aft',
    name: 'Aft body and exhaust',
    members: ['aft-body'],
    style: 'shell',
    view: [-0.8, 0.45, 0.5],
    note: 'The aft skins and the flattened slot-exhaust surround separate behind the centre body.',
  },
  {
    id: 'asm-propulsion',
    name: 'Propulsion housing',
    members: ['fairing', 'inlet-duct', 'propulsion'],
    style: 'explicit',
    offsets: { fairing: [0, 1.6, 0], 'inlet-duct': [0.9, 0.7, 0], propulsion: [-1.1, 0.15, 0] },
    view: [0.55, 0.55, 0.65],
    internal: true,
    labels: ['fairing', 'inlet', 'inlet-duct', 'propulsion'],
    note: 'Dorsal fairing lifted to show the conceptual inlet duct and engine envelope. Simplified volumes only.',
  },
  {
    id: 'asm-gear',
    name: 'Landing gear',
    members: ['gear-nose', 'gear-port', 'gear-stbd'],
    style: 'children',
    view: [0.6, -0.12, 0.8],
    labels: ['gear-nose-strut', 'gear-nose-wheel', 'gear-nose-doors', 'gear-stbd-strut', 'gear-stbd-wheel', 'gear-stbd-doors'],
    note: 'Tricycle gear: each leg separates into strut, wheel and well doors.',
  },
  {
    id: 'asm-panels',
    name: 'Access panels',
    members: ['ap-avionics', 'ap-nav', 'ap-power', 'ap-comms', 'ap-thermal', 'ap-engine'],
    style: 'normal',
    view: [0.3, 0.85, 0.45],
    note: 'Removable service panels lift off the skin, one above each internal module.',
  },
  {
    id: 'asm-systems',
    name: 'Mission systems',
    members: ['afcm', 'nav', 'spm', 'comms', 'power', 'thermal'],
    style: 'explicit',
    offsets: {
      spm: [0.9, 0.9, 0],
      nav: [0.45, 1.2, 0],
      afcm: [0, 1.0, 0],
      comms: [0, 0.75, -0.9],
      power: [0, 0.75, 0.9],
      thermal: [-0.4, 0.75, 0],
    },
    view: [0.45, 0.8, 0.55],
    internal: true,
    note: 'Conceptual line-replaceable modules raised from their bays. Box volumes only; no internal detail is implied.',
  },
  {
    id: 'asm-bay',
    name: 'Equipment bay',
    members: ['bay', 'bay-doors'],
    style: 'explicit',
    offsets: { bay: [0, -1.1, 0], 'bay-doors': [0, -0.35, 0] },
    view: [0.35, -0.7, 0.6],
    bay: true,
    labels: ['bay', 'bay-doors'],
    note: 'The bay structure and fitted module lower out of the open doors.',
  },
];
export const ASSEMBLY_MAP: Record<string, Assembly> = Object.fromEntries(ASSEMBLIES.map((a) => [a.id, a]));

/** Components labelled when an assembly is exploded. */
export function assemblyLabels(a: Assembly): string[] {
  if (a.labels) return a.labels;
  const out: string[] = [];
  for (const m of a.members) {
    out.push(m);
    for (const k of childrenOf(m)) out.push(k.id);
  }
  return out.filter((id) => COMPONENT_MAP[id]);
}

/** The assembly a component belongs to, if any. */
export function assemblyOf(componentId: string): Assembly | null {
  let cur: string | null = componentId;
  while (cur) {
    const c: string = cur;
    const hit = ASSEMBLIES.find((a) => a.members.includes(c));
    if (hit) return hit;
    cur = COMPONENT_MAP[c]?.parent ?? null;
  }
  return null;
}
