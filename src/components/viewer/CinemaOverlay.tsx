import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../state/store';
import { PROGRAMMES, cine, sceneAt, type Caption } from '../../aircraft/cinema';
import { inOut } from '../../aircraft/timeline';
import { Emblem } from '../brand/Logo';
import { Icon } from './Icon';

const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

/** Presentation captions, scene label and timeline (playback, scrubbing, exit). */
export function CinemaOverlay() {
  const playing = useStore((s) => s.cinemaPlaying);
  const setPlaying = useStore((s) => s.setCinemaPlaying);
  const stop = useStore((s) => s.stopCinema);
  const programId = useStore((s) => s.cinemaProgram);
  const render = useStore((s) => s.render);
  const P = PROGRAMMES[programId];
  const DURATION = P.duration;
  const SCENES = P.scenes;
  const [t, setT] = useState(0);
  const [idle, setIdle] = useState(false);
  const idleTimer = useRef(0);
  const bar = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      setT((p) => (Math.abs(p - cine.t) > 0.02 ? cine.t : p));
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // controls fade out while playing and come back on any pointer movement
  useEffect(() => {
    const wake = () => {
      setIdle(false);
      window.clearTimeout(idleTimer.current);
      idleTimer.current = window.setTimeout(() => setIdle(true), 2600);
    };
    wake();
    window.addEventListener('pointermove', wake);
    window.addEventListener('pointerdown', wake);
    window.addEventListener('keydown', wake);
    return () => {
      window.removeEventListener('pointermove', wake);
      window.removeEventListener('pointerdown', wake);
      window.removeEventListener('keydown', wake);
      window.clearTimeout(idleTimer.current);
    };
  }, []);

  const seek = (clientX: number) => {
    const r = bar.current?.getBoundingClientRect();
    if (!r) return;
    cine.t = Math.min(DURATION, Math.max(0, ((clientX - r.left) / r.width) * DURATION));
    setT(cine.t);
  };

  const caps = P.captionsAt(t, cine.clean);
  const label = caps.find((c) => c.kind === 'label');
  const cap = (k: Caption['kind']) => caps.find((c) => c.kind === k)?.opacity ?? 0;
  cine.prog = programId;
  const scene = sceneAt(t);
  const ended = t >= DURATION - 0.01;

  return (
    <div className={`cinema prog-${programId} ${idle && playing ? 'idle' : ''} ${render === 'sheet' || render === 'flow' ? 'on-white' : ''}`}>
      <TransitionLayer />
      {P.bars && <div className="cine-bars" aria-hidden />}
      {label && (
        <div className="cine-label" style={{ opacity: label.opacity }} aria-hidden>
          <span className="cl-tick" />
          {label.text}
        </div>
      )}
      {cap('logo') > 0 && (
        <div className="cine-logo" style={{ opacity: cap('logo') }} aria-hidden>
          <Emblem size={64} />
          <span className="cl-name">CORVANE</span>
          <span className="cl-sub">AEROSYSTEMS</span>
        </div>
      )}
      {cap('title') > 0 && (
        <div className="cine-title" style={{ opacity: cap('title') }} aria-hidden>
          <span className="ct-kicker">Project</span>
          <span className="ct-name">NIGHTFALL</span>
          <span className="ct-sub">CX-7 · Uncrewed research aircraft concept</span>
        </div>
      )}
      {cap('end') > 0 && (
        <div className="cine-end" style={{ opacity: cap('end') }} aria-hidden>
          <span className="ce-name">NIGHTFALL</span>
          <span className="ce-brand">
            <Emblem size={22} /> CORVANE AEROSYSTEMS
          </span>
          <span className="ce-note">Conceptual demonstrator — not flight validated</span>
        </div>
      )}
      <div className="cine-scene" aria-live="polite">
        <span className="cs-n">{String(scene.id).padStart(2, '0')}</span>
        <span className="cs-t">{scene.title}</span>
      </div>
      <div className="cine-controls">
        <button className="icon-btn" onClick={() => (ended ? ((cine.t = 0), setPlaying(true)) : setPlaying(!playing))} aria-label={playing ? 'Pause' : ended ? 'Replay' : 'Play'}>
          <Icon name={playing ? 'pause' : ended ? 'replay' : 'play'} />
        </button>
        <div
          ref={bar}
          className="cine-track"
          role="slider"
          aria-label="Presentation timeline"
          aria-valuemin={0}
          aria-valuemax={DURATION}
          aria-valuenow={Math.round(t)}
          tabIndex={0}
          onPointerDown={(e) => {
            dragging.current = true;
            (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
            seek(e.clientX);
          }}
          onPointerMove={(e) => dragging.current && seek(e.clientX)}
          onPointerUp={() => (dragging.current = false)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') (cine.t = Math.min(DURATION, cine.t + 2)), setT(cine.t);
            if (e.key === 'ArrowLeft') (cine.t = Math.max(0, cine.t - 2)), setT(cine.t);
          }}
        >
          {SCENES.map((sc) => (
            <span key={sc.id} className={`cine-seg ${scene.id === sc.id ? 'on' : ''}`} style={{ left: `${(sc.t0 / DURATION) * 100}%`, width: `${((sc.t1 - sc.t0) / DURATION) * 100}%` }}>
              <i>
                {String(sc.id).padStart(2, '0')} {sc.title}
              </i>
            </span>
          ))}
          <span className="cine-fill" style={{ width: `${(t / DURATION) * 100}%` }} />
          <span className="cine-head" style={{ left: `${(t / DURATION) * 100}%` }} />
        </div>
        <span className="cine-time tnum">
          {fmt(t)} / {fmt(DURATION)}
        </span>
        <button className="txt-btn" onClick={stop}>
          <Icon name="close" /> Exit
        </button>
      </div>
    </div>
  );
}

/**
 * The outgoing look, captured by the scene driver at a look change, handed over to the live picture:
 * a scan (a fine line sweeps across with a soft edge behind it) or a dissolve.
 */
function TransitionLayer() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const line = useRef<HTMLDivElement>(null);
  useEffect(() => {
    cine.snap = canvas.current;
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const c = canvas.current;
      const l = line.current;
      if (!c || !l) return;
      const tr = cine.active;
      if (!tr) {
        c.style.visibility = 'hidden';
        l.style.visibility = 'hidden';
        return;
      }
      const p = inOut(Math.min(1, Math.max(0, (cine.t - tr.t) / tr.dur)));
      c.style.visibility = 'visible';
      if (tr.kind === 'dissolve') {
        c.style.opacity = String(1 - p);
        c.style.maskImage = c.style.webkitMaskImage = 'none';
        l.style.visibility = 'hidden';
        return;
      }
      // the edge travels a little past both sides so the feather clears the frame
      const feather = 9;
      const e = -feather + p * (100 + 2 * feather);
      const fromLeft = tr.from !== 'right';
      // the old picture stays on the far side of the edge
      const mask = fromLeft
        ? `linear-gradient(90deg, transparent ${e - feather}%, #000 ${e}%)`
        : `linear-gradient(90deg, #000 ${100 - e}%, transparent ${100 - e + feather}%)`;
      c.style.opacity = '1';
      c.style.maskImage = c.style.webkitMaskImage = mask;
      l.style.visibility = 'visible';
      l.style.left = `${fromLeft ? e - feather / 2 : 100 - e + feather / 2}%`;
      l.style.opacity = String(Math.min(1, 4 * Math.min(p, 1 - p)));
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      cine.snap = null;
      cine.active = null;
    };
  }, []);
  return (
    <div className="cine-tr" aria-hidden>
      <canvas ref={canvas} />
      <div ref={line} className="cine-tr-line" />
    </div>
  );
}
