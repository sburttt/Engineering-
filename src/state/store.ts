import { create } from 'zustand';

export type Tab = 'overview' | 'exterior' | 'cutaway' | 'internal' | 'autonomy' | 'bay' | 'specs' | 'research';
export type Cutaway = 'exterior' | 'partial' | 'internal';
export type PresetId =
  | 'three-quarter-front'
  | 'front'
  | 'side'
  | 'rear'
  | 'top'
  | 'bottom'
  | 'three-quarter-rear'
  | 'internal'
  | 'overview';
export type ScenarioId = 'nominal' | 'lost-link' | 'sensor-mismatch' | 'health-warning' | 'abort';

export type CameraRequest =
  | { kind: 'preset'; id: PresetId; nonce: number }
  | { kind: 'fit'; id: string; mode: 'enlarge' | 'sub' | 'normal'; nonce: number }
  | { kind: 'zoom'; factor: number; nonce: number };

export const VIEWER_TABS: Tab[] = ['exterior', 'cutaway', 'internal', 'bay'];
export const TAB_ORDER: Tab[] = ['overview', 'exterior', 'cutaway', 'internal', 'autonomy', 'bay', 'specs', 'research'];

interface State {
  tab: Tab;
  selectedId: string | null;
  hoveredId: string | null;
  /** Enlarged / focused assembly (component detail mode). */
  focusId: string | null;
  isolate: boolean;
  cutaway: Cutaway;
  explode: number;
  pitch: number;
  roll: number;
  bayOpen: boolean;
  payloadId: string;
  preset: PresetId | null;
  cameraRequest: CameraRequest | null;
  scenario: ScenarioId;
  researchCategory: string;
  researchQuery: string;
  autoRotate: boolean;
  showGrid: boolean;
  drawer: 'none' | 'systems' | 'inspector';
  renderStatus: 'loading' | 'ready' | 'unavailable';

  setTab: (t: Tab) => void;
  select: (id: string | null, opts?: { fly?: boolean }) => void;
  hover: (id: string | null) => void;
  enlarge: (id: string) => void;
  returnToAircraft: () => void;
  setIsolate: (v: boolean) => void;
  setCutaway: (c: Cutaway) => void;
  setExplode: (v: number) => void;
  setPitch: (v: number) => void;
  setRoll: (v: number) => void;
  setBayOpen: (v: boolean) => void;
  setPayload: (id: string) => void;
  goPreset: (id: PresetId) => void;
  resetView: () => void;
  zoom: (factor: number) => void;
  resetAll: () => void;
  setScenario: (s: ScenarioId) => void;
  setResearchCategory: (c: string) => void;
  setResearchQuery: (q: string) => void;
  setAutoRotate: (v: boolean) => void;
  setShowGrid: (v: boolean) => void;
  setDrawer: (d: State['drawer']) => void;
  setRenderStatus: (s: State['renderStatus']) => void;
}

let nonce = 1;

function initialTab(): Tab {
  try {
    const h = location.hash.replace('#', '') as Tab;
    if (TAB_ORDER.includes(h)) return h;
  } catch {
    /* no location in this context */
  }
  return 'overview';
}

const T0 = initialTab();

export const useStore = create<State>((set, get) => ({
  tab: T0,
  selectedId: null,
  hoveredId: null,
  focusId: null,
  isolate: false,
  cutaway: T0 === 'cutaway' ? 'partial' : T0 === 'internal' ? 'internal' : 'exterior',
  explode: 0,
  pitch: 0,
  roll: 0,
  bayOpen: T0 === 'bay',
  payloadId: 'payload-map',
  preset: 'three-quarter-front',
  cameraRequest: null,
  scenario: 'nominal',
  researchCategory: 'all',
  researchQuery: '',
  autoRotate: false,
  showGrid: true,
  drawer: 'none',
  renderStatus: 'loading',

  setTab: (tab) => {
    const prev = get().tab;
    if (prev === tab) return;
    const patch: Partial<State> = { tab, drawer: 'none' };
    // Each viewer tab sets a sensible starting presentation; the user can change it afterwards.
    if (tab === 'exterior') Object.assign(patch, { cutaway: 'exterior', bayOpen: false });
    if (tab === 'cutaway') Object.assign(patch, { cutaway: 'partial' });
    if (tab === 'internal') Object.assign(patch, { cutaway: 'internal' });
    if (tab === 'bay') Object.assign(patch, { cutaway: 'exterior', bayOpen: true, focusId: null, isolate: false });
    set(patch);
    if (tab === 'bay') get().select('bay', { fly: true });
    else if (tab === 'cutaway' || tab === 'internal') {
      if (!get().selectedId) set({ cameraRequest: { kind: 'preset', id: 'internal', nonce: nonce++ }, preset: 'internal' });
    } else if (tab === 'overview') {
      set({ focusId: null, isolate: false, explode: 0, cutaway: 'exterior', cameraRequest: { kind: 'preset', id: 'three-quarter-front', nonce: nonce++ }, preset: 'three-quarter-front' });
    } else if (tab === 'exterior' && prev === 'overview') {
      set({ cameraRequest: { kind: 'preset', id: 'three-quarter-front', nonce: nonce++ }, preset: 'three-quarter-front' });
    }
  },
  select: (id, opts) => {
    if (id && id.startsWith('payload-')) set({ payloadId: id });
    set({ selectedId: id });
    if (id && opts?.fly !== false) {
      const focus = get().focusId;
      set({ cameraRequest: { kind: 'fit', id, mode: focus ? (focus === id ? 'enlarge' : 'sub') : 'normal', nonce: nonce++ }, preset: null });
    }
  },
  hover: (hoveredId) => get().hoveredId !== hoveredId && set({ hoveredId }),
  enlarge: (id) => set({ focusId: id, selectedId: id, cameraRequest: { kind: 'fit', id, mode: 'enlarge', nonce: nonce++ }, preset: null }),
  returnToAircraft: () =>
    set({ focusId: null, isolate: false, cameraRequest: { kind: 'preset', id: 'three-quarter-front', nonce: nonce++ }, preset: 'three-quarter-front' }),
  setIsolate: (isolate) => {
    const sel = get().selectedId;
    if (isolate && sel) set({ isolate, focusId: get().focusId ?? sel, cameraRequest: { kind: 'fit', id: get().focusId ?? sel, mode: 'enlarge', nonce: nonce++ } });
    else set({ isolate: false });
  },
  setCutaway: (cutaway) => set({ cutaway }),
  setExplode: (explode) => set({ explode }),
  setPitch: (pitch) => set({ pitch }),
  setRoll: (roll) => set({ roll }),
  setBayOpen: (bayOpen) => set({ bayOpen }),
  setPayload: (payloadId) => set({ payloadId, selectedId: payloadId }),
  goPreset: (id) => {
    const patch: Partial<State> = { preset: id, cameraRequest: { kind: 'preset', id, nonce: nonce++ } };
    if (id === 'internal' && get().cutaway === 'exterior') patch.cutaway = 'partial';
    set(patch);
  },
  resetView: () => get().goPreset('three-quarter-front'),
  zoom: (factor) => set({ cameraRequest: { kind: 'zoom', factor, nonce: nonce++ }, preset: null }),
  /** Restores the viewer to its initial state; research filters and display preferences are kept. */
  resetAll: () =>
    set({
      selectedId: null,
      focusId: null,
      isolate: false,
      cutaway: get().tab === 'cutaway' ? 'partial' : get().tab === 'internal' ? 'internal' : 'exterior',
      explode: 0,
      pitch: 0,
      roll: 0,
      bayOpen: get().tab === 'bay',
      preset: 'three-quarter-front',
      cameraRequest: { kind: 'preset', id: 'three-quarter-front', nonce: nonce++ },
    }),
  setScenario: (scenario) => set({ scenario }),
  setResearchCategory: (researchCategory) => set({ researchCategory }),
  setResearchQuery: (researchQuery) => set({ researchQuery }),
  setAutoRotate: (autoRotate) => set({ autoRotate }),
  setShowGrid: (showGrid) => set({ showGrid }),
  setDrawer: (drawer) => set({ drawer }),
  setRenderStatus: (renderStatus) => set({ renderStatus }),
}));
