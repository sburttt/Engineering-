import { create } from 'zustand';
import { COMPONENT_MAP } from '../data/components';

/** Pages. The aircraft viewer is the home page; the others are editorial documents. */
export type Tab = 'aircraft' | 'overview' | 'autonomy' | 'specs' | 'research';
/** What the viewer shows: the closed aircraft, a partial cutaway, the internal systems, or the open payload bay. */
export type ViewMode = 'exterior' | 'cutaway' | 'systems' | 'payload';
export type Cutaway = 'exterior' | 'partial' | 'internal';
export type PresetId = 'hero' | 'front' | 'side' | 'top' | 'rear' | 'under' | 'internal';
export type ScenarioId = 'nominal' | 'lost-link' | 'sensor-mismatch' | 'health-warning' | 'abort';

export type CameraRequest =
  | { kind: 'preset'; id: PresetId; nonce: number }
  /** focus: close inspection (saves the current view first) · locate: gentle move to show where a part is */
  | { kind: 'fit'; id: string; mode: 'focus' | 'locate'; nonce: number }
  | { kind: 'restore'; nonce: number }
  | { kind: 'zoom'; factor: number; nonce: number };

export const TAB_ORDER: Tab[] = ['aircraft', 'overview', 'autonomy', 'specs', 'research'];
export const MODE_ORDER: ViewMode[] = ['exterior', 'cutaway', 'systems', 'payload'];
const MODE_CUTAWAY: Record<ViewMode, Cutaway> = { exterior: 'exterior', cutaway: 'partial', systems: 'internal', payload: 'exterior' };

interface State {
  tab: Tab;
  mode: ViewMode;
  selectedId: string | null;
  hoveredId: string | null;
  /** Assembly the camera is focused on; its sub-components become individually selectable. */
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
  /** Full-screen inspection: interface reduced to the essentials. */
  immersive: boolean;
  scenario: ScenarioId;
  researchCategory: string;
  researchQuery: string;
  autoRotate: boolean;
  showGrid: boolean;
  panel: 'none' | 'index' | 'controls' | 'menu';
  renderStatus: 'loading' | 'ready' | 'unavailable';

  setTab: (t: Tab) => void;
  setMode: (m: ViewMode) => void;
  select: (id: string | null, opts?: { fly?: boolean }) => void;
  hover: (id: string | null) => void;
  focus: (id: string) => void;
  exitFocus: () => void;
  setIsolate: (v: boolean) => void;
  setExplode: (v: number) => void;
  setPitch: (v: number) => void;
  setRoll: (v: number) => void;
  setBayOpen: (v: boolean) => void;
  setPayload: (id: string) => void;
  goPreset: (id: PresetId) => void;
  resetView: () => void;
  zoom: (factor: number) => void;
  resetAll: () => void;
  setImmersive: (v: boolean) => void;
  setScenario: (s: ScenarioId) => void;
  setResearchCategory: (c: string) => void;
  setResearchQuery: (q: string) => void;
  setAutoRotate: (v: boolean) => void;
  setShowGrid: (v: boolean) => void;
  setPanel: (p: State['panel']) => void;
  setRenderStatus: (s: State['renderStatus']) => void;
}

let nonce = 1;

/** Old section hashes from the first version still land somewhere sensible. */
const LEGACY: Record<string, [Tab, ViewMode?]> = {
  exterior: ['aircraft', 'exterior'],
  cutaway: ['aircraft', 'cutaway'],
  internal: ['aircraft', 'systems'],
  systems: ['aircraft', 'systems'],
  bay: ['aircraft', 'payload'],
  payload: ['aircraft', 'payload'],
};

export function parseHash(h: string): { tab: Tab; mode?: ViewMode } | null {
  const k = h.replace('#', '');
  if (TAB_ORDER.includes(k as Tab)) return { tab: k as Tab };
  if (LEGACY[k]) return { tab: LEGACY[k][0], mode: LEGACY[k][1] };
  return null;
}

function initial(): { tab: Tab; mode: ViewMode } {
  try {
    const r = parseHash(location.hash);
    if (r) return { tab: r.tab, mode: r.mode ?? 'exterior' };
  } catch {
    /* no location in this context */
  }
  return { tab: 'aircraft', mode: 'exterior' };
}

const I0 = initial();

export const useStore = create<State>((set, get) => ({
  tab: I0.tab,
  mode: I0.mode,
  selectedId: null,
  hoveredId: null,
  focusId: null,
  isolate: false,
  cutaway: MODE_CUTAWAY[I0.mode],
  explode: 0,
  pitch: 0,
  roll: 0,
  bayOpen: I0.mode === 'payload',
  payloadId: 'payload-map',
  preset: I0.mode === 'exterior' ? 'hero' : null,
  cameraRequest: null,
  immersive: false,
  scenario: 'nominal',
  researchCategory: 'all',
  researchQuery: '',
  autoRotate: false,
  showGrid: false,
  panel: 'none',
  renderStatus: 'loading',

  setTab: (tab) => {
    if (get().tab === tab) return;
    set({ tab, panel: 'none', immersive: tab === 'aircraft' ? get().immersive : false });
  },

  setMode: (mode) => {
    const prev = get().mode;
    set({ mode, cutaway: MODE_CUTAWAY[mode], bayOpen: mode === 'payload', panel: get().panel === 'menu' ? 'none' : get().panel });
    if (mode !== 'systems') set({ explode: 0 });
    if (mode === prev) return;
    if (mode === 'payload') {
      set({ selectedId: get().payloadId, focusId: null, isolate: false, cameraRequest: { kind: 'fit', id: 'bay', mode: 'locate', nonce: nonce++ }, preset: null });
    } else if ((mode === 'cutaway' || mode === 'systems') && !get().focusId) {
      set({ cameraRequest: { kind: 'preset', id: 'internal', nonce: nonce++ }, preset: 'internal' });
    } else if (mode === 'exterior' && (prev === 'payload' || prev === 'systems' || prev === 'cutaway') && !get().focusId) {
      set({ cameraRequest: { kind: 'preset', id: 'hero', nonce: nonce++ }, preset: 'hero' });
    }
  },

  select: (id, opts) => {
    if (id && id.startsWith('payload-')) set({ payloadId: id });
    // Internal parts cannot be seen through a closed shell: switch to the systems view.
    const rec = id ? COMPONENT_MAP[id] : null;
    if (rec && rec.location === 'internal' && get().mode === 'exterior') set({ mode: 'systems', cutaway: 'internal' });
    set({ selectedId: id });
    if (id && opts?.fly) set({ cameraRequest: { kind: 'fit', id, mode: get().focusId ? 'focus' : 'locate', nonce: nonce++ }, preset: null });
  },
  hover: (hoveredId) => get().hoveredId !== hoveredId && set({ hoveredId }),

  focus: (id) => {
    const rec = COMPONENT_MAP[id];
    if (rec && rec.location === 'internal' && (get().mode === 'exterior' || get().mode === 'payload')) set({ mode: 'systems', cutaway: 'internal', bayOpen: false });
    set({ focusId: id, selectedId: id, cameraRequest: { kind: 'fit', id, mode: 'focus', nonce: nonce++ }, preset: null });
  },
  exitFocus: () => set({ focusId: null, isolate: false, cameraRequest: { kind: 'restore', nonce: nonce++ } }),
  setIsolate: (isolate) => {
    const sel = get().selectedId;
    if (isolate && sel) {
      const target = get().focusId ?? sel;
      set({ isolate, focusId: target, cameraRequest: get().focusId ? get().cameraRequest : { kind: 'fit', id: target, mode: 'focus', nonce: nonce++ } });
    } else set({ isolate: false });
  },
  setExplode: (explode) => set({ explode }),
  setPitch: (pitch) => set({ pitch }),
  setRoll: (roll) => set({ roll }),
  setBayOpen: (bayOpen) => set({ bayOpen }),
  setPayload: (payloadId) => set({ payloadId, selectedId: payloadId }),
  goPreset: (id) => {
    const patch: Partial<State> = { preset: id, cameraRequest: { kind: 'preset', id, nonce: nonce++ } };
    if (id === 'internal' && get().mode === 'exterior') Object.assign(patch, { mode: 'cutaway', cutaway: 'partial' });
    set(patch);
  },
  resetView: () => {
    if (get().focusId) set({ focusId: null, isolate: false });
    get().goPreset(get().mode === 'cutaway' || get().mode === 'systems' ? 'internal' : 'hero');
  },
  zoom: (factor) => set({ cameraRequest: { kind: 'zoom', factor, nonce: nonce++ }, preset: null }),
  /** Back to the opening presentation; research filters and display preferences are kept. */
  resetAll: () =>
    set({
      mode: 'exterior',
      selectedId: null,
      focusId: null,
      isolate: false,
      cutaway: 'exterior',
      explode: 0,
      pitch: 0,
      roll: 0,
      bayOpen: false,
      preset: 'hero',
      cameraRequest: { kind: 'preset', id: 'hero', nonce: nonce++ },
    }),
  setImmersive: (immersive) => set({ immersive, panel: 'none' }),
  setScenario: (scenario) => set({ scenario }),
  setResearchCategory: (researchCategory) => set({ researchCategory }),
  setResearchQuery: (researchQuery) => set({ researchQuery }),
  setAutoRotate: (autoRotate) => set({ autoRotate }),
  setShowGrid: (showGrid) => set({ showGrid }),
  setPanel: (panel) => set({ panel }),
  setRenderStatus: (renderStatus) => set({ renderStatus }),
}));
