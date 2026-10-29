import type { PresetId } from '../state/store';

/**
 * Camera presets: position (metres) and optional look-at target, in aircraft coordinates
 * (+X nose, +Y up, +Z starboard). Distances are for a landscape frame; narrow frames move back.
 */
export const PRESETS: Record<PresetId, { label: string; pos: [number, number, number]; target?: [number, number, number] }> = {
  hero: { label: 'Hero', pos: [15.5, 6.4, 17.2], target: [0.2, -0.15, 0] },
  front: { label: 'Front', pos: [29, 2.2, 0.001], target: [0, -0.1, 0] },
  side: { label: 'Side', pos: [0.001, 0.9, 29], target: [0.3, -0.05, 0] },
  top: { label: 'Top', pos: [-0.01, 34, 0], target: [0.3, 0, 0] },
  rear: { label: 'Rear', pos: [-27, 4.2, 0.001], target: [0, -0.05, 0] },
  under: { label: 'Under', pos: [3, -30, 0.01], target: [0.3, -0.5, 0] },
  internal: { label: 'Internal', pos: [7.5, 13, 14], target: [0.4, -0.1, 0.4] },
};
/** Presets offered to the user, in order (keys 1–6). */
export const PRESET_ORDER: PresetId[] = ['hero', 'front', 'side', 'top', 'rear', 'under'];
