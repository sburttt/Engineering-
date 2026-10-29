import type { PresetId } from '../state/store';

/** Camera presets: position (metres) and optional look-at target, in aircraft coordinates. */
export const PRESETS: Record<PresetId, { label: string; pos: [number, number, number]; target?: [number, number, number] }> = {
  'three-quarter-front': { label: '¾ Front', pos: [17, 8.2, 17.5] },
  front: { label: 'Front', pos: [30, 1.6, 0.001] },
  side: { label: 'Side', pos: [0.001, 1.2, 30] },
  rear: { label: 'Rear', pos: [-30, 2.6, 0.001] },
  top: { label: 'Top', pos: [-0.01, 33, 0] },
  bottom: { label: 'Bottom', pos: [0.01, -26, 0] },
  'three-quarter-rear': { label: '¾ Rear', pos: [-18, 8, -16] },
  internal: { label: 'Internal', pos: [6, 11, 12], target: [0.6, 0, 0.4] },
  overview: { label: 'Overview', pos: [24, 16, 26] },
};
export const PRESET_ORDER: PresetId[] = ['three-quarter-front', 'front', 'side', 'rear', 'top', 'bottom', 'three-quarter-rear', 'internal', 'overview'];
