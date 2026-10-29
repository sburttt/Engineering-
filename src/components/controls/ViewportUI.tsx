import { useState } from 'react';
import { useStore, type Cutaway } from '../../state/store';
import { COMPONENT_MAP } from '../../data/components';
import { PRESETS, PRESET_ORDER } from '../../aircraft/presets';

const CUTS: { id: Cutaway; label: string }[] = [
  { id: 'exterior', label: 'Exterior' },
  { id: 'partial', label: 'Partial' },
  { id: 'internal', label: 'Internal' },
];

export function ViewportUI() {
  const s = useStore();
  // Display panel: open by default on large screens; collapsed elsewhere so it does not cover the model.
  const [toolsOpen, setToolsOpen] = useState(() => typeof window === 'undefined' || window.innerWidth >= 1400);
  const hovered = s.hoveredId ? COMPONENT_MAP[s.hoveredId] : null;
  const focus = s.focusId ? COMPONENT_MAP[s.focusId] : null;

  return (
    <div className="vp-ui">
      <div className="vp-top">
        <div className="vp-readout">
          <div className="vp-hover" aria-live="polite">
            {hovered ? (
              <>
                <span style={{ color: 'var(--accent-2)' }}>●</span> {hovered.name}
              </>
            ) : (
              <span style={{ color: 'var(--muted)' }}>Hover or tap a component</span>
            )}
          </div>
        </div>
        <div style={{ display: 'grid', gap: 8, justifyItems: 'end', position: 'relative' }}>
          <div className="tool-row">
            <button className="btn sm tools-toggle" aria-expanded={toolsOpen} onClick={() => setToolsOpen((v) => !v)}>
              {toolsOpen ? 'Hide display' : 'Display'}
            </button>
            <button className="btn sm" onClick={() => s.zoom(0.8)} aria-label="Zoom in" title="Zoom in (+)">
              +
            </button>
            <button className="btn sm" onClick={() => s.zoom(1.25)} aria-label="Zoom out" title="Zoom out (−)">
              −
            </button>
            <button className="btn sm" onClick={s.resetView} title="Reset camera (or double-click empty space)">
              Reset camera
            </button>
          </div>
          <div className={`vp-tools ${toolsOpen ? 'open' : 'closed'}`}>
            <div className="range">
              <span className="range-row">
                <label id="cut-l">Shell</label>
              </span>
              <div className="seg" role="group" aria-labelledby="cut-l">
                {CUTS.map((c) => (
                  <button key={c.id} aria-pressed={s.cutaway === c.id} onClick={() => s.setCutaway(c.id)}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="range">
              <span className="range-row">
                <label htmlFor="explode">Exploded view</label>
                <output htmlFor="explode">{Math.round(s.explode * 100)}%</output>
              </span>
              <input id="explode" type="range" min={0} max={1} step={0.01} value={s.explode} onChange={(e) => s.setExplode(+e.target.value)} />
            </div>
            {(s.tab === 'exterior' || s.tab === 'cutaway') && (
              <>
                <div className="range">
                  <span className="range-row">
                    <label htmlFor="pitch">Elevons · pitch</label>
                    <output htmlFor="pitch">{s.pitch > 0 ? '+' : ''}{s.pitch}°</output>
                  </span>
                  <input id="pitch" type="range" min={-25} max={25} step={1} value={s.pitch} onChange={(e) => s.setPitch(+e.target.value)} />
                </div>
                <div className="range">
                  <span className="range-row">
                    <label htmlFor="roll">Elevons · roll</label>
                    <output htmlFor="roll">{s.roll > 0 ? '+' : ''}{s.roll}°</output>
                  </span>
                  <input id="roll" type="range" min={-20} max={20} step={1} value={s.roll} onChange={(e) => s.setRoll(+e.target.value)} />
                </div>
              </>
            )}
            <div className="tool-row">
              <button className="btn sm" aria-pressed={s.bayOpen} onClick={() => s.setBayOpen(!s.bayOpen)}>
                {s.bayOpen ? 'Close bay doors' : 'Open bay doors'}
              </button>
              <button className="btn sm" aria-pressed={s.autoRotate} onClick={() => s.setAutoRotate(!s.autoRotate)}>
                Auto-rotate
              </button>
              <button className="btn sm" aria-pressed={s.showGrid} onClick={() => s.setShowGrid(!s.showGrid)}>
                Grid
              </button>
              <button className="btn sm" onClick={s.resetAll} title="Reset viewer: camera, selection, cutaway, explode, surfaces">
                Reset all
              </button>
            </div>
          </div>
        </div>
      </div>

      {focus && (
        <div className="focus-bar" role="status">
          <span className="lbl">
            {s.isolate ? 'ISOLATED' : 'ENLARGED'} · <b>{focus.name}</b>
          </span>
          <button className="btn sm" aria-pressed={s.isolate} onClick={() => s.setIsolate(!s.isolate)}>
            {s.isolate ? 'Show context' : 'Isolate'}
          </button>
          <button className="btn sm primary" onClick={s.returnToAircraft}>
            Return to aircraft
          </button>
        </div>
      )}

      <div className="vp-presets" role="group" aria-label="Camera presets">
        {PRESET_ORDER.map((id) => (
          <button key={id} aria-pressed={s.preset === id} onClick={() => s.goPreset(id)}>
            {PRESETS[id].label}
          </button>
        ))}
      </div>
      <div className="vp-axes" aria-hidden>
        X FORWARD · Y UP · Z STARBOARD
        <br />
        DRAG ORBIT · WHEEL ZOOM · RIGHT-DRAG PAN
      </div>
      <div className="mobile-bar">
        <button className="btn" onClick={() => s.setDrawer(s.drawer === 'systems' ? 'none' : 'systems')} aria-expanded={s.drawer === 'systems'}>
          Systems
        </button>
        <button className="btn" onClick={() => s.setDrawer(s.drawer === 'inspector' ? 'none' : 'inspector')} aria-expanded={s.drawer === 'inspector'}>
          {s.selectedId ? 'Inspect' : 'Inspector'}
        </button>
      </div>
    </div>
  );
}
