/**
 * Structured component records for the CX-7 NIGHTFALL concept.
 * Every selectable mesh in the 3D model carries one of these ids (userData.componentId).
 * All content is FICTIONAL DESIGN DECISION unless stated otherwise.
 */

export type ComponentGroup = 'exterior' | 'interior' | 'autonomy' | 'equipment' | 'maintenance';
export type Category =
  | 'Airframe'
  | 'Flight Controls'
  | 'Propulsion'
  | 'Landing Gear'
  | 'Sensors'
  | 'Mission Computing'
  | 'Power & Thermal'
  | 'Structure'
  | 'Equipment Bay'
  | 'Maintenance Access'
  | 'Communications';

export interface Interface {
  to: string;
  label: string;
}

export interface ComponentRecord {
  id: string;
  name: string;
  category: Category;
  group: ComponentGroup;
  parent: string | null;
  short: string;
  fn: string;
  visual: string;
  material: string;
  related: string[];
  notes: string;
  location: 'external' | 'internal';
  isolatable: boolean;
  /** Explode offset in metres at full intensity (added to all ancestors' offsets). */
  explode?: [number, number, number];
  /** Optional conceptual interfaces, drawn as a small architecture diagram. */
  interfaces?: Interface[];
}

type R = Omit<ComponentRecord, 'isolatable'> & { isolatable?: boolean };

const raw: R[] = [
  /* ------------------------------ AIRFRAME ------------------------------ */
  {
    id: 'fwd-fuselage',
    name: 'Forward Fuselage',
    category: 'Airframe',
    group: 'exterior',
    parent: null,
    location: 'external',
    short: 'Chined nose section that houses the sensor, navigation and flight-computing bays.',
    fn: 'Carries the forward mission electronics and defines the aircraft’s faceted nose. With no cockpit, the volume a canopy would normally take is given to equipment and to a continuous upper surface.',
    visual: 'Sharp lateral chine running from the nose tip to the wing leading edge; flatter underside; single radome seam at station X 5.2 m.',
    material: 'Graphite-black composite outer skin, matte finish; satin-finish radome panel forward of the seam.',
    related: ['spm', 'nav', 'afcm', 'sensor-fwd', 'gear-nose'],
    notes: 'Removable radome concept gives straight-in access to the sensor-processing module.',
    explode: [1.4, 0.3, 0],
  },
  {
    id: 'sensor-fwd',
    name: 'Forward Sensor Aperture',
    category: 'Sensors',
    group: 'exterior',
    parent: 'fwd-fuselage',
    location: 'external',
    short: 'Flush, faceted window on the lower nose for a generic forward-looking sensor.',
    fn: 'Represents a flush aperture for an abstract imaging or environmental sensor. Its data feeds the sensor-processing module. No sensor type or performance is specified.',
    visual: 'Dark tinted glazing set flush into the lower nose facets.',
    material: 'Dark smoked glazing with a thin satin frame.',
    related: ['spm', 'sensor-ventral'],
    notes: 'Shown as a visual placeholder only.',
    explode: [0.5, -0.4, 0],
  },
  {
    id: 'sensor-ventral',
    name: 'Ventral Electro-Optical Window',
    category: 'Sensors',
    group: 'exterior',
    parent: 'fwd-fuselage',
    location: 'external',
    short: 'Small downward-facing window ahead of the nose gear.',
    fn: 'Placeholder aperture for a downward-looking camera used in the concept’s mapping and terrain-reference narratives.',
    visual: 'Hexagonal flush window, slightly recessed.',
    material: 'Dark glazing, satin bezel.',
    related: ['spm', 'nav'],
    notes: 'Fictional; dimensions are illustrative.',
    explode: [0, -0.5, 0],
  },
  {
    id: 'sensor-lateral',
    name: 'Lateral Aperture Pair',
    category: 'Sensors',
    group: 'exterior',
    parent: 'fwd-fuselage',
    location: 'external',
    short: 'Two small flush windows set into the upper chine, one each side.',
    fn: 'Placeholders for side-facing situational-awareness cameras that support ground handling and the sensor-fusion narrative.',
    visual: 'Thin elongated windows following the chine line.',
    material: 'Dark glazing.',
    related: ['spm'],
    notes: 'Kept small so they do not dominate the silhouette.',
    explode: [0, 0.4, 0],
  },
  {
    id: 'ctr-body',
    name: 'Centre Body',
    category: 'Airframe',
    group: 'exterior',
    parent: null,
    location: 'external',
    short: 'Blended central lifting body carrying the equipment bay, power and communications bays.',
    fn: 'The structural and volumetric core of the aircraft. It blends smoothly into the outer wings and carries the main gear, the ventral equipment bay and the dorsal propulsion fairing.',
    visual: 'Broad, low hump with a split upper surface either side of the dorsal fairing.',
    material: 'Graphite-black composite skin with satin access panels.',
    related: ['bay', 'power', 'comms', 'fairing', 'gear-port', 'gear-stbd'],
    notes: 'Upper skins drawn as removable strips either side of the fairing.',
    explode: [0, 0.2, 0],
  },
  {
    id: 'aft-body',
    name: 'Aft Body',
    category: 'Airframe',
    group: 'exterior',
    parent: null,
    location: 'external',
    short: 'Tapering rear body with the flattened slot exhaust and thermal bays.',
    fn: 'Transitions the centre body into a thin, flat trailing edge. It houses the propulsion unit, the exhaust transition duct and the thermal-management heat exchangers.',
    visual: 'Forward-swept inner trailing edges meeting a straight centre trailing edge.',
    material: 'Composite skin; the exhaust deck area is represented in a darker high-temperature finish.',
    related: ['propulsion', 'exhaust', 'thermal'],
    notes: 'Exhaust is shown recessed between upper and lower skins.',
    explode: [-1.4, 0.2, 0],
  },
  {
    id: 'exhaust',
    name: 'Slot Exhaust Nozzle',
    category: 'Propulsion',
    group: 'exterior',
    parent: 'aft-body',
    location: 'external',
    short: 'Wide, shallow exhaust slot at the trailing edge.',
    fn: 'Conceptual flattened nozzle that blends the round engine exit into the thin trailing edge. Shown as an art-directed form; no performance is claimed.',
    visual: 'Shallow superelliptical slot in a darker base plate.',
    material: 'Dark heat-tinted metallic finish (visual only).',
    related: ['propulsion', 'aft-body'],
    notes: 'Not a validated nozzle design.',
    explode: [-0.8, 0, 0],
  },
  ...wing('port', 'Port', -1),
  ...wing('stbd', 'Starboard', 1),
  {
    id: 'fairing',
    name: 'Dorsal Propulsion Fairing',
    category: 'Propulsion',
    group: 'exterior',
    parent: null,
    location: 'external',
    short: 'Low dorsal housing over the inlet duct and propulsion unit.',
    fn: 'Encloses the serpentine inlet duct and the propulsion unit along the spine. Placing it on top keeps the lower surface clean for the equipment bay and landing gear.',
    visual: 'Smooth ridge that rises behind the raked inlet lip and fades into the aft body.',
    material: 'Satin graphite composite with an engine-access panel on top.',
    related: ['inlet', 'inlet-duct', 'propulsion', 'ap-engine'],
    notes: 'Fairing height and width are art-directed rather than sized for a specific engine.',
    explode: [0, 1.6, 0],
  },
  {
    id: 'inlet',
    name: 'Raked Dorsal Inlet',
    category: 'Propulsion',
    group: 'exterior',
    parent: 'fairing',
    location: 'external',
    short: 'Wide, shallow inlet with an overhanging raked lip.',
    fn: 'Represents the air intake for the propulsion unit. It feeds the S-shaped duct, so the engine face is not visible from the front in this concept.',
    visual: 'Chevron-shaped overhang above a dark throat.',
    material: 'Dark matte throat; satin lip.',
    related: ['inlet-duct', 'propulsion'],
    notes: 'Warning stencils mark the intake danger area for ground crews.',
    explode: [0.3, 0.2, 0],
  },
  ...gear('nose', 'Nose Landing Gear', 'Steerable single-wheel nose gear that retracts forward into the nose well.'),
  ...gear('port', 'Port Main Gear', 'Single-wheel main gear that retracts inboard into the centre-body wing root.'),
  ...gear('stbd', 'Starboard Main Gear', 'Single-wheel main gear that retracts inboard into the centre-body wing root.'),
  {
    id: 'bay-doors',
    name: 'Equipment Bay Doors',
    category: 'Equipment Bay',
    group: 'equipment',
    parent: null,
    location: 'external',
    short: 'Twin ventral doors that close over the modular equipment bay.',
    fn: 'Hinged at their outer edges and opening downward to give access to the equipment module. Open them from the Equipment Bay tab.',
    visual: 'Two flush panels split on the centreline, outlined by fine seams.',
    material: 'Graphite composite, matching the lower skin.',
    related: ['bay', 'ctr-body'],
    notes: 'Door motion is a simple hinge animation for visualisation.',
    explode: [0, -0.6, 0],
  },

  /* ------------------------------ MAINTENANCE ------------------------------ */
  ...panel('ap-avionics', 'Avionics Access Panel', 'Upper forward panel over the flight-computing module.', ['afcm']),
  ...panel('ap-nav', 'Navigation Bay Panel', 'Small panel over the navigation module ahead of the avionics bay.', ['nav']),
  ...panel('ap-power', 'Power Bay Panel', 'Starboard centre-body panel over the electrical power module.', ['power']),
  ...panel('ap-comms', 'Communications Bay Panel', 'Port centre-body panel over the communications module.', ['comms']),
  ...panel('ap-thermal', 'Thermal Bay Panels', 'Paired aft panels over the heat exchangers.', ['thermal']),
  ...panel('ap-engine', 'Propulsion Access Panel', 'Large panel on the fairing spine over the propulsion unit.', ['propulsion', 'fairing']),

  /* ------------------------------ INTERIOR ------------------------------ */
  {
    id: 'structure',
    name: 'Primary Structure',
    category: 'Structure',
    group: 'interior',
    parent: null,
    location: 'internal',
    short: 'Bulkheads, wing spars and ribs that frame the internal bays.',
    fn: 'Represents the load-carrying skeleton: cross-section frames along the body, two continuous spars per wing, and chordwise ribs. Modules mount to these frames on standard rails.',
    visual: 'Thin frames that follow the outer mould line, inset from the skin.',
    material: 'Satin grey structural composite (visual representation).',
    related: ['afcm', 'bay', 'wing-port', 'wing-stbd'],
    notes: 'Frame spacing is illustrative, not the result of a structural analysis.',
  },
  {
    id: 'structure-frames',
    name: 'Fuselage Frames',
    category: 'Structure',
    group: 'interior',
    parent: 'structure',
    location: 'internal',
    short: 'Nine cross-section bulkheads from nose to tail.',
    fn: 'Define bay boundaries and provide mounting points for equipment rails.',
    visual: 'Ring frames that follow the local body section.',
    material: 'Structural composite.',
    related: ['structure-spars'],
    notes: 'Spacing chosen to separate functional bays clearly.',
    explode: [0, 0.6, 0],
  },
  {
    id: 'structure-spars',
    name: 'Wing Spars',
    category: 'Structure',
    group: 'interior',
    parent: 'structure',
    location: 'internal',
    short: 'Front and rear spars running the length of each outer wing.',
    fn: 'Represent the main spanwise members that carry wing loads into the centre body.',
    visual: 'Thin vertical webs set at about 18 % and 72 % chord.',
    material: 'Structural composite.',
    related: ['structure-ribs', 'wing-port', 'wing-stbd'],
    notes: 'The rear spar also forms the elevon hinge support.',
  },
  {
    id: 'structure-ribs',
    name: 'Wing Ribs',
    category: 'Structure',
    group: 'interior',
    parent: 'structure',
    location: 'internal',
    short: 'Chordwise ribs at regular stations across each outer wing.',
    fn: 'Hold the aerofoil shape between spars and support skin panels.',
    visual: 'Thin plates following the local section.',
    material: 'Structural composite.',
    related: ['structure-spars'],
    notes: 'Illustrative spacing.',
  },
  {
    id: 'inlet-duct',
    name: 'Serpentine Inlet Duct',
    category: 'Propulsion',
    group: 'interior',
    parent: null,
    location: 'internal',
    short: 'S-shaped duct linking the dorsal inlet to the propulsion unit.',
    fn: 'Carries air from the wide, flat inlet down to the round engine face, changing cross-section along the way.',
    visual: 'Smooth loft from a flat ellipse to a circle.',
    material: 'Light grey interior finish (visualisation colour).',
    related: ['inlet', 'propulsion'],
    notes: 'The duct curvature is art-directed and has not been analysed.',
    explode: [0, 0.9, 0],
  },
  {
    id: 'propulsion',
    name: 'Propulsion Unit (Concept)',
    category: 'Propulsion',
    group: 'interior',
    parent: null,
    location: 'internal',
    short: 'A single generic small turbofan class engine along the centreline.',
    fn: 'Placeholder for a non-afterburning turbofan of the size used by uncrewed demonstrators. No specific engine, thrust or fuel figures are given.',
    visual: 'Fan face, tapered casing rings and an accessory gearbox below.',
    material: 'Brushed metal casing, dark fan.',
    related: ['inlet-duct', 'exhaust', 'power', 'thermal', 'ap-engine'],
    notes: 'Propulsion category: not established at concept stage beyond “small turbofan class”.',
    explode: [0, 0.5, 0],
  },
  {
    id: 'power',
    name: 'Electrical Power Module',
    category: 'Power & Thermal',
    group: 'interior',
    parent: null,
    location: 'internal',
    short: 'Power conversion and distribution for all onboard systems.',
    fn: 'Takes generator and battery power and distributes conditioned power to the flight computer, sensors and communications. It reports the health of each power channel to the flight-computing module.',
    visual: 'Stacked distribution units with a bus-bar spine and status-light strip.',
    material: 'Anodised enclosures, copper-tinted bus bars.',
    related: ['afcm', 'thermal', 'harness', 'ap-power'],
    notes: 'Redundant power channels are a conceptual feature only.',
    explode: [0, 0.8, 1.2],
    interfaces: [
      { to: 'propulsion', label: 'Generator input' },
      { to: 'afcm', label: 'Power-health telemetry' },
      { to: 'thermal', label: 'Cooling demand' },
      { to: 'bay', label: 'Payload power' },
    ],
  },
  {
    id: 'thermal',
    name: 'Thermal-Management Module',
    category: 'Power & Thermal',
    group: 'interior',
    parent: null,
    location: 'internal',
    short: 'Paired heat exchangers and a coolant loop for the electronics.',
    fn: 'Collects heat from the computing and power modules through a liquid loop and rejects it through heat exchangers beside the engine.',
    visual: 'Finned exchanger cores with coolant manifolds.',
    material: 'Aluminium-look fins, dark manifolds.',
    related: ['power', 'afcm', 'propulsion', 'ap-thermal'],
    notes: 'Heat loads are not established at concept stage.',
    explode: [0, 0.7, 0],
    interfaces: [
      { to: 'afcm', label: 'Coolant loop' },
      { to: 'power', label: 'Coolant loop' },
      { to: 'propulsion', label: 'Heat rejection path' },
    ],
  },
  {
    id: 'harness',
    name: 'Data & Power Harness',
    category: 'Power & Thermal',
    group: 'interior',
    parent: null,
    location: 'internal',
    short: 'Cable runs connecting every module to the flight computer and power bus.',
    fn: 'Represents separated data and power routing between the computing, sensing, communications, power and equipment bay modules.',
    visual: 'Bundled cable runs routed along the frames.',
    material: 'Braided sleeving.',
    related: ['afcm', 'power', 'bay'],
    notes: 'Routing is illustrative.',
    explode: [0, 1.0, 0],
  },

  /* ------------------------------ AUTONOMY & NAVIGATION ------------------------------ */
  {
    id: 'afcm',
    name: 'Autonomous Flight-Computing Module',
    category: 'Mission Computing',
    group: 'autonomy',
    parent: null,
    location: 'internal',
    short: 'Hosts flight management, system-health monitoring and decision-support software.',
    fn: 'The conceptual centre of the aircraft’s autonomy architecture. It runs flight-management functions, monitors every subsystem and checks mission plans against defined safety limits. Consequential mission changes always need human authorisation (see the Autonomy tab).',
    visual: 'Ruggedised chassis with removable compute blades and a cold-plate base.',
    material: 'Dark anodised chassis, satin blade faces.',
    related: ['nav', 'spm', 'comms', 'power', 'thermal', 'ap-avionics'],
    notes: 'Fictional architecture. Not a real or certified flight-control system.',
    explode: [0, 1.5, 0],
    interfaces: [
      { to: 'nav', label: 'State estimate' },
      { to: 'spm', label: 'Fused sensor tracks' },
      { to: 'comms', label: 'Supervisor link' },
      { to: 'power', label: 'Power health' },
      { to: 'thermal', label: 'Cooling status' },
      { to: 'bay', label: 'Payload interface' },
    ],
  },
  {
    id: 'afcm-chassis',
    name: 'Compute Chassis',
    category: 'Mission Computing',
    group: 'autonomy',
    parent: 'afcm',
    location: 'internal',
    short: 'Ruggedised enclosure with cold-plate base and quick-release mounts.',
    fn: 'Provides mounting, shielding and cooling for the compute blades.',
    visual: 'Bevelled enclosure with front connector panel.',
    material: 'Anodised aluminium look.',
    related: ['afcm-cards', 'thermal'],
    notes: 'Removed upward through the avionics access panel in this concept.',
  },
  {
    id: 'afcm-cards',
    name: 'Compute Blades',
    category: 'Mission Computing',
    group: 'autonomy',
    parent: 'afcm',
    location: 'internal',
    short: 'Eight replaceable processing blades in two redundant groups.',
    fn: 'Represent partitioned computing lanes. In the concept, independent lanes cross-check each other so one faulty lane can be detected.',
    visual: 'Evenly spaced vertical blades with indicator strips.',
    material: 'Satin blade faces.',
    related: ['afcm-chassis'],
    notes: 'Lane count is illustrative.',
    explode: [0, 0.5, 0],
  },
  {
    id: 'nav',
    name: 'Navigation & State-Estimation Module',
    category: 'Mission Computing',
    group: 'autonomy',
    parent: null,
    location: 'internal',
    short: 'Combines inertial, satellite and terrain-reference inputs into one state estimate.',
    fn: 'Maintains the aircraft’s estimated position, velocity and attitude and reports how confident that estimate is. Disagreement between sources is flagged to the flight-computing module.',
    visual: 'Compact enclosure with a central gimbal-housing dome.',
    material: 'Dark enclosure, satin dome.',
    related: ['afcm', 'sensor-ventral', 'ap-nav'],
    notes: 'Sensor types are generic; no accuracy figures are given.',
    explode: [0, 1.9, 0],
    interfaces: [
      { to: 'afcm', label: 'State + confidence' },
      { to: 'spm', label: 'Terrain reference' },
      { to: 'comms', label: 'Time reference' },
    ],
  },
  {
    id: 'spm',
    name: 'Sensor-Processing Module',
    category: 'Sensors',
    group: 'autonomy',
    parent: null,
    location: 'internal',
    short: 'Processes raw data from the apertures into compact data products.',
    fn: 'Turns raw aperture data into compact products (images, environmental readings) for the flight computer and payload. Abstract by design: no sensor modes or specifications are described.',
    visual: 'Ribbed processing enclosure behind the radome.',
    material: 'Dark enclosure with heat-spreader ribs.',
    related: ['sensor-fwd', 'sensor-ventral', 'sensor-lateral', 'afcm'],
    notes: 'Kept intentionally abstract.',
    explode: [0.4, 2.2, 0],
    interfaces: [
      { to: 'sensor-fwd', label: 'Raw aperture data' },
      { to: 'afcm', label: 'Data products' },
      { to: 'nav', label: 'Terrain cues' },
    ],
  },
  {
    id: 'comms',
    name: 'Communications Module',
    category: 'Communications',
    group: 'autonomy',
    parent: null,
    location: 'internal',
    short: 'Supervisory datalink and line-of-sight relay package.',
    fn: 'Carries the supervisory link between the aircraft and its human operators, plus health telemetry and the audit log. Loss of this link starts the defined lost-link behaviour.',
    visual: 'Twin transceiver enclosures with a cable manifold, plus a conformal antenna on the upper skin.',
    material: 'Dark enclosures; antenna panel finished to match the skin.',
    related: ['afcm', 'comms-antenna', 'ap-comms'],
    notes: 'Frequency bands and ranges are not established at concept stage.',
    explode: [0, 0.8, -1.2],
    interfaces: [
      { to: 'afcm', label: 'Commands & telemetry' },
      { to: 'comms-antenna', label: 'RF feed' },
      { to: 'nav', label: 'Time sync' },
    ],
  },
  {
    id: 'comms-antenna',
    name: 'Conformal Antenna Panel',
    category: 'Communications',
    group: 'autonomy',
    parent: 'comms',
    location: 'external',
    short: 'Flush antenna panel on the upper port wing root.',
    fn: 'Represents a conformal antenna integrated into the skin instead of a protruding blade.',
    visual: 'Slightly lighter panel outlined by a seam.',
    material: 'Skin-matched dielectric panel.',
    related: ['comms'],
    notes: 'Placement is illustrative.',
    explode: [0, 0.6, 0],
  },

  /* ------------------------------ EQUIPMENT BAY ------------------------------ */
  {
    id: 'bay',
    name: 'Modular Equipment Bay',
    category: 'Equipment Bay',
    group: 'equipment',
    parent: null,
    location: 'internal',
    short: 'Ventral compartment with standard rails for interchangeable mission modules.',
    fn: 'A fixed-size bay with standard mounting rails and a common power and data interface, so different non-weapon mission modules can be fitted without changing the airframe.',
    visual: 'Box-section bay with twin ceiling rails and a connector plate on the forward wall.',
    material: 'Light grey interior finish.',
    related: ['bay-doors', 'afcm', 'power'],
    notes: 'Select a module in the Equipment Bay tab to swap it in the viewer.',
    explode: [0, -1.2, 0],
    interfaces: [
      { to: 'power', label: 'Module power' },
      { to: 'afcm', label: 'Module data bus' },
      { to: 'thermal', label: 'Cooling tap' },
    ],
  },
  ...payload('payload-env', 'Atmospheric Survey Pod'),
  ...payload('payload-map', 'Wide-Area Mapping Package'),
  ...payload('payload-relay', 'Communications Relay Module'),
  ...payload('payload-sci', 'Scientific Research Rack'),
  ...payload('payload-test', 'Electronic Systems Test Module'),
  ...payload('payload-inert', 'Inert Training Mass'),
];

function wing(side: 'port' | 'stbd', label: string, sign: number): R[] {
  const other = side === 'port' ? 'stbd' : 'port';
  return [
    {
      id: `wing-${side}`,
      name: `${label} Outer Wing`,
      category: 'Airframe',
      group: 'exterior',
      parent: null,
      location: 'external',
      short: `Swept outer wing panel, ${label.toLowerCase()} side, with two elevons and a drooped tip blade.`,
      fn: 'Generates most of the lift and carries the control surfaces. There is no vertical tail, so the elevons are the primary flight-control effectors in this concept.',
      visual: '40° swept leading edge, notched trailing edge, seam lines marking the leading-edge panel and skin bays.',
      material: 'Graphite-black composite skin; satin elevons.',
      related: [`elevon-${side}-in`, `elevon-${side}-out`, `tip-${side}`, 'structure-spars', `wing-${other}`],
      notes: 'Select the wing, then Enlarge, to pick individual elevons and the tip.',
      explode: [0, 0.15, sign * 1.8],
    },
    {
      id: `elevon-${side}-in`,
      name: `${label} Inboard Elevon`,
      category: 'Flight Controls',
      group: 'exterior',
      parent: `wing-${side}`,
      location: 'external',
      short: 'Inboard trailing-edge control surface.',
      fn: 'Combined pitch and roll control surface. Try the control-surface sliders in the viewer to move it.',
      visual: 'Hinged on the rear spar line at 80 % chord.',
      material: 'Satin composite.',
      related: [`elevon-${side}-out`, 'afcm'],
      notes: 'Deflection limits shown are visual only.',
      explode: [-0.5, 0, sign * 0.2],
    },
    {
      id: `elevon-${side}-out`,
      name: `${label} Outboard Elevon`,
      category: 'Flight Controls',
      group: 'exterior',
      parent: `wing-${side}`,
      location: 'external',
      short: 'Outboard trailing-edge control surface.',
      fn: 'Combined pitch and roll control surface. Outboard position gives greater roll leverage.',
      visual: 'Follows the aft-swept outer trailing edge.',
      material: 'Satin composite.',
      related: [`elevon-${side}-in`, `tip-${side}`],
      notes: 'Visual hinge only.',
      explode: [-0.5, 0, sign * 0.3],
    },
    {
      id: `tip-${side}`,
      name: `${label} Drooped Tip Blade`,
      category: 'Airframe',
      group: 'exterior',
      parent: `wing-${side}`,
      location: 'external',
      short: 'Short downward-curving wingtip, a CX-7 visual signature.',
      fn: 'A stylistic and conceptual tip treatment that ends the wing without a vertical fin.',
      visual: 'Curves down about 0.3 m over the last 0.8 m of span.',
      material: 'Graphite composite.',
      related: [`wing-${side}`],
      notes: 'Any aerodynamic effect is unvalidated.',
      explode: [0, 0, sign * 0.6],
    },
  ];
}

function gear(side: 'nose' | 'port' | 'stbd', name: string, short: string): R[] {
  const id = `gear-${side}`;
  const sign = side === 'port' ? -1 : side === 'stbd' ? 1 : 0;
  return [
    {
      id,
      name,
      category: 'Landing Gear',
      group: 'exterior',
      parent: null,
      location: 'external',
      short,
      fn: 'Supports the aircraft on the ground and during taxi. Shown extended with its doors open.',
      visual: 'Oleo strut, torque link, single wheel and hinged well door.',
      material: 'Light machined-metal strut, dark rubber tyre, composite door.',
      related: side === 'nose' ? ['fwd-fuselage'] : ['ctr-body'],
      notes: 'Enlarge to inspect the strut, wheel and door separately.',
      explode: [0, -0.7, sign * 0.4],
    },
    {
      id: `${id}-strut`,
      name: `${name} — Strut`,
      category: 'Landing Gear',
      group: 'exterior',
      parent: id,
      location: 'external',
      short: 'Oleo-pneumatic shock strut with torque link.',
      fn: 'Absorbs landing and taxi loads and holds the wheel aligned.',
      visual: 'Polished inner cylinder, machined outer cylinder.',
      material: 'Light machined metal.',
      related: [`${id}-wheel`],
      notes: 'Representative proportions.',
    },
    {
      id: `${id}-wheel`,
      name: `${name} — Wheel`,
      category: 'Landing Gear',
      group: 'exterior',
      parent: id,
      location: 'external',
      short: `Single wheel and tyre, ${side === 'nose' ? '0.56' : '0.72'} m diameter (fictional).`,
      fn: 'Rolling contact with the ground; the main wheels include a brake disc in the concept.',
      visual: 'Dark tyre with a machined hub.',
      material: 'Rubber tyre, metal hub.',
      related: [`${id}-strut`],
      notes: 'Diameter is a fictional concept estimate.',
      explode: [0, -0.3, sign * 0.3],
    },
    {
      id: `${id}-doors`,
      name: `${name} — Well Door${side === 'nose' ? 's' : ''}`,
      category: 'Landing Gear',
      group: 'exterior',
      parent: id,
      location: 'external',
      short: 'Hinged well door that closes flush with the lower skin when the gear retracts.',
      fn: 'Seals the gear well in flight. Its edges follow the same seam language as the rest of the lower surface.',
      visual: 'Flat composite panel, shown open.',
      material: 'Graphite composite.',
      related: [id],
      notes: 'Shown in the open position.',
      explode: [0, 0, sign * 0.4 || 0.3],
    },
  ];
}

function panel(id: string, name: string, short: string, over: string[]): R[] {
  return [
    {
      id,
      name,
      category: 'Maintenance Access',
      group: 'maintenance',
      parent: null,
      location: 'external',
      short,
      fn: `Quick-access service panel. Removing it exposes the ${over.join(' and ')} for inspection and replacement without disturbing neighbouring bays.`,
      visual: 'Satin panel with a perimeter seam and countersunk fastener ring.',
      material: 'Satin graphite composite; fasteners shown as small discs.',
      related: over,
      notes: 'Part of the line-replaceable-unit maintenance concept: each module has a dedicated panel.',
      explode: [0, 0.9, 0],
    },
  ];
}

function payload(id: string, name: string): R[] {
  return [
    {
      id,
      name,
      category: 'Equipment Bay',
      group: 'equipment',
      parent: 'bay',
      location: 'internal',
      short: 'Interchangeable mission module (see Equipment Bay tab for details).',
      fn: 'One of six fictional, non-weapon mission modules that use the bay’s common rails and connector.',
      visual: 'See module card.',
      material: 'See module card.',
      related: ['bay', 'bay-doors'],
      notes: 'Only the installed module is shown in the viewer.',
      explode: [0, -0.4, 0],
    },
  ];
}

export const COMPONENTS: ComponentRecord[] = raw.map((r) => ({ isolatable: true, ...r }));
export const COMPONENT_MAP: Record<string, ComponentRecord> = Object.fromEntries(COMPONENTS.map((c) => [c.id, c]));

export const childrenOf = (id: string | null) => COMPONENTS.filter((c) => c.parent === id);
export const hasChildren = (id: string) => COMPONENTS.some((c) => c.parent === id);

/** Ancestor chain from the component up to its top-level ancestor, inclusive. */
export function chainOf(id: string): string[] {
  const out: string[] = [];
  let cur: string | null = id;
  let guard = 0;
  while (cur && guard++ < 20) {
    out.push(cur);
    cur = COMPONENT_MAP[cur]?.parent ?? null;
  }
  return out;
}

export const isDescendant = (id: string, ancestor: string) => chainOf(id).includes(ancestor);
export const topLevelOf = (id: string) => {
  const c = chainOf(id);
  return c[c.length - 1];
};

/**
 * Decide which component a click should select.
 * Normal mode: the top-level assembly. Inside a focused (enlarged) assembly: the child of
 * the focus that contains the hit mesh, so sub-components become pickable.
 */
export function resolvePick(meshComponentId: string, focusId: string | null): string {
  const chain = chainOf(meshComponentId);
  if (focusId) {
    const i = chain.indexOf(focusId);
    if (i > 0) return chain[i - 1];
    if (i === 0) return focusId;
  }
  return chain[chain.length - 1];
}

/** Sum of explode offsets along the ancestor chain. */
export function explodeOffset(id: string): [number, number, number] {
  const o: [number, number, number] = [0, 0, 0];
  for (const c of chainOf(id)) {
    const e = COMPONENT_MAP[c]?.explode;
    if (e) {
      o[0] += e[0];
      o[1] += e[1];
      o[2] += e[2];
    }
  }
  return o;
}

export const GROUP_LABELS: Record<ComponentGroup, string> = {
  exterior: 'Exterior structure',
  interior: 'Interior systems',
  autonomy: 'Navigation & autonomy',
  equipment: 'Equipment modules',
  maintenance: 'Maintenance & access',
};
