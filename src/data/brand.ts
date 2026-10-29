/**
 * FICTIONAL COMPANY IDENTITY — Corvane Aerosystems is invented for this concept.
 * Name screened against public web search for obvious conflicts (no aerospace company
 * named "Corvane" found; nearby names such as Corvaer, Corvus Aero and Corvette Aerospace exist,
 * so the full name "Corvane Aerosystems" and the CVR abbreviation are always used together).
 */
export const BRAND = {
  name: 'Corvane Aerosystems',
  short: 'CORVANE',
  abbreviation: 'CVR',
  tagline: 'Quiet geometry. Accountable autonomy.',
  mission:
    'Corvane designs uncrewed aerospace demonstrators where every autonomous function is explainable, supervised by people and built to be inspected.',
  founded: '2019 (fictional)',
  hq: 'Hollowell Field, Nevada (fictional)',
  personality: ['Precise', 'Understated', 'Evidence-led', 'Engineering-first'],
  designation: 'CX-7',
  codename: 'NIGHTFALL',
  designationRule:
    'CX = Corvane eXperimental airframe; the number counts airframe studies in order. Production-intent designs would drop the X. Individual airframes carry an NF-nn serial.',
  serial: 'NF-01',
  name_candidates: [
    { name: 'Corvane Aerosystems', verdict: 'Selected — evocative (corvus, “raven” + vane), easy to say, no aerospace match found.' },
    { name: 'Halcyra Aerospace', verdict: 'Rejected — pleasant but reads as calm/leisure; weaker link to night and flight.' },
    { name: 'Nocturne Aerosystems', verdict: 'Rejected — too literal next to the NIGHTFALL codename.' },
    { name: 'Tessaline Dynamics', verdict: 'Rejected — “Dynamics” is crowded in defence naming.' },
    { name: 'Meridian Vane', verdict: 'Rejected — “Meridian” is widely used by existing companies.' },
  ],
  colors: {
    graphite: '#0b0d10',
    panel: '#14181d',
    line: '#262c33',
    text: '#e6e9ec',
    muted: '#8c96a0',
    accent: '#7fb8c4',
    caution: '#c8963e',
  },
  type: { display: 'Michroma', body: 'IBM Plex Sans', data: 'IBM Plex Mono' },
};

/** Emblem geometry on a 64×64 grid: a forward chevron split by a horizon line, with a nested vane. */
export const EMBLEM = {
  outerUpper: [[56, 8], [62, 14], [29.9, 31], [13.8, 31]],
  outerLower: [[13.8, 33], [29.9, 33], [62, 50], [56, 56]],
  vaneUpper: [[58, 24], [44, 31], [52.75, 31]],
  vaneLower: [[44, 33], [58, 40], [52.75, 33]],
} as const;

export const polyPoints = (pts: readonly (readonly number[])[]) => pts.map((p) => p.join(',')).join(' ');
