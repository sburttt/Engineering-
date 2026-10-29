import { useState } from 'react';
import { SPEC_GROUPS, MATURITY, DIMENSIONS } from '../../data/aircraft';
import { FrontView, SideView, TopView } from './ThreeView';
import { Emblem } from '../brand/Logo';
import { BRAND } from '../../data/brand';

export function SpecsPage() {
  const [group, setGroup] = useState<string>('all');
  const groups = group === 'all' ? SPEC_GROUPS : SPEC_GROUPS.filter((g) => g.id === group);
  return (
    <div className="doc">
      <div className="doc-inner">
        <header className="doc-head">
          <span className="eyebrow">Specification sheet · fictional concept estimates</span>
          <h1>CX-7 NIGHTFALL</h1>
          <p>
            Dimensions are measured from the same parametric geometry that builds the 3D model and the drawings below, so all
            three always agree. Anything that cannot be estimated responsibly is marked “Not established at concept stage”.
          </p>
          <span className="maturity">{MATURITY}</span>
        </header>

        <section className="threeview" aria-label="Three-view drawing">
          <div className="card">
            <span className="eyebrow">Plan view</span>
            <TopView />
          </div>
          <div style={{ display: 'grid', gap: 16 }}>
            <div className="card">
              <span className="eyebrow">Side view</span>
              <SideView />
            </div>
            <div className="card">
              <span className="eyebrow">Front view</span>
              <FrontView />
            </div>
            <div className="title-block">
              <span style={{ color: 'var(--fg)' }}>
                <Emblem size={26} />
              </span>
              <span>
                {BRAND.name.toUpperCase()} · CX-7 GENERAL ARRANGEMENT · CONCEPTUAL VISUALISATION
                <br />
                L {DIMENSIONS.length} m · B {DIMENSIONS.span} m · H {DIMENSIONS.height} m · NOT FOR CONSTRUCTION
              </span>
              <span>REV C</span>
            </div>
          </div>
        </section>

        <section style={{ display: 'grid', gap: 12 }}>
          <div className="spec-tabs" role="tablist" aria-label="Specification categories">
            {[{ id: 'all', title: 'All' }, ...SPEC_GROUPS].map((g) => (
              <button key={g.id} role="tab" aria-selected={group === g.id} className="btn sm" aria-pressed={group === g.id} onClick={() => setGroup(g.id)}>
                {g.title}
              </button>
            ))}
          </div>
          <div className="grid-2">
            {groups.map((g) => (
              <div key={g.id} className="table-wrap" style={{ alignSelf: 'start' }}>
                <table>
                  <thead>
                    <tr>
                      <th colSpan={2}>{g.title}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.rows.map((r) => (
                      <tr key={r.k}>
                        <td className="k">{r.k}</td>
                        <td>
                          <span className="tnum">{r.v}</span>
                          {r.note && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{r.note}</div>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </section>
        <p className="disclaimer">
          All specifications are fictional concept estimates for a design visualisation. They are not engineering data and do
          not represent achievable or validated performance.
        </p>
      </div>
    </div>
  );
}
