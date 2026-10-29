import { useEffect } from 'react';
import { useStore } from '../state/store';
import { PRESET_ORDER } from '../aircraft/presets';

/**
 * Viewer keyboard shortcuts (ignored while typing in a field):
 *   1–6 camera presets · R reset view · F full-screen inspection · X exploded view (systems)
 *   + / − zoom · Esc steps back: focus → selection → panels → full screen
 */
export function useKeyboardShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const s = useStore.getState();
      if (e.key === 'Escape' && s.panel === 'menu') return s.setPanel('none');
      if (s.tab !== 'aircraft') return;
      const n = Number(e.key);
      if (n >= 1 && n <= PRESET_ORDER.length) s.goPreset(PRESET_ORDER[n - 1]);
      else if (e.key === 'r' || e.key === 'R') s.resetView();
      else if (e.key === 'f' || e.key === 'F') s.setImmersive(!s.immersive);
      else if ((e.key === 'x' || e.key === 'X') && s.mode === 'systems') s.setExplode(s.explode > 0.01 ? 0 : 0.8);
      else if (e.key === '+' || e.key === '=') s.zoom(0.8);
      else if (e.key === '-' || e.key === '_') s.zoom(1.25);
      else if (e.key === 'Escape') {
        if (s.focusId) s.exitFocus();
        else if (s.selectedId) s.select(null);
        else if (s.panel !== 'none') s.setPanel('none');
        else if (s.immersive) s.setImmersive(false);
        else return;
      } else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
