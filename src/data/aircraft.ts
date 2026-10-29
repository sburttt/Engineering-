import { envelope, planformArea, HALF_SPAN, NOSE_X, TAIL_X } from '../aircraft/geometry/airframe';

/** All values are FICTIONAL CONCEPT ESTIMATES derived from the parametric model unless marked otherwise. */
const env = envelope();
export const DIMENSIONS = {
  length: +(NOSE_X - TAIL_X).toFixed(2),
  span: +(HALF_SPAN * 2).toFixed(2),
  height: +env.heightGearDown.toFixed(2),
  planformArea: +planformArea().toFixed(1),
};

export const MATURITY = 'CONCEPTUAL DEMONSTRATOR — NOT FLIGHT VALIDATED';
export const NOT_ESTABLISHED = 'Not established at concept stage';

export interface SpecRow {
  k: string;
  v: string;
  note?: string;
}
export interface SpecGroup {
  id: string;
  title: string;
  rows: SpecRow[];
}

export const SPEC_GROUPS: SpecGroup[] = [
  {
    id: 'general',
    title: 'General',
    rows: [
      { k: 'Designation', v: 'CX-7 NIGHTFALL' },
      { k: 'Manufacturer', v: 'Corvane Aerosystems (fictional)' },
      { k: 'Configuration', v: 'Tailless cranked-arrow, blended centre body' },
      { k: 'Aircraft class', v: 'Uncrewed technology demonstrator' },
      { k: 'Crew configuration', v: 'Uncrewed — no onboard cockpit; human supervisory oversight' },
      { k: 'Intended conceptual mission', v: 'Research platform for supervised autonomy and modular non-weapon mission equipment' },
      { k: 'Development status', v: 'Concept study — design-review visualisation only' },
      { k: 'Design maturity', v: MATURITY },
      { k: 'Estimated development phase', v: 'Pre-preliminary design (concept exploration)' },
    ],
  },
  {
    id: 'physical',
    title: 'Physical concept',
    rows: [
      { k: 'Length', v: `${DIMENSIONS.length.toFixed(1)} m`, note: 'Fictional concept estimate — measured from the 3D model' },
      { k: 'Wingspan', v: `${DIMENSIONS.span.toFixed(1)} m`, note: 'Fictional concept estimate — measured from the 3D model' },
      { k: 'Height (gear extended)', v: `${DIMENSIONS.height.toFixed(2)} m`, note: 'Fictional concept estimate — measured from the 3D model' },
      { k: 'Planform area', v: `≈ ${DIMENSIONS.planformArea} m²`, note: 'Numerically integrated from the model planform' },
      { k: 'Aspect ratio', v: `≈ ${((DIMENSIONS.span ** 2) / DIMENSIONS.planformArea).toFixed(1)}`, note: 'Span² ÷ planform area' },
      { k: 'Leading-edge sweep (outer wing)', v: '≈ 40°', note: 'From planform geometry' },
      { k: 'Empty mass', v: NOT_ESTABLISHED },
      { k: 'Exterior material concept', v: 'Graphite composite skins; satin removable panels; flush glazing for apertures' },
      { k: 'Structural layout concept', v: '8 body frames, 2 spars and 4 ribs per outer wing' },
      { k: 'Equipment-bay arrangement', v: 'Single ventral bay, ≈ 3.0 × 1.2 × 0.45 m, twin ceiling rails, one common connector' },
    ],
  },
  {
    id: 'propulsion',
    title: 'Propulsion',
    rows: [
      { k: 'Propulsion category', v: 'Single small turbofan class (fictional)' },
      { k: 'Placement', v: 'Centreline, under a dorsal fairing; raked dorsal inlet; S-duct; flattened slot exhaust' },
      { k: 'Design intent', v: 'Keep the lower surface free for gear and the equipment bay' },
      { k: 'Thrust / fuel / range', v: NOT_ESTABLISHED },
      { k: 'Endurance class', v: 'Conceptual: medium endurance (no figure claimed)' },
      { k: 'Validation status', v: 'None — art-directed form only' },
    ],
  },
  {
    id: 'autonomy',
    title: 'Autonomy',
    rows: [
      { k: 'Uncrewed configuration', v: 'Yes — no cockpit or onboard pilot' },
      { k: 'Autonomy classification', v: 'Conceptual supervised autonomy (see Autonomy tab)' },
      { k: 'Architecture', v: '9 conceptual layers hosted on the autonomous flight-computing module' },
      { k: 'Supervisory model', v: 'Human authorisation for every consequential mission change; full audit log' },
      { k: 'Simulation status', v: 'Illustrative in-browser scenarios only — no flight software exists' },
    ],
  },
  {
    id: 'maintainability',
    title: 'Maintainability',
    rows: [
      { k: 'Modular equipment concept', v: 'Six interchangeable bay modules on common rails' },
      { k: 'Service access', v: '7 dedicated access panels, one per major module' },
      { k: 'Replaceable assemblies', v: 'Compute blades, navigation, sensor-processing, comms and power units as line-replaceable units' },
      { k: 'Inspection philosophy', v: 'Every module reachable without removing a neighbouring module' },
    ],
  },
];
