import { useEffect } from 'react';
import { useStore } from '../state/store';
import { PRESET_ORDER } from '../aircraft/presets';

/**
 * Viewer keyboard shortcuts (ignored while typing in a field):
 *   1–7 camera presets · R reset view · F full-screen inspection · X separation (transparent)
 *   B blueprint · W wireframe · Space pause the presentation
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
      if (s.cinema) {
        if (e.key === 'Escape') s.stopCinema();
        else if (e.key === ' ' || e.key === 'k') s.setCinemaPlaying(!s.cinemaPlaying);
        else return;
        e.preventDefault();
        return;
      }
      const n = Number(e.key);
      if (n >= 1 && n <= PRESET_ORDER.length) s.goPreset(PRESET_ORDER[n - 1]);
      else if (e.key === 'r' || e.key === 'R') s.resetView();
      else if (e.key === 'f' || e.key === 'F') s.setImmersive(!s.immersive);
      else if ((e.key === 'x' || e.key === 'X') && s.render === 'xray') s.setExplode(s.explode > 0.01 ? 0 : 0.8);
      else if (e.key === 'b' || e.key === 'B') s.setRender(s.render === 'blueprint' ? 'real' : 'blueprint');
      else if (e.key === 'w' || e.key === 'W') s.setRender(s.render === 'wire' ? 'real' : 'wire');
      else if (e.key === '+' || e.key === '=') s.zoom(0.8);
      else if (e.key === '-' || e.key === '_') s.zoom(1.25);
      else if (e.key === 'Escape') {
        if (s.explodeAsm) s.setExplodeAsm(null);
        else if (s.focusId) s.exitFocus();
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
