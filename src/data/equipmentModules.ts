/** Fictional, non-weapon mission modules for the CX-7 equipment bay. */
export interface EquipmentModule {
  id: string;
  name: string;
  role: string;
  dims: string;
  location: string;
  interfaces: string[];
  status: string;
}

const LOC = 'Ventral equipment bay, X −1.2 m to +1.8 m, on twin ceiling rails';
const STATUS = 'Design concept — not built or tested';

export const EQUIPMENT_MODULES: EquipmentModule[] = [
  {
    id: 'payload-map',
    name: 'Wide-Area Mapping Package',
    role: 'Downward-looking imaging for terrain mapping and survey narratives.',
    dims: '≈ 2.2 × 0.8 × 0.36 m (incl. turret)',
    location: LOC,
    interfaces: ['Common bay connector (power + data)', 'Sensor-processing module (data products)', 'Thermal tap (cooling)'],
    status: STATUS,
  },
  {
    id: 'payload-env',
    name: 'Atmospheric Survey Pod',
    role: 'Environmental observation: sampling inlets and a sensor dome for atmospheric research.',
    dims: '≈ 2.1 m long, Ø 0.34 m',
    location: LOC,
    interfaces: ['Common bay connector', 'Navigation module (time & position tagging)'],
    status: STATUS,
  },
  {
    id: 'payload-relay',
    name: 'Communications Relay Module',
    role: 'Extends line-of-sight links between ground stations using three flat-panel antennas.',
    dims: '≈ 2.0 × 0.72 × 0.3 m',
    location: LOC,
    interfaces: ['Common bay connector', 'Communications module (link management)'],
    status: STATUS,
  },
  {
    id: 'payload-sci',
    name: 'Scientific Research Rack',
    role: 'Six canister slots for university or laboratory experiments.',
    dims: '≈ 2.3 × 0.72 × 0.37 m',
    location: LOC,
    interfaces: ['Common bay connector', 'Flight-computing module (experiment scheduler)'],
    status: STATUS,
  },
  {
    id: 'payload-test',
    name: 'Electronic Systems Test Module',
    role: 'Hosts new avionics hardware for evaluation, with an integrated heat-sink tray.',
    dims: '≈ 2.2 × 0.72 × 0.36 m',
    location: LOC,
    interfaces: ['Common bay connector', 'Thermal tap', 'Isolated test data bus'],
    status: STATUS,
  },
  {
    id: 'payload-inert',
    name: 'Inert Training Mass',
    role: 'Non-functional ballast that represents module mass during ground handling and simulation.',
    dims: '≈ 2.2 × 0.7 × 0.3 m',
    location: LOC,
    interfaces: ['Mechanical rails only'],
    status: STATUS,
  },
];
