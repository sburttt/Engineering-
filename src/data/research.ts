/**
 * Research Library — public-source notes on reference programmes.
 * Labels:
 *   VERIFIED  = VERIFIED PUBLIC INFORMATION (stated by an official or reputable public source linked below)
 *   INTERP    = RESEARCH-BASED INTERPRETATION (our reading of public information; not an official statement)
 *   FICTIONAL = FICTIONAL DESIGN DECISION (what the CX-7 concept took from it)
 * Sources were gathered by web search in October 2026. Figures change; check the linked source for current status.
 */

export type Label = 'VERIFIED' | 'INTERP' | 'FICTIONAL';
export const LABEL_TEXT: Record<Label, string> = {
  VERIFIED: 'VERIFIED PUBLIC INFORMATION',
  INTERP: 'RESEARCH-BASED INTERPRETATION',
  FICTIONAL: 'FICTIONAL DESIGN DECISION',
};

export interface Claim {
  text: string;
  label: Label;
}
export interface Source {
  title: string;
  url: string;
}
export interface ResearchEntry {
  id: string;
  name: string;
  org: string;
  category: string;
  overview: Claim[];
  design: Claim[];
  autonomy: Claim[];
  learned: Claim[];
  sources: Source[];
  matrix: { configuration: string; crew: string; mission: string; autonomy: string; carriage: string };
}

export const RESEARCH_CATEGORIES = [
  'Fifth-generation fighter',
  'Stealth bomber',
  'Uncrewed combat demonstrator',
  'Collaborative combat aircraft',
  'Autonomy research & policy',
  'Aerodynamic research',
];

const V = (text: string): Claim => ({ text, label: 'VERIFIED' });
const I = (text: string): Claim => ({ text, label: 'INTERP' });
const F = (text: string): Claim => ({ text, label: 'FICTIONAL' });

export const RESEARCH: ResearchEntry[] = [
  {
    id: 'f22',
    name: 'F-22 Raptor',
    org: 'Lockheed Martin (with Boeing) · U.S. Air Force',
    category: 'Fifth-generation fighter',
    overview: [
      V('Single-seat fighter that the Air Force fact sheet describes as combining low observability, supercruise, manoeuvrability and integrated avionics.'),
      V('The 2015 fact sheet lists initial operating capability in December 2005.'),
    ],
    design: [
      I('Twin engines, twin canted vertical tails and a diamond-like wing; aligned edges and internal weapons bays are visible in public imagery.'),
      I('Consistent edge alignment across the planform gives the aircraft a very disciplined visual identity.'),
    ],
    autonomy: [I('Crewed aircraft; public material emphasises sensor fusion to support the pilot rather than autonomy.')],
    learned: [F('CX-7 adopts the idea of a disciplined, repeating edge language — its seams and panel edges follow a small set of directions — without copying the F-22’s tails or planform.')],
    sources: [
      { title: 'U.S. Air Force — F-22 Raptor fact sheet', url: 'https://www.af.mil/About-Us/Fact-Sheets/Display/Article/104506/f-22-raptor/' },
      { title: 'Air Combat Command — F-22 Raptor fact sheet', url: 'https://www.acc.af.mil/About-Us/Fact-Sheets/Display/Article/660143/f-22-raptor/' },
    ],
    matrix: { configuration: 'Twin-tail, diamond wing', crew: '1 pilot', mission: 'Air dominance', autonomy: 'Crewed', carriage: 'Internal bays (primary)' },
  },
  {
    id: 'f35',
    name: 'F-35 Lightning II',
    org: 'Lockheed Martin · Joint Program',
    category: 'Fifth-generation fighter',
    overview: [
      V('Single-engine, single-seat multirole fighter family (F-35A conventional take-off, F-35B short take-off/vertical landing, F-35C carrier).'),
      V('Air & Space Forces Magazine lists first flight on 15 Dec 2006 and F-35A initial operating capability on 2 Aug 2016.'),
    ],
    design: [
      I('A single large engine and a compact, chined forebody; internal bays with optional external stations.'),
      I('Public material stresses fused sensor information presented to one pilot.'),
    ],
    autonomy: [I('Crewed; the relevant lesson is sensor fusion and how information is presented to an operator.')],
    learned: [F('CX-7 borrows the “fused picture” idea for its supervisory interface: the operator sees summarised states, not raw sensor feeds.')],
    sources: [
      { title: 'Joint Base Andrews — F-35A Lightning II fact sheet', url: 'https://www.jba.af.mil/About/Fact-Sheets/Display/Article/4282149/f-35a-lightning-ii' },
      { title: 'Air & Space Forces Magazine — F-35 Lightning II', url: 'https://www.airandspaceforces.com/weapons/f-35/' },
    ],
    matrix: { configuration: 'Conventional tailed, single engine', crew: '1 pilot', mission: 'Multirole', autonomy: 'Crewed', carriage: 'Internal + external' },
  },
  {
    id: 'b2',
    name: 'B-2 Spirit',
    org: 'Northrop Grumman · U.S. Air Force',
    category: 'Stealth bomber',
    overview: [
      V('Multi-role bomber able to deliver conventional and nuclear munitions (Air Force Global Strike Command fact sheet).'),
      V('The fact sheet attributes its low observability to a combination of reduced infrared, acoustic, electromagnetic, visual and radar signatures.'),
      V('Unrefuelled range is given as approximately 6,000 nautical miles.'),
    ],
    design: [
      I('Tailless flying wing with a saw-tooth trailing edge and engines buried in the wing, fed by dorsal inlets.'),
      I('No vertical tail: directional control comes from surfaces on the wing trailing edge.'),
    ],
    autonomy: [V('Crewed by two pilots.')],
    learned: [
      F('CX-7 is also tailless with dorsal-mounted inlet air, but it uses a single raked centreline inlet and a cranked arrow planform rather than a pure flying wing.'),
    ],
    sources: [
      { title: 'AFGSC — B-2 Spirit fact sheet', url: 'https://www.afgsc.af.mil/About/Fact-Sheets/Article/630717/b-2-spirit/' },
      { title: 'Whiteman AFB — B-2 Spirit fact sheet', url: 'https://www.whiteman.af.mil/About/Fact-Sheets/Display/Article/886024/' },
    ],
    matrix: { configuration: 'Tailless flying wing', crew: '2 pilots', mission: 'Long-range strike', autonomy: 'Crewed', carriage: 'Internal' },
  },
  {
    id: 'b21',
    name: 'B-21 Raider',
    org: 'Northrop Grumman · U.S. Air Force',
    category: 'Stealth bomber',
    overview: [
      V('Long-range strategic bomber in development; first aircraft unveiled at Palmdale on 2 Dec 2022 and first flight on 10 Nov 2023.'),
      V('Most physical specifications remain classified.'),
    ],
    design: [I('Public imagery shows a flying-wing planform similar in spirit to the B-2 but with a simpler trailing edge.')],
    autonomy: [I('Public reporting has discussed optional crewing; this is not confirmed as a current capability in the sources used here.')],
    learned: [F('CX-7 deliberately avoids quoting classified-style numbers. Like the B-21’s public material, it publishes broad dimensions only and marks everything else as not established.')],
    sources: [
      { title: 'Air & Space Forces Magazine — B-21 Raider', url: 'https://www.airandspaceforces.com/weapons/b-21/' },
      { title: 'Wikipedia — Northrop Grumman B-21 Raider (secondary)', url: 'https://en.wikipedia.org/wiki/Northrop_Grumman_B-21_Raider' },
    ],
    matrix: { configuration: 'Tailless flying wing', crew: 'Crewed (optional crewing discussed)', mission: 'Long-range strike', autonomy: 'Not public', carriage: 'Internal' },
  },
  {
    id: 'su57',
    name: 'Su-57',
    org: 'Sukhoi / United Aircraft Corporation',
    category: 'Fifth-generation fighter',
    overview: [
      V('Maiden flight on 29 Jan 2010 (as PAK FA); officially named Su-57 in August 2017 (TASS / UAC statements).'),
      V('UAC describes internal armament and radar-absorbing coatings.'),
    ],
    design: [I('Widely spaced engines with a long tunnel between them used for internal bays; movable leading-edge root extensions.')],
    autonomy: [I('Crewed. Delivery numbers and operational performance are not independently verified in public sources.')],
    learned: [F('CX-7 uses the space between major masses as a bay: its equipment bay sits under the centreline duct, between the main gear wells.')],
    sources: [
      { title: 'TASS — UAC builds up potential to produce more Su-57 fighters', url: 'https://tass.com/defense/1556829/amp' },
      { title: 'AirDataNews — Su-57 delivery reporting (secondary)', url: 'https://www.airdatanews.com/russia-receives-new-batch-of-su-57-fighters-with-updated-onboard-systems-uac-says/' },
    ],
    matrix: { configuration: 'Tailed, wide engine spacing', crew: '1 pilot', mission: 'Multirole', autonomy: 'Crewed', carriage: 'Internal + external' },
  },
  {
    id: 'j20',
    name: 'J-20',
    org: 'Chengdu Aircraft Corporation',
    category: 'Fifth-generation fighter',
    overview: [I('Twin-engine fighter; official design data is limited, so most public descriptions are analyst estimates.')],
    design: [
      I('Canard-delta layout with twin canted fins. An engineer interviewed by Hushkit suggests the layout favours internal fuel and a long weapons bay.'),
      I('A Virginia Tech student study estimates geometry from three-view drawings — useful for proportions, but an estimate, not official data.'),
    ],
    autonomy: [I('Crewed; no autonomy claims are used here.')],
    learned: [F('CX-7 takes the long, slender forebody proportion, but drops the canards and fins to stay tailless.')],
    sources: [
      { title: 'Hushkit — What does the J-20’s configuration reveal?', url: 'https://hushkit.net/2018/01/03/ask-the-expert-what-does-the-j-20s-configuration-reveal' },
      { title: 'Virginia Tech — J-20 configuration study (student project)', url: 'https://archive.aoe.vt.edu/mason/Mason_f/J20Spr11.pdf' },
    ],
    matrix: { configuration: 'Canard-delta, twin fins', crew: '1 pilot', mission: 'Air superiority / strike', autonomy: 'Crewed', carriage: 'Internal' },
  },
  {
    id: 'x47b',
    name: 'X-47B',
    org: 'Northrop Grumman · U.S. Navy (UCAS-D)',
    category: 'Uncrewed combat demonstrator',
    overview: [
      V('Tailless uncrewed demonstrator; first catapult launch from a carrier on 14 May 2013 and first arrested landing aboard USS George H.W. Bush on 10 Jul 2013.'),
    ],
    design: [I('Cranked-kite tailless planform with a single dorsal inlet and folding outer wings for deck handling.')],
    autonomy: [
      V('Reporting describes onboard software flying the aircraft while a mission operator monitors and can intervene, rather than a pilot flying it remotely.'),
    ],
    learned: [
      F('CX-7’s supervision model follows this split: the aircraft manages flight, and the human sets and authorises intent. Its dorsal inlet is raked and wider than the X-47B’s.'),
    ],
    sources: [
      { title: 'Military & Aerospace Electronics — X-47B lands on carrier', url: 'https://www.militaryaerospace.com/uncrewed/article/16715856/x-47b-unmanned-fighter-drone-lands-on-carrier-ushers-in-new-era-of-unmanned-carrier-aviation' },
      { title: 'Air & Space Forces Magazine — First-ever carrier landing with unmanned autonomous aircraft', url: 'https://www.airandspaceforces.com/first-ever-carrier-landing-with-unmanned-autonomous-aircraft' },
    ],
    matrix: { configuration: 'Tailless cranked kite', crew: 'Uncrewed', mission: 'Carrier demonstration', autonomy: 'Supervised autonomy', carriage: 'Internal bays' },
  },
  {
    id: 'mq28',
    name: 'MQ-28A Ghost Bat',
    org: 'Boeing Defence Australia · Royal Australian Air Force',
    category: 'Collaborative combat aircraft',
    overview: [
      V('Developed under the RAAF Loyal Wingman programme; prototype first flew on 27 Feb 2021; named MQ-28A Ghost Bat in March 2022.'),
    ],
    design: [I('Conventional-looking uncrewed jet with a single engine and a nose section that public material describes as modular for different mission payloads.')],
    autonomy: [I('Designed to team with crewed aircraft; public sources describe it as uncrewed and highly automated.')],
    learned: [F('CX-7 takes the swappable-mission idea and moves it into a ventral bay with standard rails and one shared connector.')],
    sources: [
      { title: 'Boeing — MQ-28A Ghost Bat naming announcement', url: 'https://boeing.mediaroom.com/news-releases-statements?item=131020' },
      { title: 'Designation-Systems.net — MQ-28', url: 'https://designation-systems.net/dusrm/app2/mq-28.html' },
    ],
    matrix: { configuration: 'Conventional, single engine', crew: 'Uncrewed', mission: 'Crewed-uncrewed teaming', autonomy: 'High automation, human-directed', carriage: 'Modular nose payload' },
  },
  {
    id: 'xq67',
    name: 'XQ-67A',
    org: 'General Atomics Aeronautical · AFRL (OBSS)',
    category: 'Uncrewed combat demonstrator',
    overview: [
      V('Built for AFRL’s Off-Board Sensing Station programme; unveiled in February 2024 with first flight on 28 Feb 2024.'),
      V('AFRL describes a “common chassis” approach in which several aircraft variants share core structure and systems.'),
    ],
    design: [I('Derived from GA-ASI’s Gambit family; shares major subsystems across variants.')],
    autonomy: [I('Uncrewed sensing aircraft intended to operate ahead of crewed aircraft.')],
    learned: [F('CX-7 is described as a “base airframe” whose bays and connectors are standardised, which mirrors the common-chassis idea.')],
    sources: [
      { title: 'GovConWire / ExecutiveBiz — GA-ASI unveils Off-Board Sensing Station', url: 'https://www.executivebiz.com/2024/02/ga-asi-unveils-new-off-board-sensing-station-developed-with-afrl/' },
      { title: 'Wikipedia — General Atomics XQ-67A (secondary)', url: 'https://en.wikipedia.org/wiki/General_Atomics_XQ-67A' },
    ],
    matrix: { configuration: 'Conventional, dorsal inlet', crew: 'Uncrewed', mission: 'Off-board sensing', autonomy: 'Supervised autonomy', carriage: 'Internal' },
  },
  {
    id: 'xq58',
    name: 'XQ-58A Valkyrie',
    org: 'Kratos · AFRL',
    category: 'Uncrewed combat demonstrator',
    overview: [
      V('Long-range, high-subsonic uncrewed aircraft developed with AFRL; first flight 5 Mar 2019 at Yuma Proving Ground.'),
      V('Rocket-assisted launch from a trailer and parachute/airbag recovery make it runway-independent; it has an internal bay.'),
    ],
    design: [I('Dorsal inlet, V-tail, chined fuselage and a strong focus on low cost.')],
    autonomy: [V('Used in the Skyborg autonomy flight series (Kratos / AFRL releases).')],
    learned: [F('CX-7 keeps runway gear (a design choice for this concept) but borrows the cost-conscious, modular approach to maintenance access.')],
    sources: [
      { title: 'National Museum of the USAF — Kratos XQ-58A Valkyrie', url: 'https://www.nationalmuseum.af.mil/Visit/Museum-Exhibits/Fact-Sheets/Display/Article/3209939/kratos-xq-58a-valkyrie/' },
      { title: 'AFRL — XQ-58A Tail 1 prepares for transfer to museum', url: 'https://www.afrl.af.mil/News/Article/2705164/xq-58a-valkyrie-tail-1-prepares-for-transfer-to-air-force-museum/' },
    ],
    matrix: { configuration: 'V-tail, dorsal inlet', crew: 'Uncrewed', mission: 'Attritable demonstrator', autonomy: 'Autonomy test platform', carriage: 'Internal bay' },
  },
  {
    id: 'cca',
    name: 'Collaborative Combat Aircraft (Increment 1)',
    org: 'U.S. Air Force · General Atomics (YFQ-42A) · Anduril (YFQ-44A)',
    category: 'Collaborative combat aircraft',
    overview: [
      V('The Air Force designated the two Increment 1 prototypes YFQ-42A and YFQ-44A; both entered flight test in 2025 (YFQ-42A in late August, YFQ-44A on 31 Oct 2025).'),
      I('An Increment 1 production decision was expected in fiscal 2026; the sources used here do not confirm the outcome.'),
    ],
    design: [I('Both are conventional, fighter-sized uncrewed jets designed to operate alongside crewed fighters.')],
    autonomy: [I('Designed to fly with crewed aircraft; humans direct mission intent.')],
    learned: [F('CX-7’s autonomy tab treats “teaming” as coordination under human supervision, not independent operation.')],
    sources: [
      { title: 'Aviation Today — GA YFQ-42A first CCA to fly', url: 'https://www.aviationtoday.com/2025/09/04/general-atomics-yfq-42a-first-cca-forerunner-to-fly/' },
      { title: 'The Aviationist — Anduril YFQ-44A first flight', url: 'https://theaviationist.com/2025/10/31/anduril-yfq-44a-cca-first-flight/' },
    ],
    matrix: { configuration: 'Conventional uncrewed jets', crew: 'Uncrewed', mission: 'Crewed-uncrewed teaming', autonomy: 'Supervised autonomy', carriage: 'Programme-dependent' },
  },
  {
    id: 'ace',
    name: 'DARPA ACE / X-62A VISTA',
    org: 'DARPA · USAF Test Pilot School · AFRL',
    category: 'Autonomy research & policy',
    overview: [
      V('AI agents controlled the X-62A (a modified F-16 test aircraft) in flight from December 2022.'),
      V('In 2024 the Air Force and DARPA reported within-visual-range test engagements against a crewed F-16, with safety pilots on board the X-62A.'),
    ],
    design: [I('A crewed test aircraft acting as a safe host for autonomy software, with a human able to take control at any time.')],
    autonomy: [V('DARPA describes ACE’s goal as trusted, scalable, human-level, AI-driven autonomy, with human-machine teaming as the challenge problem.')],
    learned: [F('CX-7 treats trust as something that is built through test evidence; every capability in its matrix needs simulation, hardware-in-the-loop and flight evidence.')],
    sources: [
      { title: 'DefenseScoop — AI agents take control of modified F-16', url: 'https://defensescoop.com/2023/02/14/ai-agents-take-control-of-modified-f-16-fighter-jet/' },
      { title: 'ExecutiveGov — Air Force, DARPA demo machine-learning autonomy on X-62A', url: 'https://executivegov.com/2024/04/air-force-darpa-demo-machine-learning-based-autonomy-using-x62a-vista-aircraft/' },
    ],
    matrix: { configuration: 'Modified F-16 test aircraft', crew: 'Safety pilot on board', mission: 'Autonomy research', autonomy: 'Experimental AI control', carriage: 'n/a' },
  },
  {
    id: 'dodd3000',
    name: 'DoD Directive 3000.09',
    org: 'U.S. Department of Defense',
    category: 'Autonomy research & policy',
    overview: [
      V('Policy on autonomy in weapon systems, first issued in 2012 and reissued effective 25 Jan 2023.'),
      V('Requires that systems allow commanders and operators to exercise “appropriate levels of human judgment over the use of force”.'),
    ],
    design: [I('Policy, not hardware: it sets review and approval steps before such systems are developed and fielded.')],
    autonomy: [I('Distinguishes autonomous, semi-autonomous and operator-supervised systems.')],
    learned: [F('CX-7 is a non-weapon concept. Its architecture still assumes that consequential mission changes always need explicit human authorisation, and that this is audited.')],
    sources: [
      { title: 'DoD Directives Division — DoDD 3000.09 (PDF)', url: 'https://www.esd.whs.mil/Portals/54/Documents/DD/issuances/dodd/300009p.PDF' },
      { title: 'CNAS — Noteworthy: DoD autonomous weapons policy (2023)', url: 'https://www.cnas.org/press/press-note/noteworthy-dod-autonomous-weapons-policy' },
    ],
    matrix: { configuration: 'n/a (policy)', crew: 'n/a', mission: 'Governance', autonomy: 'Human judgment required', carriage: 'n/a' },
  },
  {
    id: 'bwb',
    name: 'Blended-Wing-Body research',
    org: 'NASA / McDonnell Douglas / Boeing',
    category: 'Aerodynamic research',
    overview: [
      V('A 1996 paper by Liebeck, Page and Rawdon (NASA NTRS 19960023625) compared a blended-wing-body transport with a conventional design and reported lower fuel burn and higher lift-to-drag for the BWB.'),
    ],
    design: [I('A thick centre body that carries payload and blends into thinner outer wings, removing the separate fuselage.')],
    autonomy: [I('Not applicable; included for configuration insight.')],
    learned: [F('CX-7’s centre body uses the same blending idea at a much smaller scale: one shared height function makes the body and the wings into a single surface.')],
    sources: [{ title: 'NASA NTRS — Blended-wing-body subsonic commercial transport (1996)', url: 'https://ntrs.nasa.gov/citations/19960023625' }],
    matrix: { configuration: 'Blended wing body', crew: 'n/a (transport study)', mission: 'Research', autonomy: 'n/a', carriage: 'Internal' },
  },
];
