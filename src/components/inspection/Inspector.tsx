import { useStore } from '../../state/store';
import { COMPONENT_MAP, chainOf, childrenOf, type ComponentRecord } from '../../data/components';
import { EQUIPMENT_MODULES } from '../../data/equipmentModules';
import { Icon } from '../viewer/Icon';

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
            <g
              role="button"
              tabIndex={0}
              style={{ cursor: 'pointer' }}
              onClick={() => target && select(it.to)}
              onKeyDown={(e) => e.key === 'Enter' && target && select(it.to)}
            >
              <rect x={x - 54} y={y - 15} width={108} height={30} rx={2} fill="var(--bg)" stroke="var(--line-2)" />
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
      <rect x={cx - 46} y={cy - 16} width={92} height={32} rx={2} fill="var(--bg)" stroke="var(--fg-2)" />
      <text x={cx} y={cy + 3} textAnchor="middle" fontSize={9} fill="var(--fg)">
        {c.id.toUpperCase()}
      </text>
    </svg>
  );
}

const GROUP_NAME: Record<string, string> = {
  exterior: 'Exterior',
  interior: 'Interior system',
  autonomy: 'Navigation & autonomy',
  equipment: 'Equipment',
  maintenance: 'Service access',
};

/**
 * Compact information panel for the selected component. Describes what the part is and its
 * general design role; every statement is a fictional design decision for a concept model.
 */
export function Inspector() {
  const selectedId = useStore((s) => s.selectedId);
  const focusId = useStore((s) => s.focusId);
  const isolate = useStore((s) => s.isolate);
  const mode = useStore((s) => s.mode);
  const select = useStore((s) => s.select);
  const focus = useStore((s) => s.focus);
  const exitFocus = useStore((s) => s.exitFocus);
  const setIsolate = useStore((s) => s.setIsolate);
  const setTab = useStore((s) => s.setTab);
  const setPayload = useStore((s) => s.setPayload);
  const payloadId = useStore((s) => s.payloadId);

  const c = selectedId ? COMPONENT_MAP[selectedId] : null;
  if (!c) return null;

  const chain = chainOf(c.id).reverse();
  const kids = childrenOf(c.id);
  const module = EQUIPMENT_MODULES.find((m) => m.id === c.id);
  const inFocus = focusId === c.id;
  const showModules = mode === 'payload' || !!module;

  return (
    <div className="cp" role="region" aria-label={`Component: ${c.name}`}>
      <div className="cp-head">
        <span className="cp-kicker">
          {GROUP_NAME[c.group]} · {c.category}
        </span>
        <button className="icon-btn" onClick={() => select(null)} aria-label="Clear selection" title="Clear selection (Esc)">
          <Icon name="close" />
        </button>
      </div>
      {chain.length > 1 && (
        <nav className="crumbs" aria-label="Component hierarchy">
          {chain.slice(0, -1).map((id) => (
            <span key={id} style={{ display: 'contents' }}>
              <button onClick={() => select(id)}>{COMPONENT_MAP[id].name}</button>
              <span aria-hidden>/</span>
            </span>
          ))}
        </nav>
      )}
      <h2 className="cp-title">{module?.name ?? c.name}</h2>
      <p className="cp-lede">{module?.role ?? c.short}</p>

      <div className="cp-actions">
        {inFocus ? (
          <button className="cta sm" onClick={exitFocus}>
            <Icon name="back" /> Back to aircraft
          </button>
        ) : (
          <button className="cta sm" onClick={() => focus(c.id)} disabled={!c.isolatable}>
            <Icon name="focus" /> Focus view
          </button>
        )}
        <button
          className="chk"
          aria-pressed={isolate && focusId === c.id}
          onClick={() => (isolate && focusId === c.id ? setIsolate(false) : (focus(c.id), setIsolate(true)))}
          disabled={!c.isolatable}
        >
          Isolate
        </button>
      </div>

      <div className="cp-body">
        {showModules && (
          <section>
            <h3 className="cp-h">Fitted mission module</h3>
            <div className="cp-list" role="group" aria-label="Equipment modules">
              {EQUIPMENT_MODULES.map((m) => (
                <button key={m.id} aria-pressed={payloadId === m.id} onClick={() => setPayload(m.id)}>
                  {m.name}
                  {payloadId === m.id && <small>Fitted</small>}
                </button>
              ))}
            </div>
          </section>
        )}
        {module ? (
          <dl className="kv">
            <dt>Size</dt>
            <dd>{module.dims} (fictional)</dd>
            <dt>Location</dt>
            <dd>{module.location}</dd>
            <dt>Interfaces</dt>
            <dd>{module.interfaces.join(' · ')}</dd>
            <dt>Status</dt>
            <dd>{module.status}</dd>
          </dl>
        ) : (
          <>
            <section>
              <h3 className="cp-h">Design role</h3>
              <p>{c.fn}</p>
            </section>
            <section>
              <h3 className="cp-h">What you see</h3>
              <p>{c.visual}</p>
            </section>
            <section>
              <h3 className="cp-h">Finish</h3>
              <p>{c.material}</p>
            </section>
          </>
        )}

        {kids.length > 0 && (
          <section>
            <h3 className="cp-h">Parts {focusId !== c.id && <span className="cp-h-note">· focus to pick them in 3D</span>}</h3>
            <div className="cp-list">
              {kids.map((k) => (
                <button key={k.id} onClick={() => (focusId === c.id ? select(k.id, { fly: true }) : (focus(c.id), select(k.id)))}>
                  {k.name.replace(c.name + ' — ', '')}
                </button>
              ))}
            </div>
          </section>
        )}

        {c.interfaces && (
          <details className="cp-details">
            <summary>Conceptual interfaces</summary>
            <InterfaceDiagram c={c} />
          </details>
        )}

        {c.related.some((r) => COMPONENT_MAP[r]) && (
          <section>
            <h3 className="cp-h">Related</h3>
            <div className="cp-related">
              {c.related
                .filter((r) => COMPONENT_MAP[r])
                .map((r) => (
                  <button key={r} className="link-btn" onClick={() => select(r, { fly: true })}>
                    {COMPONENT_MAP[r].name}
                  </button>
                ))}
            </div>
          </section>
        )}
        {(c.group === 'autonomy' || c.id === 'afcm') && (
          <button className="txt-btn" onClick={() => setTab('autonomy')}>
            Autonomy architecture <Icon name="arrow" />
          </button>
        )}
        <p className="note">
          {c.notes} Fictional design decision for a concept visualisation — not validated engineering.
        </p>
      </div>
    </div>
  );
}
