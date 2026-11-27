/**
 * `?promo` renders a clean product shot: white seamless background, gear retracted, soft grounding
 * shadow, no interface. Used to export promotional stills from the real model.
 *   ?promo            front three-quarter (port side, slightly above)
 *   ?promo=starboard  the mirror view
 *   ?promo=low        a lower, more dramatic three-quarter
 */
export const PROMO: string | null = (() => {
  try {
    const v = new URLSearchParams(location.search).get('promo');
    return v === null ? null : v || 'front';
  } catch {
    return null;
  }
})();

const D = Math.PI / 180;
const VIEWS: Record<string, { az: number; el: number; r: number }> = {
  front: { az: -34, el: 19, r: 27 },
  starboard: { az: 34, el: 19, r: 27 },
  low: { az: -30, el: 9, r: 26 },
};

/** Camera position and target for the promo view (aircraft coordinates). */
export function promoPose(): { pos: [number, number, number]; target: [number, number, number] } {
  const v = VIEWS[PROMO ?? 'front'] ?? VIEWS.front;
  const target: [number, number, number] = [-0.2, -0.45, 0];
  return {
    target,
    pos: [target[0] + v.r * Math.cos(v.el * D) * Math.cos(v.az * D), target[1] + v.r * Math.sin(v.el * D), target[2] + v.r * Math.cos(v.el * D) * Math.sin(v.az * D)],
  };
}

/** Height of the shadow-catching plane under the gear-up aircraft. */
export const PROMO_FLOOR_Y = -0.78;

/**
 * `?reel` opens straight into the showcase reel with no interface (for screen recording or the
 * frame-by-frame export in scripts/export-reel.mjs). `?reel=clean` also drops the scene labels.
 */
export const REEL_URL: string | null = (() => {
  try {
    const v = new URLSearchParams(location.search).get('reel');
    return v === null ? null : v || 'labels';
  } catch {
    return null;
  }
})();

/** `?reel&export`: the render loop is stopped and frames are stepped one at a time by the exporter. */
export const EXPORT: boolean = (() => {
  try {
    return new URLSearchParams(location.search).has('export');
  } catch {
    return false;
  }
})();
