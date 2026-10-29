import { useStore, TAB_ORDER, type Tab } from '../../state/store';
import { Wordmark } from '../brand/Logo';
import { Icon } from '../viewer/Icon';

export const TAB_LABELS: Record<Tab, string> = {
  aircraft: 'Aircraft',
  overview: 'Overview',
  autonomy: 'Autonomy',
  specs: 'Specification',
  research: 'Research',
};

/** Narrow editorial header: brand, programme designation, five sections and the inspection control. */
export function Header() {
  const tab = useStore((s) => s.tab);
  const setTab = useStore((s) => s.setTab);
  const panel = useStore((s) => s.panel);
  const setPanel = useStore((s) => s.setPanel);
  const setImmersive = useStore((s) => s.setImmersive);
  const go = (t: Tab) => {
    setTab(t);
    setPanel('none');
  };
  return (
    <header className="hdr">
      <a
        className="hdr-brand"
        href="#aircraft"
        onClick={(e) => {
          e.preventDefault();
          go('aircraft');
        }}
        aria-label="Corvane Aerosystems — Nightfall home"
      >
        <Wordmark size={24} />
      </a>
      <span className="hdr-rule" aria-hidden />
      <span className="hdr-prog">
        <b>NIGHTFALL</b>
        <span>CX-7 · Concept</span>
      </span>
      <nav className={`hdr-nav ${panel === 'menu' ? 'open' : ''}`} aria-label="Sections">
        {TAB_ORDER.map((t, i) => (
          <a
            key={t}
            href={`#${t}`}
            className="hdr-link"
            aria-current={tab === t ? 'page' : undefined}
            onClick={(e) => {
              e.preventDefault();
              go(t);
            }}
          >
            <span className="hdr-n" aria-hidden>
              {String(i + 1).padStart(2, '0')}
            </span>
            {TAB_LABELS[t]}
          </a>
        ))}
      </nav>
      <div className="hdr-end">
        {tab === 'aircraft' && (
          <button className="txt-btn" onClick={() => setImmersive(true)} title="Full-screen inspection (F)">
            <Icon name="expand" />
            <span className="hide-sm">Inspect</span>
          </button>
        )}
        <button className="txt-btn menu-btn" aria-expanded={panel === 'menu'} aria-label="Menu" onClick={() => setPanel(panel === 'menu' ? 'none' : 'menu')}>
          <Icon name={panel === 'menu' ? 'close' : 'menu'} />
        </button>
      </div>
    </header>
  );
}
