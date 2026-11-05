import type { PresetId } from '../state/store';

/**
 * Camera presets: position (metres) and optional look-at target, in aircraft coordinates
 * (+X nose, +Y up, +Z starboard). Distances are for a landscape frame; narrow frames move back.
 */
export const PRESETS: Record<PresetId, { label: string; pos: [number, number, number]; target?: [number, number, number] }> = {
  front: { label: 'Front', pos: [29, 2.2, 0.001], target: [0, -0.1, 0] },
  side: { label: 'Side', pos: [0.001, 0.9, 29], target: [0.3, -0.05, 0] },
  top: { label: 'Top', pos: [-0.01, 34, 0], target: [0.3, 0, 0] },
  rear: { label: 'Rear', pos: [-27, 4.2, 0.001], target: [0, -0.05, 0] },
  hero: { label: 'Three-quarter', pos: [15.5, 6.4, 17.2], target: [0.2, -0.15, 0] },
  // a close three-quarter on the nose, the chine, the inlet lip and the sensor glazing
  detail: { label: 'Detail', pos: [9.2, 2.6, 5.4], target: [4.2, 0.15, 0.4] },
  under: { label: 'Under', pos: [3, -30, 0.01], target: [0.3, -0.5, 0] },
  internal: { label: 'Internal', pos: [7.5, 13, 14], target: [0.4, -0.1, 0.4] },
};
/** Presets offered to the user, in order (keys 1–7). */
export const PRESET_ORDER: PresetId[] = ['front', 'side', 'top', 'rear', 'hero', 'detail', 'under'];
