import { useStore } from '../../state/store';
import { COMPONENT_MAP, chainOf, childrenOf, hasChildren, type ComponentRecord } from '../../data/components';
import { EQUIPMENT_MODULES } from '../../data/equipmentModules';

function InterfaceDiagram({ c }: { c: ComponentRecord }) {
  const select = useStore((s) => s.select);
  const items = c.interfaces ?? [];
  const W = 320;
  const H = 210;
  const cx = W / 2;
  const cy = H / 2;
  return (
    <svg className="diagram" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Conceptual interfaces of ${c.name}`}>
      {items.map((it, i) => {
        const a = -Math.PI / 2 + (i / items.length) * Math.PI * 2;
        const x = cx + Math.cos(a) * 118;
        const y = cy + Math.sin(a) * 74;
        const target = COMPONENT_MAP[it.to];
        const short = target ? target.name.replace(/ Module| \(Concept\)|Autonomous /g, '') : it.to;
        return (
          <g key={it.to + i}>
            <line x1={cx} y1={cy} x2={x} y2={y} stroke="var(--line-2)" strokeWidth={1} />
            <line x1={cx} y1={cy} x2={x} y2={y} stroke="var(--accent)" strokeWidth={1} strokeDasharray="2 6" className="flowline" />
            <g
              role="button"
              tabIndex={0}
              style={{ cursor: 'pointer' }}
              onClick={() => target && select(it.to)}
              onKeyDown={(e) => e.key === 'Enter' && target && select(it.to)}
            >
              <rect x={x - 54} y={y - 15} width={108} height={30} rx={3} fill="var(--panel-2)" stroke="var(--line-2)" />
              <text x={x} y={y - 2} textAnchor="middle" fontSize={8.5} fill="var(--fg)">
                {short.length > 22 ? short.slice(0, 21) + '…' : short}
              </text>
              <text x={x} y={y + 9} textAnchor="middle" fontSize={7.5} fill="var(--muted)">
                {it.label}
              </text>
            </g>
          </g>
        );
      })}
      <rect x={cx - 46} y={cy - 16} width={92} height={32} rx={3} fill="#13232a" stroke="var(--accent)" />
      <text x={cx} y={cy + 3} textAnchor="middle" fontSize={9} fill="var(--accent-2)">
        {c.id.toUpperCase()}
      </text>
    </svg>
  );
}

export function Inspector() {
  const selectedId = useStore((s) => s.selectedId);
  const focusId = useStore((s) => s.focusId);
  const isolate = useStore((s) => s.isolate);
  const select = useStore((s) => s.select);
  const enlarge = useStore((s) => s.enlarge);
  const setIsolate = useStore((s) => s.setIsolate);
  const back = useStore((s) => s.returnToAircraft);
  const setTab = useStore((s) => s.setTab);
  const setDrawer = useStore((s) => s.setDrawer);
  const payloadId = useStore((s) => s.payloadId);

  const c = selectedId ? COMPONENT_MAP[selectedId] : null;

  if (!c) {
    return (
      <>
        <div className="panel-head">
          <span className="eyebrow">Inspection</span>
          <button className="btn sm ghost mobile-only" onClick={() => setDrawer('none')} aria-label="Close inspector">
            Close
          </button>
        </div>
        <div className="panel-body">
          <div className="empty">
            <h2 className="insp-title">No component selected</h2>
            <ol>
              <li>Drag to orbit, scroll or pinch to zoom, right-drag or two-finger drag to pan.</li>
              <li>Click any part of the aircraft, or pick an item in the systems list.</li>
              <li>Use <b>Enlarge</b> to inspect an assembly and pick its sub-components.</li>
              <li>Double-click empty space to reset the camera.</li>
            </ol>
            <p className="note">Every description here is a fictional design decision for a conceptual demonstrator.</p>
          </div>
        </div>
      </>
    );
  }

  const chain = chainOf(c.id).reverse();
  const kids = childrenOf(c.id);
  const module = EQUIPMENT_MODULES.find((m) => m.id === c.id);
  const inFocus = focusId === c.id;

  return (
    <>
      <div className="panel-head">
        <span className="chip accent">{c.category}</span>
        <span style={{ display: 'flex', gap: 6 }}>
          <span className="chip">{c.location}</span>
          <button className="btn sm ghost mobile-only" onClick={() => setDrawer('none')} aria-label="Close inspector">
            Close
          </button>
        </span>
      </div>
      <div className="panel-body">
        <div style={{ display: 'grid', gap: 6 }}>
          <nav className="crumbs" aria-label="Component hierarchy">
            <span>CX-7</span>
            {chain.map((id) => (
              <span key={id} style={{ display: 'contents' }}>
                <span aria-hidden>/</span>
                <button onClick={() => select(id)}>{COMPONENT_MAP[id].name}</button>
              </span>
            ))}
          </nav>
          <h2 className="insp-title">{module?.name ?? c.name}</h2>
          <p className="text-2">{module?.role ?? c.short}</p>
        </div>

        <div className="actions">
          {inFocus ? (
            <button className="btn primary" onClick={back}>
              Return to aircraft
            </button>
          ) : (
            <button className="btn primary" onClick={() => enlarge(c.id)} disabled={!c.isolatable}>
              Enlarge
            </button>
          )}
          <button className="btn" aria-pressed={isolate && focusId === c.id} onClick={() => (isolate && focusId === c.id ? setIsolate(false) : (enlarge(c.id), setIsolate(true)))}>
            {isolate && focusId === c.id ? 'Show aircraft' : 'Isolate'}
          </button>
          <button className="btn" onClick={() => select(c.id)}>
            Centre view
          </button>
          {focusId && !inFocus && (
            <button className="btn ghost" onClick={back}>
              Return to aircraft
            </button>
          )}
        </div>

        {module ? (
          <dl className="kv">
            <dt>Dimensions</dt>
            <dd>{module.dims} (fictional)</dd>
            <dt>Location</dt>
            <dd>{module.location}</dd>
            <dt>Interfaces</dt>
            <dd>{module.interfaces.join(' · ')}</dd>
            <dt>Status</dt>
            <dd>{module.status}</dd>
            <dt>Fitted</dt>
            <dd>{payloadId === c.id ? 'Yes — shown in the bay' : 'No'}</dd>
          </dl>
        ) : (
          <>
            <div>
              <div className="section-label">Conceptual function</div>
              <p className="text-2">{c.fn}</p>
            </div>
            <dl className="kv">
              <dt>ID</dt>
              <dd className="mono">{c.id}</dd>
              <dt>Parent</dt>
              <dd>{c.parent ? COMPONENT_MAP[c.parent].name : 'Airframe (top level)'}</dd>
              <dt>Visual</dt>
              <dd>{c.visual}</dd>
              <dt>Material</dt>
              <dd>{c.material}</dd>
              <dt>Visibility</dt>
              <dd>{c.location === 'external' ? 'Visible externally' : 'Internal — use Cutaway or Internal view'}</dd>
              <dt>Isolatable</dt>
              <dd>{c.isolatable ? 'Yes' : 'No'}</dd>
              <dt>Sub-parts</dt>
              <dd>{hasChildren(c.id) ? `${kids.length} selectable` : 'None'}</dd>
            </dl>
          </>
        )}

        {kids.length > 0 && (
          <div>
            <div className="section-label">Sub-components {focusId !== c.id && '· Enlarge to pick in 3D'}</div>
            <div className="related">
              {kids.map((k) => (
                <button key={k.id} className="link-btn" onClick={() => (focusId === c.id ? select(k.id) : (enlarge(c.id), select(k.id)))}>
                  {k.name.replace(c.name + ' — ', '')}
                </button>
              ))}
            </div>
          </div>
        )}

        {c.interfaces && (
          <div>
            <div className="section-label">Conceptual architecture</div>
            <InterfaceDiagram c={c} />
          </div>
        )}

        <div>
          <div className="section-label">Related</div>
          <div className="related">
            {c.related
              .filter((r) => COMPONENT_MAP[r])
              .map((r) => (
                <button key={r} className="link-btn" onClick={() => select(r)}>
                  {COMPONENT_MAP[r].name}
                </button>
              ))}
          </div>
        </div>

        <p className="note">{c.notes}</p>
        {(c.group === 'autonomy' || c.id === 'afcm') && (
          <button className="btn" onClick={() => setTab('autonomy')}>
            Open autonomy architecture
          </button>
        )}
        <p className="note">FICTIONAL DESIGN DECISION — conceptual visualisation, not a validated engineering design.</p>
      </div>
    </>
  );
}
