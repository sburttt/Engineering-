import { useMemo } from 'react';
import { useStore } from '../../state/store';
import { RESEARCH, RESEARCH_CATEGORIES, LABEL_TEXT, type Claim, type ResearchEntry } from '../../data/research';

function Claims({ title, claims }: { title: string; claims?: Claim[] }) {
  if (!claims || claims.length === 0) return null;
  return (
    <div>
      <div className="section-label">{title}</div>
      <ul className="claims">
        {claims.map((c, i) => (
          <li key={i}>
            <span className={`claim-tag lbl-${c.label}`}>{LABEL_TEXT[c.label]}</span>
            <span>{c.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Card({ r }: { r: ResearchEntry }) {
  return (
    <article className="card research-card">
      <div style={{ display: 'grid', gap: 6 }}>
        <span className="chip" style={{ justifySelf: 'start' }}>{r.category}</span>
        <h3>{r.name}</h3>
        <span className="eyebrow" style={{ textTransform: 'none', letterSpacing: '0.04em' }}>{r.org}</span>
      </div>
      <Claims title="Overview" claims={r.overview} />
      <Claims title="Broad design characteristics" claims={r.design} />
      <Claims title="Autonomy" claims={r.autonomy} />
      <Claims title="What CX-7 learned" claims={r.learned} />
      <div>
        <div className="section-label">Sources</div>
        {r.sources?.length ? (
          <ol className="sources">
            {r.sources.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noreferrer noopener">{s.title}</a>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-2">No sources recorded.</p>
        )}
      </div>
    </article>
  );
}

export function ResearchPage() {
  const cat = useStore((s) => s.researchCategory);
  const q = useStore((s) => s.researchQuery);
  const setCat = useStore((s) => s.setResearchCategory);
  const setQ = useStore((s) => s.setResearchQuery);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return RESEARCH.filter((r) => (cat === 'all' || r.category === cat) && (!t || JSON.stringify(r).toLowerCase().includes(t)));
  }, [cat, q]);

  return (
    <div className="doc">
      <div className="doc-inner">
        <header className="doc-head">
          <span className="eyebrow">Research library · {RESEARCH.length} public-source references</span>
          <h1>Reference programmes</h1>
          <p>
            Public information on stealth, uncrewed and autonomy programmes that informed CX-7. Every statement carries one of three
            labels, so documented facts, our interpretations and fictional design choices stay separate. Sources were gathered in
            October 2026; check each link for current status.
          </p>
          <div className="legend">
            <span className="lbl-VERIFIED">■ {LABEL_TEXT.VERIFIED}</span>
            <span className="lbl-INTERP">■ {LABEL_TEXT.INTERP}</span>
            <span className="lbl-FICTIONAL">■ {LABEL_TEXT.FICTIONAL}</span>
          </div>
        </header>

        <section aria-label="Comparison matrix" style={{ display: 'grid', gap: 10 }}>
          <span className="eyebrow">Comparison matrix</span>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Programme</th>
                  <th>Configuration</th>
                  <th>Crew</th>
                  <th>Mission category</th>
                  <th>Public autonomy</th>
                  <th>Payload carriage</th>
                </tr>
              </thead>
              <tbody>
                {RESEARCH.map((r) => (
                  <tr key={r.id}>
                    <td className="k">{r.name}</td>
                    <td>{r.matrix.configuration}</td>
                    <td>{r.matrix.crew}</td>
                    <td>{r.matrix.mission}</td>
                    <td>{r.matrix.autonomy}</td>
                    <td>{r.matrix.carriage}</td>
                  </tr>
                ))}
                <tr>
                  <td className="k" style={{ color: 'var(--accent-2)' }}>CX-7 Nightfall (fictional)</td>
                  <td>Tailless cranked arrow, blended body</td>
                  <td>Uncrewed</td>
                  <td>Research demonstrator</td>
                  <td>Conceptual supervised autonomy</td>
                  <td>Modular ventral bay (non-weapon)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section style={{ display: 'grid', gap: 14 }}>
          <div className="filters">
            <label className="sr-only" htmlFor="research-q">Search references</label>
            <input id="research-q" placeholder="Search references…" value={q} onChange={(e) => setQ(e.target.value)} />
            <button className="btn sm" aria-pressed={cat === 'all'} onClick={() => setCat('all')}>All</button>
            {RESEARCH_CATEGORIES.map((c) => (
              <button key={c} className="btn sm" aria-pressed={cat === c} onClick={() => setCat(c)}>
                {c}
              </button>
            ))}
          </div>
          {list.length === 0 ? (
            <div className="card empty">
              <p>No references match these filters.</p>
              <button className="btn sm" style={{ justifySelf: 'start' }} onClick={() => (setCat('all'), setQ(''))}>Clear filters</button>
            </div>
          ) : (
            <div className="research-grid">
              {list.map((r) => <Card key={r.id} r={r} />)}
            </div>
          )}
        </section>
        <p className="disclaimer">
          Reference programmes are real; Corvane Aerosystems and the CX-7 are fictional. No classified, export-controlled or
          implementation-level signature information is used or implied. Programme names and trademarks belong to their owners.
        </p>
      </div>
    </div>
  );
}
