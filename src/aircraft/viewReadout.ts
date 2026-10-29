/* Kept free of three.js imports so the interface bundle stays small. */

/**
 * Live camera readout for the interface (azimuth from the nose toward starboard, elevation above
 * the horizon, distance to the target). Published at a low rate so React never re-renders per frame.
 */
export interface ViewReadout {
  az: number;
  el: number;
  dist: number;
}
type Listener = (v: ViewReadout) => void;
const listeners = new Set<Listener>();
let last: ViewReadout = { az: 0, el: 0, dist: 0 };
export function publishView(v: ViewReadout) {
  if (Math.abs(v.az - last.az) < 0.5 && Math.abs(v.el - last.el) < 0.5 && Math.abs(v.dist - last.dist) < 0.05) return;
  last = v;
  listeners.forEach((l) => l(v));
}
export function subscribeView(l: Listener) {
  listeners.add(l);
  l(last);
  return () => {
    listeners.delete(l);
  };
}
