import { create } from 'zustand';
import { COMPONENT_MAP } from '../data/components';
import { ASSEMBLY_MAP } from '../data/assemblies';

/** Pages. The aircraft viewer is the home page; the others are editorial documents. */
export type Tab = 'aircraft' | 'overview' | 'autonomy' | 'specs' | 'research';
/** Configuration of the aircraft: closed, partial cutaway, or with the payload bay open. */
export type ViewMode = 'exterior' | 'cutaway' | 'payload';
/** How the same model is drawn: studio materials, transparent shell, hidden-line wireframe, or blueprint. */
export type RenderMode = 'real' | 'xray' | 'wire' | 'blueprint';
export type Cutaway = 'exterior' | 'partial' | 'internal';
export type PresetId = 'front' | 'side' | 'top' | 'rear' | 'hero' | 'detail' | 'under' | 'internal';
export type ScenarioId = 'nominal' | 'lost-link' | 'sensor-mismatch' | 'health-warning' | 'abort';

export type CameraRequest =
  | { kind: 'preset'; id: PresetId; nonce: number }
  /** focus: close inspection (saves the current view first) · locate: gentle move to show where a part is */
  | { kind: 'fit'; id: string; mode: 'focus' | 'locate'; nonce: number }
  | { kind: 'restore'; nonce: number }
  /** exploded-assembly framing: fit the separated assembly from its preferred direction */
  | { kind: 'assembly'; id: string; nonce: number }
  | { kind: 'zoom'; factor: number; nonce: number };

export const TAB_ORDER: Tab[] = ['aircraft', 'overview', 'autonomy', 'specs', 'research'];
export const MODE_ORDER: ViewMode[] = ['exterior', 'cutaway', 'payload'];
export const RENDER_ORDER: RenderMode[] = ['real', 'xray', 'wire', 'blueprint'];
/** Shell treatment follows from configuration and render mode. */
export const cutawayOf = (mode: ViewMode, render: RenderMode): Cutaway =>
  render === 'xray' ? 'internal' : mode === 'cutaway' && render === 'real' ? 'partial' : 'exterior';

interface State {
  tab: Tab;
  mode: ViewMode;
  render: RenderMode;
  /** Assembly shown in the exploded presentation (null: assembled aircraft). */
  explodeAsm: string | null;
  /** Cinematic presentation running (camera and interface are driven by the timeline). */
  cinema: boolean;
  cinemaPlaying: boolean;
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
  panel: 'none' | 'index' | 'controls' | 'menu' | 'rail';
  renderStatus: 'loading' | 'ready' | 'unavailable';

  setTab: (t: Tab) => void;
  setMode: (m: ViewMode | 'systems') => void;
  setRender: (r: RenderMode) => void;
  setExplodeAsm: (id: string | null) => void;
  startCinema: () => void;
  setCinemaPlaying: (v: boolean) => void;
  stopCinema: () => void;
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

/** Old section hashes still land somewhere sensible. */
const LEGACY: Record<string, [Tab, ViewMode?, RenderMode?]> = {
  exterior: ['aircraft', 'exterior'],
  cutaway: ['aircraft', 'cutaway'],
  internal: ['aircraft', 'exterior', 'xray'],
  systems: ['aircraft', 'exterior', 'xray'],
  bay: ['aircraft', 'payload'],
  payload: ['aircraft', 'payload'],
  blueprint: ['aircraft', 'exterior', 'blueprint'],
  wireframe: ['aircraft', 'exterior', 'wire'],
};

export function parseHash(h: string): { tab: Tab; mode?: ViewMode; render?: RenderMode } | null {
  const k = h.replace('#', '');
  if (TAB_ORDER.includes(k as Tab)) return { tab: k as Tab };
  if (LEGACY[k]) return { tab: LEGACY[k][0], mode: LEGACY[k][1], render: LEGACY[k][2] };
  return null;
}

function initial(): { tab: Tab; mode: ViewMode; render: RenderMode } {
  try {
    const r = parseHash(location.hash);
    if (r) return { tab: r.tab, mode: r.mode ?? 'exterior', render: r.render ?? 'real' };
  } catch {
    /* no location in this context */
  }
  return { tab: 'aircraft', mode: 'exterior', render: 'real' };
}

const I0 = initial();
const req = <T extends Omit<CameraRequest, 'nonce'>>(r: T) => ({ ...r, nonce: nonce++ }) as CameraRequest;

export const useStore = create<State>((set, get) => ({
  tab: I0.tab,
  mode: I0.mode,
  render: I0.render,
  explodeAsm: null,
  cinema: false,
  cinemaPlaying: false,
  selectedId: null,
  hoveredId: null,
  focusId: null,
  isolate: false,
  cutaway: cutawayOf(I0.mode, I0.render),
  explode: 0,
  pitch: 0,
  roll: 0,
  bayOpen: I0.mode === 'payload',
  payloadId: 'payload-map',
  preset: I0.mode === 'exterior' && I0.render !== 'xray' ? 'hero' : null,
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
    if (get().cinema) get().stopCinema();
    set({ tab, panel: 'none', immersive: tab === 'aircraft' ? get().immersive : false });
  },

  setMode: (m) => {
    if (m === 'systems') return get().setRender('xray');
    const mode = m;
    const prev = get().mode;
    set({ mode, cutaway: cutawayOf(mode, get().render), bayOpen: mode === 'payload', panel: get().panel === 'menu' ? 'none' : get().panel });
    if (mode === prev) return;
    if (get().explodeAsm) set({ explodeAsm: null });
    if (mode === 'payload') {
      set({ selectedId: get().payloadId, focusId: null, isolate: false, cameraRequest: req({ kind: 'fit', id: 'bay', mode: 'locate' }), preset: null });
    } else if (mode === 'cutaway' && !get().focusId) {
      set({ cameraRequest: req({ kind: 'preset', id: 'internal' }), preset: 'internal' });
    } else if (mode === 'exterior' && prev !== 'exterior' && !get().focusId) {
      set({ cameraRequest: req({ kind: 'preset', id: 'hero' }), preset: 'hero' });
    }
  },

  setRender: (render) => {
    const prev = get().render;
    if (prev === render) return;
    set({ render, cutaway: cutawayOf(get().mode, render), explode: render === 'xray' ? get().explode : 0 });
    // the blueprint is read as orthographic views; open it on a clean side profile
    if (render === 'blueprint' && !get().explodeAsm && !get().focusId) set({ cameraRequest: req({ kind: 'preset', id: 'side' }), preset: 'side' });
    else if (prev === 'blueprint') {
      const p = get().preset;
      if (p) set({ cameraRequest: req({ kind: 'preset', id: p }) });
    }
  },

  setExplodeAsm: (id) => {
    const cur = get().explodeAsm;
    if (id === cur) return;
    if (!id) {
      set({ explodeAsm: null, bayOpen: get().mode === 'payload', cameraRequest: req({ kind: 'restore' }) });
      return;
    }
    const a = ASSEMBLY_MAP[id];
    set({
      explodeAsm: id,
      explode: 0,
      focusId: null,
      isolate: false,
      selectedId: null,
      bayOpen: a?.bay ? true : get().mode === 'payload',
      cameraRequest: req({ kind: 'assembly', id }),
      preset: null,
    });
  },

  startCinema: () =>
    set({
      cinema: true,
      cinemaPlaying: true,
      immersive: true,
      panel: 'none',
      selectedId: null,
      focusId: null,
      isolate: false,
      explodeAsm: null,
      mode: 'exterior',
      render: 'real',
      cutaway: 'exterior',
      explode: 0,
      pitch: 0,
      roll: 0,
      bayOpen: false,
      preset: null,
    }),
  setCinemaPlaying: (cinemaPlaying) => set({ cinemaPlaying }),
  stopCinema: () =>
    set({
      cinema: false,
      cinemaPlaying: false,
      immersive: false,
      render: 'real',
      cutaway: cutawayOf(get().mode, 'real'),
      explode: 0,
      explodeAsm: null,
      preset: 'hero',
      cameraRequest: req({ kind: 'preset', id: 'hero' }),
    }),

  select: (id, opts) => {
    if (id && id.startsWith('payload-')) set({ payloadId: id });
    // Internal parts cannot be seen through a closed shell: show the shell transparent.
    const rec = id ? COMPONENT_MAP[id] : null;
    if (rec && rec.location === 'internal' && get().render === 'real' && get().mode !== 'cutaway' && !get().explodeAsm) get().setRender('xray');
    set({ selectedId: id });
    if (id && opts?.fly) set({ cameraRequest: req({ kind: 'fit', id, mode: get().focusId ? 'focus' : 'locate' }), preset: null });
  },
  hover: (hoveredId) => get().hoveredId !== hoveredId && set({ hoveredId }),

  focus: (id) => {
    const rec = COMPONENT_MAP[id];
    if (get().explodeAsm) set({ explodeAsm: null });
    if (rec && rec.location === 'internal' && get().render === 'real' && get().mode !== 'cutaway') get().setRender('xray');
    set({ focusId: id, selectedId: id, cameraRequest: req({ kind: 'fit', id, mode: 'focus' }), preset: null });
  },
  exitFocus: () => set({ focusId: null, isolate: false, cameraRequest: req({ kind: 'restore' }) }),
  setIsolate: (isolate) => {
    const sel = get().selectedId;
    if (isolate && sel) {
      const target = get().focusId ?? sel;
      set({ isolate, focusId: target, cameraRequest: get().focusId ? get().cameraRequest : req({ kind: 'fit', id: target, mode: 'focus' }) });
    } else set({ isolate: false });
  },
  setExplode: (explode) => set({ explode }),
  setPitch: (pitch) => set({ pitch }),
  setRoll: (roll) => set({ roll }),
  setBayOpen: (bayOpen) => set({ bayOpen }),
  setPayload: (payloadId) => set({ payloadId, selectedId: payloadId }),
  goPreset: (id) => {
    const patch: Partial<State> = { preset: id, cameraRequest: req({ kind: 'preset', id }) };
    if (id === 'internal' && get().mode === 'exterior' && get().render === 'real') Object.assign(patch, { mode: 'cutaway', cutaway: 'partial' });
    set(patch);
  },
  resetView: () => {
    if (get().focusId) set({ focusId: null, isolate: false });
    if (get().explodeAsm) set({ explodeAsm: null, bayOpen: get().mode === 'payload' });
    get().goPreset(get().mode === 'cutaway' || get().render === 'xray' ? 'internal' : get().render === 'blueprint' ? 'side' : 'hero');
  },
  zoom: (factor) => set({ cameraRequest: req({ kind: 'zoom', factor }), preset: null }),
  /** Back to the opening presentation; research filters and display preferences are kept. */
  resetAll: () =>
    set({
      mode: 'exterior',
      render: 'real',
      explodeAsm: null,
      selectedId: null,
      focusId: null,
      isolate: false,
      cutaway: 'exterior',
      explode: 0,
      pitch: 0,
      roll: 0,
      bayOpen: false,
      preset: 'hero',
      cameraRequest: req({ kind: 'preset', id: 'hero' }),
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
