import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../state/store';
import { DURATION, SCENES, captionsAt, cine, sceneAt, type Caption } from '../../aircraft/cinema';
import { Emblem } from '../brand/Logo';
import { Icon } from './Icon';

const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

/** Presentation captions, scene label and timeline (playback, scrubbing, exit). */
export function CinemaOverlay() {
  const playing = useStore((s) => s.cinemaPlaying);
  const setPlaying = useStore((s) => s.setCinemaPlaying);
  const stop = useStore((s) => s.stopCinema);
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

  const caps = captionsAt(t);
  const cap = (k: Caption['kind']) => caps.find((c) => c.kind === k)?.opacity ?? 0;
  const scene = sceneAt(t);
  const ended = t >= DURATION - 0.01;

  return (
    <div className={`cinema ${idle && playing ? 'idle' : ''}`}>
      <div className="cine-bars" aria-hidden />
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
