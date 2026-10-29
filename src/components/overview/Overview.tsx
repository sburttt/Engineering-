import { useStore } from '../../state/store';
import { BRAND } from '../../data/brand';
import { DIMENSIONS, MATURITY } from '../../data/aircraft';
import { Emblem } from '../brand/Logo';

const PRIORITIES = [
  { t: 'One continuous surface', d: 'A blended centre body and cranked outer wings generated from a single shape definition.' },
  { t: 'No cockpit, no tail', d: 'Uncrewed and tailless: the volume and drag of a canopy and fins are given back to systems.' },
  { t: 'Accountable autonomy', d: 'Supervised autonomy with human authorisation for every consequential change, and a full audit log.' },
  { t: 'Built to be opened', d: 'Seven access panels and a modular equipment bay, so each module can be reached on its own.' },
];

export function Overview() {
  const setTab = useStore((s) => s.setTab);
  return (
    <>
      <div className="overview-overlay" aria-hidden />
      <section className="overview-panel" aria-label="Overview">
        <div className="hero-mark">
          <span style={{ color: 'var(--fg)' }}>
            <Emblem size={44} />
          </span>
          <div>
            <div className="brand-name" style={{ fontSize: 15 }}>CORVANE</div>
            <div className="brand-sub">AEROSYSTEMS · {BRAND.abbreviation}</div>
          </div>
        </div>
        <h1 className="hero-title">
          <small>PROJECT NIGHTFALL · CX-7</small>
          Nightfall
        </h1>
        <p className="hero-lede">
          An original, uncrewed, tailless research demonstrator: a study in quiet geometry, modular systems and supervised
          autonomy, presented as a working 3D design review.
        </p>
        <ul className="priorities">
          {PRIORITIES.map((p) => (
            <li key={p.t}>
              <span className="n" aria-hidden>▪</span>
              <span>
                <b>{p.t}</b>
                {p.d}
              </span>
            </li>
          ))}
        </ul>
        <div className="hero-specs">
          <div><b className="tnum">{DIMENSIONS.length.toFixed(1)} m</b><span>Length</span></div>
          <div><b className="tnum">{DIMENSIONS.span.toFixed(1)} m</b><span>Wingspan</span></div>
          <div><b className="tnum">{DIMENSIONS.height.toFixed(1)} m</b><span>Height</span></div>
        </div>
        <span className="maturity">{MATURITY}</span>
        <div className="actions">
          <button className="btn primary" onClick={() => setTab('exterior')}>Enter 3D viewer</button>
          <button className="btn" onClick={() => setTab('cutaway')}>See the cutaway</button>
          <button className="btn ghost" onClick={() => setTab('research')}>Research library</button>
        </div>
        <p className="disclaimer">
          {BRAND.name} ({BRAND.founded}, {BRAND.hq}) and the CX-7 are fictional. “{BRAND.tagline}” This is concept art and
          design exploration, not validated engineering; dimensions are fictional concept estimates.
        </p>
      </section>
    </>
  );
}
