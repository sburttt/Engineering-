import { useEffect } from 'react';
import { useStore, VIEWER_TABS } from '../state/store';
import { PRESET_ORDER } from '../aircraft/presets';

/**
 * Viewer keyboard shortcuts (ignored while typing in a field):
 *   1–9 camera presets · R reset camera · X toggle exploded view · C cycle shell
 *   + / − zoom · Esc return to aircraft, then clear selection
 */
export function useKeyboardShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const s = useStore.getState();
      if (!VIEWER_TABS.includes(s.tab)) return;
      const n = Number(e.key);
      if (n >= 1 && n <= 9) s.goPreset(PRESET_ORDER[n - 1]);
      else if (e.key === 'r' || e.key === 'R') s.resetView();
      else if (e.key === 'x' || e.key === 'X') s.setExplode(s.explode > 0.01 ? 0 : 0.8);
      else if (e.key === 'c' || e.key === 'C') s.setCutaway(s.cutaway === 'exterior' ? 'partial' : s.cutaway === 'partial' ? 'internal' : 'exterior');
      else if (e.key === '+' || e.key === '=') s.zoom(0.8);
      else if (e.key === '-' || e.key === '_') s.zoom(1.25);
      else if (e.key === 'Escape') {
        if (s.focusId) s.returnToAircraft();
        else if (s.selectedId) s.select(null);
      } else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
