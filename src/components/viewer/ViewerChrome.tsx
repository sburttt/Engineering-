import { useEffect, useRef, useState } from 'react';
import { useStore, MODE_ORDER, RENDER_ORDER, type RenderMode, type ViewMode } from '../../state/store';
import { COMPONENT_MAP } from '../../data/components';
import { ASSEMBLIES, ASSEMBLY_MAP } from '../../data/assemblies';
import { PRESETS, PRESET_ORDER } from '../../aircraft/presets';
import { subscribeView, type ViewReadout } from '../../aircraft/viewReadout';
import { cine } from '../../aircraft/cinema';
import { MATURITY } from '../../data/aircraft';
import { Emblem } from '../brand/Logo';
import { Icon } from './Icon';
import { Callouts } from './Callouts';
import { CinemaOverlay } from './CinemaOverlay';

const RENDER_LABEL: Record<RenderMode, string> = { real: 'Realistic', xray: 'Transparent', wire: 'Wireframe', blueprint: 'Blueprint' };
const RENDER_HINT: Record<RenderMode, string> = {
  real: 'Studio materials and lighting',
  xray: 'Transparent shell, internal layout visible',
  wire: 'Hidden-line technical wireframe',
  blueprint: 'General-arrangement blueprint with dimensions',
};
const MODE_LABEL: Record<ViewMode, string> = { exterior: 'Closed', cutaway: 'Cutaway', payload: 'Bay open' };

/** Left rail: identity, visualisation modes, configuration and the assembly selector. */
function LeftRail() {
  const render = useStore((s) => s.render);
  const setRender = useStore((s) => s.setRender);
  const mode = useStore((s) => s.mode);
  const setMode = useStore((s) => s.setMode);
  const asm = useStore((s) => s.explodeAsm);
  const setAsm = useStore((s) => s.setExplodeAsm);
  const startCinema = useStore((s) => s.startCinema);
  const setPanel = useStore((s) => s.setPanel);
  const open = useStore((s) => s.panel === 'rail');
  return (
    <aside className={`rail ${open ? 'open' : ''}`} aria-label="Visualisation">
      <div className="rail-id">
        <span className="rail-kicker">Corvane Aerosystems · CX-7</span>
        <h1 className="nf-title" aria-label="Nightfall">
          {'NIGHTFALL'.split('').map((ch, i) => (
            <span key={i} aria-hidden>
              {ch}
            </span>
          ))}
        </h1>
        <p className="rail-lede">Uncrewed tailless research aircraft. Concept design study.</p>
        <button
          className="cta sm"
          onClick={() => {
            cine.t = 0;
            startCinema();
          }}
        >
          <Icon name="play" /> Play presentation
        </button>
      </div>

      <section className="rail-sec">
        <h2 className="rail-h">Visualisation</h2>
        <div className="rail-list" role="group" aria-label="Render mode">
          {RENDER_ORDER.map((r, i) => (
            <button key={r} aria-pressed={render === r} onClick={() => setRender(r)} title={RENDER_HINT[r]}>
              <span className="n">{String(i + 1).padStart(2, '0')}</span>
              <span className="l">{RENDER_LABEL[r]}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="rail-sec">
        <h2 className="rail-h">Configuration</h2>
        <div className="seg" role="group" aria-label="Configuration">
          {MODE_ORDER.map((m) => (
            <button key={m} aria-pressed={mode === m} onClick={() => setMode(m)} disabled={m === 'cutaway' && render !== 'real'}>
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>
      </section>

      <section className="rail-sec rail-asm">
        <h2 className="rail-h">
          Exploded assemblies
          {asm && (
            <button className="rail-reset" onClick={() => setAsm(null)}>
              Reassemble
            </button>
          )}
        </h2>
        <div className="rail-list tight" role="group" aria-label="Assemblies">
          {ASSEMBLIES.map((a) => (
            <button key={a.id} aria-pressed={asm === a.id} onClick={() => setAsm(asm === a.id ? null : a.id)}>
              <span className="l">{a.name}</span>
            </button>
          ))}
        </div>
        <button className="txt-btn rail-more" onClick={() => setPanel('index')}>
          <Icon name="index" /> All components
        </button>
      </section>
      <span className="rail-maturity">{MATURITY}</span>
    </aside>
  );
}

const pad3 = (n: number) => String(Math.round(n) % 360).padStart(3, '0');

/** Top-right: current mode and the live viewing angle. */
function ModeStatus() {
  const render = useStore((s) => s.render);
  const mode = useStore((s) => s.mode);
  const preset = useStore((s) => s.preset);
  const asm = useStore((s) => s.explodeAsm);
  const [v, setV] = useState<ViewReadout>({ az: 0, el: 0, dist: 0 });
  useEffect(() => subscribeView(setV), []);
  const viewName = preset ? PRESETS[preset].label : 'Free orbit';
  return (
    <div className="vstatus" aria-live="off">
      <span className="st-mode">
        {RENDER_LABEL[render]}
        {mode !== 'exterior' ? ` · ${MODE_LABEL[mode]}` : ''}
        {asm ? ` · Exploded: ${ASSEMBLY_MAP[asm].name}` : ''}
      </span>
      <span className="st-view">
        {viewName} · AZ {pad3(v.az)}° · EL {v.el >= 0 ? '+' : '−'}
        {String(Math.abs(Math.round(v.el))).padStart(2, '0')}°
      </span>
    </div>
  );
}

function ControlsPanel() {
  const s = useStore();
  return (
    <div className="pop" role="dialog" aria-label="Viewer controls">
      {s.render === 'xray' && (
        <div className="range">
          <span className="range-row">
            <label htmlFor="explode">Systems separation</label>
            <output htmlFor="explode">{Math.round(s.explode * 100)}%</output>
          </span>
          <input id="explode" type="range" min={0} max={1} step={0.01} value={s.explode} onChange={(e) => s.setExplode(+e.target.value)} />
        </div>
      )}
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

/** Bottom: presentation playback, numbered camera presets, zoom and reset. */
function BottomBar() {
  const preset = useStore((s) => s.preset);
  const goPreset = useStore((s) => s.goPreset);
  const panel = useStore((s) => s.panel);
  const setPanel = useStore((s) => s.setPanel);
  const zoom = useStore((s) => s.zoom);
  const resetView = useStore((s) => s.resetView);
  const startCinema = useStore((s) => s.startCinema);
  const immersive = useStore((s) => s.immersive);
  return (
    <div className="bottombar">
      {!immersive && (
        <button
          className="txt-btn bb-play"
          onClick={() => {
            cine.t = 0;
            startCinema();
          }}
          title="Play the cinematic presentation"
        >
          <Icon name="play" /> <span className="hide-sm">Presentation · 0:58</span>
        </button>
      )}
      <div className="presets" role="group" aria-label="Camera presets">
        {PRESET_ORDER.map((id, i) => (
          <button key={id} aria-pressed={preset === id} aria-label={PRESETS[id].label} onClick={() => goPreset(id)} title={`${PRESETS[id].label} view (${i + 1})`}>
            <span className="pn">{String(i + 1).padStart(2, '0')}</span>
            <span className="pl">
              <span className="pl-long">{PRESETS[id].label}</span>
              <span className="pl-short">{id === 'hero' ? '¾' : PRESETS[id].label}</span>
            </span>
          </button>
        ))}
      </div>
      <div className="bb-tools">
        <div className="tools-anchor">
          <button className="icon-btn tools-toggle" aria-expanded={panel === 'controls'} onClick={() => setPanel(panel === 'controls' ? 'none' : 'controls')} aria-label="Viewer controls" title="Viewer controls">
            <Icon name="sliders" />
          </button>
          {panel === 'controls' && <ControlsPanel />}
        </div>
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
    </div>
  );
}

function FocusBar() {
  const focusId = useStore((s) => s.focusId);
  const isolate = useStore((s) => s.isolate);
  const setIsolate = useStore((s) => s.setIsolate);
  const exitFocus = useStore((s) => s.exitFocus);
  const asm = useStore((s) => s.explodeAsm);
  const setAsm = useStore((s) => s.setExplodeAsm);
  if (asm) {
    const a = ASSEMBLY_MAP[asm];
    return (
      <div className="focus-bar" role="status">
        <span className="fb-l">
          Exploded <b>{a.name}</b>
        </span>
        <span className="fb-note">{a.note}</span>
        <button className="txt-btn" onClick={() => setAsm(null)}>
          <Icon name="back" /> Reassemble
        </button>
      </div>
    );
  }
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

/** Phones: compact identity with the presentation button, and a button that opens the rail sheet. */
function MobileId() {
  const startCinema = useStore((s) => s.startCinema);
  const panel = useStore((s) => s.panel);
  const setPanel = useStore((s) => s.setPanel);
  const render = useStore((s) => s.render);
  return (
    <>
      <button className="txt-btn m-modes" aria-expanded={panel === 'rail'} onClick={() => setPanel(panel === 'rail' ? 'none' : 'rail')}>
        <Icon name="sliders" /> {RENDER_LABEL[render]} · Modes
      </button>
      <div className="m-id">
        <h2 className="nf-title" aria-label="Nightfall">
          {'NIGHTFALL'.split('').map((ch, i) => (
            <span key={i} aria-hidden>
              {ch}
            </span>
          ))}
        </h2>
        <button
          className="txt-btn"
          onClick={() => {
            cine.t = 0;
            startCinema();
          }}
        >
          <Icon name="play" /> Play presentation
        </button>
      </div>
    </>
  );
}

/** Blueprint sheet furniture: fine grid and a title block. */
function BlueprintSheet() {
  const preset = useStore((s) => s.preset);
  return (
    <div className="bp-sheet" aria-hidden>
      <div className="bp-grid" />
      <div className="bp-title">
        <Emblem size={18} mono />
        <span>
          <b>CORVANE · CX-7 NIGHTFALL</b>
          General arrangement · {preset ? PRESETS[preset].label : 'Free'} view
        </span>
        <span>
          Concept visualisation
          <br />
          Not for construction
        </span>
      </div>
    </div>
  );
}

export function ViewerChrome() {
  const immersive = useStore((s) => s.immersive);
  const setImmersive = useStore((s) => s.setImmersive);
  const cinema = useStore((s) => s.cinema);
  const render = useStore((s) => s.render);
  if (cinema)
    return (
      <div className="chrome cine-mode">
        <Callouts />
        <CinemaOverlay />
      </div>
    );
  return (
    <div className={`chrome ${immersive ? 'immersive' : ''} r-${render}`}>
      {render === 'blueprint' && <BlueprintSheet />}
      <Callouts />
      {immersive ? (
        <>
          <div className="imm-brand">
            <Emblem size={20} />
            <span>
              CORVANE <b>NIGHTFALL</b>
            </span>
          </div>
          <button className="txt-btn imm-exit" onClick={() => setImmersive(false)} title="Exit inspection (Esc)">
            <Icon name="collapse" /> Exit
          </button>
        </>
      ) : (
        <>
          <LeftRail />
          <ModeStatus />
          <MobileId />
        </>
      )}
      <BottomBar />
      <FocusBar />
      <HoverTag />
    </div>
  );
}
