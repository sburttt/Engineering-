import { useStore, TAB_ORDER, type Tab } from '../../state/store';
import { Wordmark } from '../brand/Logo';

export const TAB_LABELS: Record<Tab, string> = {
  overview: 'Overview',
  exterior: 'Exterior',
  cutaway: 'Cutaway',
  internal: 'Internal systems',
  autonomy: 'Autonomy',
  bay: 'Equipment bay',
  specs: 'Specifications',
  research: 'Research library',
};

const MODE_LABEL: Record<string, string> = { exterior: 'FULL EXTERIOR', partial: 'PARTIAL CUTAWAY', internal: 'INTERNAL SYSTEMS' };

export function TopNav() {
  const tab = useStore((s) => s.tab);
  const cutaway = useStore((s) => s.cutaway);
  const focus = useStore((s) => s.focusId);
  const setTab = useStore((s) => s.setTab);
  const viewer = ['exterior', 'cutaway', 'internal', 'bay'].includes(tab);
  return (
    <header className="nav">
      <a href="#overview" onClick={(e) => (e.preventDefault(), setTab('overview'))} style={{ textDecoration: 'none' }}>
        <Wordmark size={26} />
      </a>
      <span className="nav-sep" aria-hidden />
      <span className="designation">
        <b>CX-7</b> NIGHTFALL
      </span>
      <nav className="tabs" role="tablist" aria-label="Sections">
        {TAB_ORDER.map((t) => (
          <button key={t} role="tab" className="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
            {TAB_LABELS[t]}
          </button>
        ))}
      </nav>
      {viewer && <span className="nav-mode">{focus ? 'COMPONENT DETAIL' : MODE_LABEL[cutaway]}</span>}
    </header>
  );
}
