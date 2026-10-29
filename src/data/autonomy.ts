/**
 * CX-7 conceptual autonomy architecture — FICTIONAL. Not a real, certified or operational system.
 * The simulation below uses invented data only and is not connected to anything.
 */
import type { ScenarioId } from '../state/store';

export interface Layer {
  id: string;
  name: string;
  short: string;
  detail: string;
  x: number;
  y: number;
}

export const LAYERS: Layer[] = [
  { id: 'oversight', name: 'Human supervisory oversight', short: 'Sets intent, authorises changes', x: 400, y: 50,
    detail: 'People set the mission intent and limits before flight. Any consequential change, such as a new route, entering a new area or ending the mission early, needs explicit approval from an operator. The aircraft can propose a change but cannot approve it.' },
  { id: 'mission', name: 'Mission management', short: 'Plans within approved limits', x: 400, y: 150,
    detail: 'Breaks the approved mission into tasks and checks each one against the limits set by operators: geographic boundaries, timing and equipment-module use.' },
  { id: 'flight', name: 'Flight management', short: 'Route, energy and envelope', x: 230, y: 250,
    detail: 'Turns tasks into routes and speed and altitude targets, and keeps the aircraft inside its conceptual flight envelope. Lower-level control laws are outside the scope of this concept.' },
  { id: 'nav', name: 'Navigation & state estimation', short: 'Where am I, how sure am I', x: 70, y: 350,
    detail: 'Blends inertial, satellite and terrain-reference inputs into one estimate of position and attitude, plus a confidence value. Low confidence is treated as a fault, not ignored.' },
  { id: 'sensors', name: 'Sensor data processing', short: 'Raw data → summarised states', x: 230, y: 350,
    detail: 'Turns aperture and module data into compact summaries. It also cross-checks sources, so inconsistent sensor data is reported instead of being silently merged.' },
  { id: 'health', name: 'System-health monitoring', short: 'Power, thermal, compute, links', x: 570, y: 250,
    detail: 'Monitors power channels, temperatures, computing lanes and link quality continuously, and passes warnings up to mission management and the operator.' },
  { id: 'comms', name: 'Communication & coordination', short: 'Supervisor link + audit', x: 730, y: 150,
    detail: 'Carries commands, telemetry and the audit log. Link loss starts a pre-approved lost-link procedure defined before flight.' },
  { id: 'fault', name: 'Fault detection & recovery planning', short: 'Detect, isolate, propose', x: 570, y: 350,
    detail: 'Isolates faults and proposes recovery options ranked by safety. Proposals that change the mission are sent to a human; only pre-approved safe-state actions can run on their own.' },
  { id: 'safe', name: 'Safe-state & abort logic', short: 'Pre-approved fallbacks', x: 400, y: 450,
    detail: 'A small, independently checked set of fallback behaviours (hold, return along an approved corridor, terminate the simulation) with clearly defined entry conditions. Kept deliberately simple so it can be verified.' },
];

export const LINKS: [string, string][] = [
  ['oversight', 'mission'],
  ['oversight', 'comms'],
  ['mission', 'flight'],
  ['mission', 'health'],
  ['flight', 'nav'],
  ['flight', 'sensors'],
  ['nav', 'sensors'],
  ['health', 'fault'],
  ['comms', 'health'],
  ['comms', 'mission'],
  ['fault', 'safe'],
  ['flight', 'safe'],
  ['sensors', 'fault'],
  ['nav', 'safe'],
];

export const LEVELS = [
  { name: 'Remote piloting', who: 'A person flies the aircraft through a datalink, moment to moment.', cx7: false },
  { name: 'Automated flight functions', who: 'The aircraft holds altitude, heading or a route; a person chooses what it does and monitors it.', cx7: false },
  { name: 'Supervised autonomy', who: 'The aircraft plans and flies tasks itself; people set intent and limits and approve consequential changes.', cx7: true },
  { name: 'High-level mission autonomy', who: 'The aircraft re-plans whole missions with minimal supervision. Not claimed by CX-7.', cx7: false },
];

export const CAPABILITIES = [
  { feature: 'Route following within approved corridors', purpose: 'Reduce operator workload', validation: 'Simulation, hardware-in-the-loop, envelope expansion flights', status: 'Conceptual' },
  { feature: 'State estimate with confidence reporting', purpose: 'Detect degraded navigation early', validation: 'Sensor-fault injection tests, flight data review', status: 'Conceptual' },
  { feature: 'Continuous health monitoring', purpose: 'Early warning of power, thermal or compute faults', validation: 'Bench testing, failure-modes analysis', status: 'Conceptual' },
  { feature: 'Lost-link procedure', purpose: 'Predictable behaviour without a link', validation: 'Scenario simulation, regulator review', status: 'Conceptual' },
  { feature: 'Recovery proposals for operator approval', purpose: 'Keep humans in charge of mission changes', validation: 'Human-factors trials, simulation', status: 'Conceptual' },
  { feature: 'Safe-state fallback set', purpose: 'Bounded, verifiable behaviour under faults', validation: 'Formal verification, independent safety assessment', status: 'Conceptual' },
  { feature: 'Tamper-evident audit log', purpose: 'Accountability and post-flight review', validation: 'Security review, data-integrity tests', status: 'Conceptual' },
];

export const SAFETY = [
  { title: 'Loss-of-communication handling', text: 'A lost-link procedure is approved before flight. The aircraft holds, then follows a pre-approved corridor; it never makes up a new mission.' },
  { title: 'System-health monitoring', text: 'Power, thermal, computing lanes and links are monitored continuously, and any warning is shown to the operator straight away.' },
  { title: 'Human authorisation', text: 'Route changes, area changes and mission end require explicit operator approval, recorded with time and operator ID.' },
  { title: 'Defined abort conditions', text: 'Abort triggers are listed in advance (for example, low navigation confidence or an unrecoverable fault), not decided in flight.' },
  { title: 'Flight-envelope monitoring', text: 'Planned manoeuvres are checked against conceptual envelope limits before they are commanded.' },
  { title: 'Safe termination of an invalid simulation', text: 'If simulation inputs become inconsistent, the run stops and is flagged. The simulator never continues on bad data.' },
  { title: 'Independent verification', text: 'The safe-state logic is kept small and separate from mission software so it can be checked independently.' },
  { title: 'Audit logging & operator awareness', text: 'Every decision, proposal and approval is logged for review after the run.' },
];

export interface ScenarioEvent {
  t: number;
  level: 'info' | 'caution' | 'warning';
  msg: string;
}
export interface Scenario {
  id: ScenarioId;
  name: string;
  summary: string;
  mode: string;
  safeState: string;
  severity: 'nominal' | 'caution' | 'warning';
  telemetry: { link: number; nav: number; health: number; margin: number };
  affected: string[];
  events: ScenarioEvent[];
  authorisation?: { prompt: string; approve: string; hold: string; approvedMsg: string; heldMsg: string };
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'nominal',
    name: 'Normal simulated operation',
    summary: 'All layers healthy. The aircraft follows its approved route; the operator monitors.',
    mode: 'ROUTE FOLLOW · SUPERVISED',
    safeState: 'Not required',
    severity: 'nominal',
    telemetry: { link: 98, nav: 96, health: 100, margin: 82 },
    affected: [],
    events: [
      { t: 0, level: 'info', msg: 'SIM START — synthetic data only' },
      { t: 1, level: 'info', msg: 'Mission plan v3 loaded (operator approved 08:12Z)' },
      { t: 2, level: 'info', msg: 'Route leg 2 of 5 active' },
      { t: 4, level: 'info', msg: 'Health check: all channels nominal' },
    ],
  },
  {
    id: 'lost-link',
    name: 'Communication interruption',
    summary: 'The supervisory link drops. The aircraft runs the pre-approved lost-link procedure and keeps trying to reconnect.',
    mode: 'LOST-LINK PROCEDURE',
    safeState: 'Hold, then pre-approved return corridor',
    severity: 'caution',
    telemetry: { link: 0, nav: 95, health: 97, margin: 78 },
    affected: ['comms', 'oversight', 'safe'],
    events: [
      { t: 0, level: 'caution', msg: 'Supervisor link lost (simulated)' },
      { t: 1, level: 'info', msg: 'Lost-link timer started (pre-approved: 120 s)' },
      { t: 2, level: 'info', msg: 'Holding at current waypoint; no new tasks accepted' },
      { t: 4, level: 'caution', msg: 'Timer expired → entering approved return corridor A' },
      { t: 5, level: 'info', msg: 'Reconnection attempts continuing on backup path' },
    ],
  },
  {
    id: 'sensor-mismatch',
    name: 'Sensor-data inconsistency',
    summary: 'Two navigation sources disagree. Confidence drops, the planner pauses new tasks and asks the operator.',
    mode: 'DEGRADED NAV · AWAITING OPERATOR',
    safeState: 'Hold pattern pending authorisation',
    severity: 'caution',
    telemetry: { link: 97, nav: 41, health: 96, margin: 70 },
    affected: ['nav', 'sensors', 'fault', 'oversight'],
    events: [
      { t: 0, level: 'caution', msg: 'Nav source disagreement > threshold (synthetic)' },
      { t: 1, level: 'info', msg: 'Faulty source isolated; confidence 41 %' },
      { t: 2, level: 'info', msg: 'New tasks paused; holding' },
      { t: 3, level: 'caution', msg: 'Proposal sent: return to base via corridor A' },
    ],
    authorisation: {
      prompt: 'Recovery proposal: return to base via approved corridor A. Authorise?',
      approve: 'Authorise return',
      hold: 'Continue holding',
      approvedMsg: 'Operator OP-2 authorised return (logged)',
      heldMsg: 'Operator OP-2 chose to continue holding (logged)',
    },
  },
  {
    id: 'health-warning',
    name: 'System-health warning',
    summary: 'A power channel overheats. Load is moved to the redundant channel and the operator is told.',
    mode: 'REDUCED REDUNDANCY',
    safeState: 'Mission continues inside reduced limits',
    severity: 'caution',
    telemetry: { link: 96, nav: 94, health: 64, margin: 61 },
    affected: ['health', 'fault', 'mission'],
    events: [
      { t: 0, level: 'caution', msg: 'Power channel B temperature high (synthetic)' },
      { t: 1, level: 'info', msg: 'Load shed: channel B → channel A' },
      { t: 2, level: 'info', msg: 'Equipment module power reduced to 60 %' },
      { t: 3, level: 'caution', msg: 'Mission limits tightened; operator notified' },
    ],
  },
  {
    id: 'abort',
    name: 'Simulated mission abort',
    summary: 'Defined abort conditions are met. The aircraft proposes ending the mission; the operator approves, and the simulation ends cleanly.',
    mode: 'ABORT · SAFE STATE',
    safeState: 'Return corridor A → simulation terminated',
    severity: 'warning',
    telemetry: { link: 92, nav: 88, health: 52, margin: 35 },
    affected: ['fault', 'safe', 'oversight', 'mission'],
    events: [
      { t: 0, level: 'warning', msg: 'Abort condition 3 met: compute lane disagreement' },
      { t: 1, level: 'info', msg: 'Remaining lane healthy; abort proposed to operator' },
      { t: 2, level: 'warning', msg: 'Awaiting human authorisation' },
    ],
    authorisation: {
      prompt: 'Abort proposal: end mission and return via corridor A. Authorise?',
      approve: 'Authorise abort',
      hold: 'Hold and review',
      approvedMsg: 'Abort authorised by OP-1 → simulation terminated safely (logged)',
      heldMsg: 'Operator OP-1 holding for review; aircraft in hold pattern (logged)',
    },
  },
];
