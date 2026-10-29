import { useMemo, useState } from 'react';
import { useStore } from '../../state/store';
import { COMPONENTS, GROUP_LABELS, chainOf, childrenOf, type ComponentGroup, type ComponentRecord } from '../../data/components';
import { Icon } from '../viewer/Icon';

const GROUP_ORDER: ComponentGroup[] = ['exterior', 'interior', 'autonomy', 'equipment', 'maintenance'];

function Item({ c, child }: { c: ComponentRecord; child?: boolean }) {
  const selected = useStore((s) => s.selectedId);
  const select = useStore((s) => s.select);
  const payloadId = useStore((s) => s.payloadId);
  const isPayload = c.id.startsWith('payload-');
  const current = selected === c.id;
  return (
    <button
      className={`tree-item ${child ? 'child' : ''} ${c.location === 'internal' ? 'int' : ''}`}
      aria-current={current}
      onClick={() => select(c.id, { fly: true })}
      title={c.short}
    >
      <span className="tree-mark" aria-hidden />
      <span>{c.name}</span>
      <small>{isPayload ? (payloadId === c.id ? 'Fitted' : '') : c.location === 'internal' ? 'Int' : 'Ext'}</small>
    </button>
  );
}

export function SystemsTree() {
  const [q, setQ] = useState('');
  const selected = useStore((s) => s.selectedId);
  const focus = useStore((s) => s.focusId);
  const setPanel = useStore((s) => s.setPanel);
  const open = new Set([...(selected ? chainOf(selected) : []), ...(focus ? chainOf(focus) : [])]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return null;
    return COMPONENTS.filter((c) => (c.name + ' ' + c.category + ' ' + c.short).toLowerCase().includes(t));
  }, [q]);

  return (
    <>
      <div className="panel-head">
        <span className="eyebrow">Components · {COMPONENTS.length}</span>
        <button className="icon-btn" onClick={() => setPanel('none')} aria-label="Close component index">
          <Icon name="close" />
        </button>
      </div>
      <div className="panel-body">
        <label className="sr-only" htmlFor="tree-search">Filter components</label>
        <input id="tree-search" className="tree-search" placeholder="Filter components…" value={q} onChange={(e) => setQ(e.target.value)} />
        {filtered ? (
          <div className="tree-group">
            <span className="eyebrow">{filtered.length} matches</span>
            {filtered.length === 0 && <p className="text-2" style={{ fontSize: 12.5, padding: '0 6px' }}>No components match “{q}”.</p>}
            {filtered.map((c) => (
              <Item key={c.id} c={c} />
            ))}
          </div>
        ) : (
          GROUP_ORDER.map((g) => (
            <div className="tree-group" key={g}>
              <span className="eyebrow">{GROUP_LABELS[g]}</span>
              {COMPONENTS.filter((c) => c.group === g && c.parent === null).map((c) => (
                <div key={c.id}>
                  <Item c={c} />
                  {open.has(c.id) && childrenOf(c.id).map((k) => (
                    <div key={k.id}>
                      <Item c={k} child />
                      {open.has(k.id) && childrenOf(k.id).map((kk) => <Item key={kk.id} c={kk} child />)}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))
        )}
        <div className="legend" aria-label="Legend">
          <span><i className="tree-mark" style={{ display: 'inline-block' }} /> External</span>
          <span><i className="tree-mark" style={{ display: 'inline-block', borderRadius: '50%' }} /> Internal</span>
        </div>
      </div>
    </>
  );
}
