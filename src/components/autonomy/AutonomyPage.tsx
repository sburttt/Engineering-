import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../../state/store';
import { CAPABILITIES, LAYERS, LEVELS, LINKS, SAFETY, SCENARIOS, type ScenarioEvent } from '../../data/autonomy';

const NW = 168;
const NH = 50;

function Architecture({ sel, onSel, affected }: { sel: string; onSel: (id: string) => void; affected: string[] }) {
  const byId = useMemo(() => Object.fromEntries(LAYERS.map((l) => [l.id, l])), []);
  return (
    <svg className="arch" viewBox="-20 10 840 480" role="group" aria-label="Conceptual autonomy architecture">
      {LINKS.map(([a, b]) => {
        const A = byId[a];
        const B = byId[b];
        const active = a === sel || b === sel || (affected.includes(a) && affected.includes(b));
        const my = (A.y + B.y) / 2;
        const d = `M${A.x} ${A.y} C ${A.x} ${my}, ${B.x} ${my}, ${B.x} ${B.y}`;
        return (
          <g key={a + b}>
            <path className="edge" d={d} />
            {active && <path className="edge flow" d={d} />}
          </g>
        );
      })}
      {LAYERS.map((l) => (
        <g
          key={l.id}
          className={`node ${sel === l.id ? 'sel' : ''} ${affected.includes(l.id) ? 'affected' : ''}`}
          transform={`translate(${l.x - NW / 2} ${l.y - NH / 2})`}
          role="button"
          tabIndex={0}
          aria-pressed={sel === l.id}
          aria-label={l.name}
          onClick={() => onSel(l.id)}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onSel(l.id))}
        >
          <rect width={NW} height={NH} rx={4} />
          <text x={10} y={21}>{l.name.length > 26 ? l.name.slice(0, 25) + '…' : l.name}</text>
          <text className="s" x={10} y={37}>{l.short}</text>
        </g>
      ))}
    </svg>
  );
}

function fmt(t: number) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `T+${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function Simulation({ onAffected }: { onAffected: (ids: string[]) => void }) {
  const scenarioId = useStore((s) => s.scenario);
  const setScenario = useStore((s) => s.setScenario);
  const sc = SCENARIOS.find((s) => s.id === scenarioId)!;
  const [elapsed, setElapsed] = useState(0);
  const [decision, setDecision] = useState<null | 'approve' | 'hold'>(null);
  const [terminated, setTerminated] = useState(false);
  const [extra, setExtra] = useState<ScenarioEvent[]>([]);
  const [run, setRun] = useState(0);

  useEffect(() => {
    setElapsed(0);
    setDecision(null);
    setTerminated(false);
    setExtra([]);
    onAffected(sc.affected);
    const id = window.setInterval(() => setElapsed((e) => e + 0.5), 500);
    return () => window.clearInterval(id);
  }, [scenarioId, run]); // eslint-disable-line react-hooks/exhaustive-deps

  const events = [...sc.events.filter((e) => e.t <= elapsed), ...extra];
  const lastT = sc.events[sc.events.length - 1].t;
  const awaiting = !!sc.authorisation && elapsed >= lastT && !decision && !terminated;
  const jitter = (n: number, k: number) => (terminated ? n : Math.max(0, Math.min(100, n + Math.round(Math.sin(elapsed * 1.7 + k) * 1.5))));
  const ramp = Math.min(1, elapsed / 2);
  const base = SCENARIOS[0].telemetry;
  const tel = {
    link: jitter(base.link + (sc.telemetry.link - base.link) * ramp, 1),
    nav: jitter(base.nav + (sc.telemetry.nav - base.nav) * ramp, 2),
    health: jitter(base.health + (sc.telemetry.health - base.health) * ramp, 3),
    margin: jitter(base.margin + (sc.telemetry.margin - base.margin) * ramp, 4),
  };
  const color = (v: number) => (v > 75 ? 'var(--ok)' : v > 45 ? 'var(--caution)' : 'var(--warn)');
  const decide = (d: 'approve' | 'hold') => {
    setDecision(d);
    const msg = d === 'approve' ? sc.authorisation!.approvedMsg : sc.authorisation!.heldMsg;
    setExtra((x) => [...x, { t: elapsed, level: 'info', msg }]);
    if (d === 'approve' && sc.id === 'abort') setTerminated(true);
  };
  const terminate = () => {
    setTerminated(true);
    setExtra((x) => [...x, { t: elapsed, level: 'info', msg: 'Operator terminated simulation — synthetic run closed (logged)' }]);
  };
  const mode = terminated ? 'SIMULATION TERMINATED' : decision === 'approve' ? 'RETURN CORRIDOR A · AUTHORISED' : sc.mode;
  const sev = terminated ? 'ok' : sc.severity === 'nominal' ? 'ok' : sc.severity === 'caution' ? 'caution' : 'warn';

  return (
    <div className="sim">
      <div className="sim-list" role="group" aria-label="Simulation scenarios">
        {SCENARIOS.map((s) => (
          <button key={s.id} className="sim-btn" aria-pressed={s.id === scenarioId} onClick={() => (s.id === scenarioId ? setRun((r) => r + 1) : setScenario(s.id))}>
            <b>{s.name}</b>
            <span style={{ fontSize: 12 }}>{s.summary}</span>
          </button>
        ))}
      </div>
      <div className="console" aria-label="Simulated supervisory interface">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'grid', gap: 4 }}>
            <span className="eyebrow">Supervisory display · simulated data only</span>
            <span className="mono" style={{ fontSize: 13 }}>{mode}</span>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className={`chip ${sev}`}><i className="dot" /> {terminated ? 'SAFE' : sc.severity.toUpperCase()}</span>
            <span className="chip mono tnum">{fmt(elapsed)}</span>
            <button className="btn sm" onClick={() => setRun((r) => r + 1)}>Restart</button>
            <button className="btn sm" onClick={terminate} disabled={terminated}>Terminate sim</button>
          </div>
        </div>
        <div className="gauges">
          {([['Supervisor link', tel.link], ['Nav confidence', tel.nav], ['System health', tel.health], ['Envelope margin', tel.margin]] as const).map(([k, v]) => (
            <div key={k} className="gauge">
              <span className="eyebrow">{k}</span>
              <b className="tnum" style={{ color: color(v) }}>{Math.round(v)}%</b>
              <div className="track"><div className="fill" style={{ width: `${v}%`, background: color(v) }} /></div>
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, fontSize: 12.5 }}>
          <div><span className="eyebrow">Safe state</span><div className="text-2">{terminated ? 'Simulation closed cleanly' : sc.safeState}</div></div>
          <div><span className="eyebrow">Layers involved</span><div className="text-2">{sc.affected.length ? sc.affected.map((a) => LAYERS.find((l) => l.id === a)?.name).join(', ') : 'None'}</div></div>
        </div>
        {awaiting && (
          <div className="auth" role="alertdialog" aria-label="Human authorisation required">
            <span className="eyebrow" style={{ color: '#e2b56a' }}>Human authorisation required</span>
            <span>{sc.authorisation!.prompt}</span>
            <div className="actions">
              <button className="btn primary" onClick={() => decide('approve')}>{sc.authorisation!.approve}</button>
              <button className="btn" onClick={() => decide('hold')}>{sc.authorisation!.hold}</button>
            </div>
          </div>
        )}
        <div>
          <span className="eyebrow">Audit log</span>
          <ul className="log" aria-live="polite">
            {events.map((e, i) => (
              <li key={i}>
                <span className="t">{fmt(e.t)}</span>
                <span className={`lv lv-${e.level}`}>{e.level.toUpperCase()}</span>
                <span className={`lv-${e.level}`}>{e.msg}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export function AutonomyPage() {
  const [sel, setSel] = useState('oversight');
  const [affected, setAffected] = useState<string[]>([]);
  const layer = LAYERS.find((l) => l.id === sel)!;
  const select = useStore((s) => s.select);
  const setTab = useStore((s) => s.setTab);
  return (
    <div className="doc">
      <div className="doc-inner">
        <header className="doc-head">
          <span className="eyebrow">Autonomy · conceptual research architecture</span>
          <h1>Supervised by design</h1>
          <p>
            CX-7 has no cockpit. Its autonomy concept is a set of layers hosted on the flight-computing module, with people
            setting intent and approving consequential changes. This is an advanced research concept. It is not a certified,
            proven or operational autonomous system, and real use would need extensive simulation, hardware testing,
            verification and regulatory review.
          </p>
        </header>

        <section className="grid-2" style={{ gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)' }}>
          <div className="card" style={{ padding: 10 }}>
            <Architecture sel={sel} onSel={setSel} affected={affected} />
          </div>
          <div className="card" style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
            <span className="eyebrow">Selected layer</span>
            <h2 style={{ fontSize: 17 }}>{layer.name}</h2>
            <p className="text-2">{layer.detail}</p>
            <p className="note">Click any layer in the diagram. Amber outlines show the layers involved in the running simulation.</p>
            <button className="btn" style={{ justifySelf: 'start' }} onClick={() => (setTab('internal'), select('afcm'))}>
              Show the flight-computing module in 3D
            </button>
          </div>
        </section>

        <section style={{ display: 'grid', gap: 10 }}>
          <span className="eyebrow">Interactive simulation · harmless, synthetic, not connected to anything</span>
          <Simulation onAffected={setAffected} />
        </section>

        <section style={{ display: 'grid', gap: 10 }}>
          <span className="eyebrow">Levels of autonomy</span>
          <div className="levels">
            {LEVELS.map((l) => (
              <div key={l.name} className={l.cx7 ? 'on' : ''}>
                <b>{l.name}</b>
                <span>{l.who}</span>
                {l.cx7 && <span className="chip accent" style={{ justifySelf: 'start' }}>CX-7 concept target</span>}
              </div>
            ))}
          </div>
          <p className="note">The CX-7 concept target is supervised autonomy. That is a design aspiration, not a demonstrated capability.</p>
        </section>

        <section style={{ display: 'grid', gap: 10 }}>
          <span className="eyebrow">Capability matrix</span>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Conceptual feature</th><th>Intended purpose</th><th>Required validation</th><th>Status</th></tr>
              </thead>
              <tbody>
                {CAPABILITIES.map((c) => (
                  <tr key={c.feature}>
                    <td className="k" style={{ whiteSpace: 'normal' }}>{c.feature}</td>
                    <td>{c.purpose}</td>
                    <td>{c.validation}</td>
                    <td><span className="chip">{c.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section style={{ display: 'grid', gap: 10 }}>
          <span className="eyebrow">Safety & human oversight</span>
          <div className="grid-4">
            {SAFETY.map((s) => (
              <div key={s.title} className="card" style={{ display: 'grid', gap: 6, alignContent: 'start' }}>
                <b style={{ fontWeight: 500 }}>{s.title}</b>
                <span className="text-2" style={{ fontSize: 13 }}>{s.text}</span>
              </div>
            ))}
          </div>
        </section>
        <p className="disclaimer">
          The CX-7 is a fictional, non-weapon research concept. This page describes responsible system architecture at a high
          level only. It contains no operational tactics, targeting logic or real flight-control software.
        </p>
      </div>
    </div>
  );
}
