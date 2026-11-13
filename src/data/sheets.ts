import type { RenderMode } from '../state/store';

/**
 * Captions for the white-sheet looks: a small title top-left, a relation bottom-centre with a one-line
 * reading, and the designation bottom-left. The relations are textbook definitions, not results: no
 * value of any coefficient, speed or mass is claimed for the concept.
 */
export interface SheetCaption {
  title: string;
  sub: string;
  /** relation as plain text; `_x` marks a subscript, `^2` a superscript */
  eq: string;
  reading: string;
}

export const SHEET_CAPTIONS: Partial<Record<RenderMode | 'release', SheetCaption>> = {
  sheet: {
    title: 'Airframe structure',
    sub: 'Internal arrangement shown through the skin · conceptual',
    eq: 'L = ½ ρ v^2 S C_L',
    reading: 'Lift depends on air density, speed, wing area and lift coefficient.',
  },
  flow: {
    title: 'Blended wing-body',
    sub: 'Illustrative surface field · no CFD data',
    eq: 'D = ½ ρ v^2 S C_D',
    reading: 'Drag grows with the square of speed and the drag coefficient.',
  },
  release: {
    title: 'Equipment bay release',
    sub: 'Non-weapon mission module leaving the rails · conceptual sequence',
    eq: 'L = W,  T = D',
    reading: 'In steady level flight lift balances weight and thrust balances drag.',
  },
};
