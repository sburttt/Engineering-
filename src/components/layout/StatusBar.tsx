import { useStore } from '../../state/store';
import { COMPONENT_MAP } from '../../data/components';
import { MATURITY } from '../../data/aircraft';
import { SCENARIOS } from '../../data/autonomy';
import { PRESETS } from '../../aircraft/presets';
import { TAB_LABELS } from './TopNav';

export function StatusBar() {
  const s = useStore();
  const sc = SCENARIOS.find((x) => x.id === s.scenario)!;
  const sev = sc.severity === 'nominal' ? 'ok' : sc.severity === 'caution' ? 'caution' : 'warn';
  const mode = s.focusId ? 'Component detail' : s.cutaway === 'exterior' ? 'Exterior' : s.cutaway === 'partial' ? 'Partial cutaway' : 'Internal';
  return (
    <footer className="status" aria-label="Status">
      <span>
        SECTION <b>{TAB_LABELS[s.tab].toUpperCase()}</b>
      </span>
      <span>
        VIEW <b>{mode.toUpperCase()}</b>
      </span>
      <span>
        SELECTED <b>{s.selectedId ? COMPONENT_MAP[s.selectedId]?.name.toUpperCase() : '—'}</b>
      </span>
      <span>
        CAMERA <b>{s.preset ? PRESETS[s.preset].label.toUpperCase() : 'FREE'}</b>
      </span>
      <span>
        RENDER <b>{s.renderStatus === 'ready' ? 'WEBGL READY' : s.renderStatus === 'loading' ? 'LOADING' : 'UNAVAILABLE'}</b>
      </span>
      <span className={`chip ${sev}`} style={{ border: 0, background: 'none', padding: '0 12px' }}>
        <i className="dot" /> SIM {sc.name.toUpperCase()}
      </span>
      <span className="mat">{MATURITY}</span>
    </footer>
  );
}
