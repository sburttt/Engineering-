import { useEffect, useRef, useState } from 'react';
import { useStore, MODE_ORDER, type ViewMode } from '../../state/store';
import { COMPONENT_MAP } from '../../data/components';
import { PRESETS, PRESET_ORDER } from '../../aircraft/presets';
import { subscribeView, type ViewReadout } from '../../aircraft/viewReadout';
import { MATURITY } from '../../data/aircraft';
import { Emblem } from '../brand/Logo';
import { Icon } from './Icon';

const MODE_LABEL: Record<ViewMode, string> = { exterior: 'Exterior', cutaway: 'Cutaway', systems: 'Systems', payload: 'Payload' };
const MODE_HINT: Record<ViewMode, string> = {
  exterior: 'The closed airframe',
  cutaway: 'Upper starboard skin removed',
  systems: 'Shell ghosted, internal layout',
  payload: 'Bay open, mission module fitted',
};

/** Vertical project index: the four ways to look at the aircraft. */
function ModeIndex() {
  const mode = useStore((s) => s.mode);
  const setMode = useStore((s) => s.setMode);
  return (
    <nav className="mode-index" aria-label="View mode">
      {MODE_ORDER.map((m, i) => (
        <button key={m} aria-pressed={mode === m} onClick={() => setMode(m)} title={MODE_HINT[m]}>
          <span className="n">{String(i + 1).padStart(2, '0')}</span>
          <span className="l">{MODE_LABEL[m]}</span>
        </button>
      ))}
    </nav>
  );
}

const pad3 = (n: number) => String(Math.round(n) % 360).padStart(3, '0');

/** Editorial label that names the current viewing angle (live). */
function ViewLabel() {
  const preset = useStore((s) => s.preset);
  const [v, setV] = useState<ViewReadout>({ az: 0, el: 0, dist: 0 });
  useEffect(() => subscribeView(setV), []);
  const name = preset && preset !== 'internal' ? PRESETS[preset].label : preset === 'internal' ? 'Systems' : 'Free orbit';
  return (
    <div className="view-label" aria-live="off">
      <span className="vl-name">{name}</span>
      <span className="vl-num">
        AZ {pad3(v.az)}° · EL {v.el >= 0 ? '+' : '−'}
        {String(Math.abs(Math.round(v.el))).padStart(2, '0')}° · {v.dist.toFixed(1)} m
      </span>
    </div>
  );
}

function Presets() {
  const preset = useStore((s) => s.preset);
  const goPreset = useStore((s) => s.goPreset);
  return (
    <div className="presets" role="group" aria-label="Camera presets">
      {PRESET_ORDER.map((id, i) => (
        <button key={id} aria-pressed={preset === id} onClick={() => goPreset(id)} title={`${PRESETS[id].label} view (${i + 1})`}>
          {PRESETS[id].label}
        </button>
      ))}
    </div>
  );
}

function ControlsPanel() {
  const s = useStore();
  return (
    <div className="pop" role="dialog" aria-label="Viewer controls">
      {s.mode === 'systems' && (
        <div className="range">
          <span className="range-row">
            <label htmlFor="explode">Exploded view</label>
            <output htmlFor="explode">{Math.round(s.explode * 100)}%</output>
          </span>
          <input id="explode" type="range" min={0} max={1} step={0.01} value={s.explode} onChange={(e) => s.setExplode(+e.target.value)} />
        </div>
      )}
      {(s.mode === 'exterior' || s.mode === 'cutaway') && (
        <>
          <div className="range">
            <span className="range-row">
              <label htmlFor="pitch">Elevons · pitch</label>
              <output htmlFor="pitch">
                {s.pitch > 0 ? '+' : ''}
                {s.pitch}°
              </output>
            </span>
            <input id="pitch" type="range" min={-25} max={25} step={1} value={s.pitch} onChange={(e) => s.setPitch(+e.target.value)} />
          </div>
          <div className="range">
            <span className="range-row">
              <label htmlFor="roll">Elevons · roll</label>
              <output htmlFor="roll">
                {s.roll > 0 ? '+' : ''}
                {s.roll}°
              </output>
            </span>
            <input id="roll" type="range" min={-20} max={20} step={1} value={s.roll} onChange={(e) => s.setRoll(+e.target.value)} />
          </div>
        </>
      )}
      <div className="pop-row">
        <button className="chk" aria-pressed={s.bayOpen} onClick={() => s.setBayOpen(!s.bayOpen)}>
          Bay doors {s.bayOpen ? 'open' : 'closed'}
        </button>
        <button className="chk" aria-pressed={s.autoRotate} onClick={() => s.setAutoRotate(!s.autoRotate)}>
          Turntable
        </button>
        <button className="chk" aria-pressed={s.showGrid} onClick={() => s.setShowGrid(!s.showGrid)}>
          Floor grid
        </button>
      </div>
      <button className="txt-btn" onClick={s.resetAll}>
        <Icon name="reset" /> Reset viewer
      </button>
    </div>
  );
}

function Tools() {
  const panel = useStore((s) => s.panel);
  const setPanel = useStore((s) => s.setPanel);
  const zoom = useStore((s) => s.zoom);
  const resetView = useStore((s) => s.resetView);
  return (
    <div className="tools">
      <button className="txt-btn" aria-expanded={panel === 'index'} onClick={() => setPanel(panel === 'index' ? 'none' : 'index')} title="Component index">
        <Icon name="index" />
        <span className="hide-sm">Components</span>
      </button>
      <span className="tools-rule" aria-hidden />
      <div className="tools-anchor">
        <button className="txt-btn tools-toggle" aria-expanded={panel === 'controls'} onClick={() => setPanel(panel === 'controls' ? 'none' : 'controls')} title="Viewer controls">
          <Icon name="sliders" />
          <span className="hide-sm">Controls</span>
        </button>
        {panel === 'controls' && <ControlsPanel />}
      </div>
      <span className="tools-rule" aria-hidden />
      <button className="icon-btn" onClick={() => zoom(0.8)} aria-label="Zoom in" title="Zoom in (+)">
        <Icon name="plus" />
      </button>
      <button className="icon-btn" onClick={() => zoom(1.25)} aria-label="Zoom out" title="Zoom out (−)">
        <Icon name="minus" />
      </button>
      <button className="icon-btn" onClick={resetView} aria-label="Reset view" title="Reset view (R)">
        <Icon name="reset" />
      </button>
    </div>
  );
}

/** The opening caption: brand line, the NIGHTFALL designation and one invitation. */
function Caption() {
  const setImmersive = useStore((s) => s.setImmersive);
  const setTab = useStore((s) => s.setTab);
  return (
    <section className="caption" aria-label="Nightfall">
      <span className="cap-kicker">Corvane Aerosystems · CX-7</span>
      <h1 className="nf-title" aria-label="Nightfall">
        {'NIGHTFALL'.split('').map((ch, i) => (
          <span key={i} aria-hidden>
            {ch}
          </span>
        ))}
      </h1>
      <p className="cap-lede">An uncrewed, tailless research aircraft concept, shown as an interactive design study. Drag to orbit; select any part to read about it.</p>
      <div className="cap-actions">
        <button className="cta" onClick={() => setImmersive(true)}>
          Inspect the aircraft <Icon name="arrow" />
        </button>
        <button className="txt-btn" onClick={() => setTab('overview')}>
          Technical overview
        </button>
      </div>
      <span className="cap-maturity">{MATURITY}</span>
    </section>
  );
}

function FocusBar() {
  const focusId = useStore((s) => s.focusId);
  const isolate = useStore((s) => s.isolate);
  const setIsolate = useStore((s) => s.setIsolate);
  const exitFocus = useStore((s) => s.exitFocus);
  if (!focusId) return null;
  const c = COMPONENT_MAP[focusId];
  return (
    <div className="focus-bar" role="status">
      <span className="fb-l">
        Focus <b>{c?.name}</b>
      </span>
      <button className="chk" aria-pressed={isolate} onClick={() => setIsolate(!isolate)}>
        Isolate
      </button>
      <button className="txt-btn" onClick={exitFocus}>
        <Icon name="back" /> Back to aircraft
      </button>
    </div>
  );
}

/** Small label that follows the pointer over the model. */
function HoverTag() {
  const hovered = useStore((s) => s.hoveredId);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const vp = document.querySelector('.viewport');
    if (!vp) return;
    const move = (e: PointerEvent) => {
      const el = ref.current;
      if (!el) return;
      const r = vp.getBoundingClientRect();
      el.style.transform = `translate(${e.clientX - r.left + 14}px, ${e.clientY - r.top + 12}px)`;
    };
    vp.addEventListener('pointermove', move as EventListener);
    return () => vp.removeEventListener('pointermove', move as EventListener);
  }, []);
  const name = hovered ? COMPONENT_MAP[hovered]?.name : '';
  return (
    <div ref={ref} className={`hover-tag ${name ? 'on' : ''}`} aria-hidden>
      {name}
    </div>
  );
}

export function ViewerChrome() {
  const immersive = useStore((s) => s.immersive);
  const setImmersive = useStore((s) => s.setImmersive);
  const selectedId = useStore((s) => s.selectedId);
  const focusId = useStore((s) => s.focusId);
  const mode = useStore((s) => s.mode);
  const preset = useStore((s) => s.preset);
  // the caption belongs to the opening composition; it steps aside once the user explores
  const showCaption = !immersive && mode === 'exterior' && !selectedId && !focusId && preset === 'hero';
  return (
    <div className={`chrome ${immersive ? 'immersive' : ''}`}>
      <div className="frame-marks" aria-hidden>
        <i />
        <i />
        <i />
        <i />
      </div>
      {immersive && (
        <div className="imm-brand">
          <Emblem size={20} />
          <span>
            CORVANE <b>NIGHTFALL</b>
          </span>
        </div>
      )}
      {immersive && (
        <button className="txt-btn imm-exit" onClick={() => setImmersive(false)} title="Exit inspection (Esc)">
          <Icon name="collapse" /> Exit
        </button>
      )}
      <ModeIndex />
      {!immersive && <Tools />}
      <div className={`caption-wrap ${showCaption ? 'on' : ''}`} aria-hidden={!showCaption} inert={!showCaption}>
        <Caption />
      </div>
      <div className="viewbar">
        <ViewLabel />
        <Presets />
      </div>
      <FocusBar />
      <HoverTag />
    </div>
  );
}
