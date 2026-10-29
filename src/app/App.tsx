import { Component, Suspense, lazy, useEffect, useState, type ReactNode } from 'react';
import { useStore, parseHash } from '../state/store';
import { Header } from '../components/layout/Header';
import { SystemsTree } from '../components/layout/SystemsTree';
import { Inspector } from '../components/inspection/Inspector';
import { ViewerChrome } from '../components/viewer/ViewerChrome';
import { TechnicalOverview } from '../components/overview/TechnicalOverview';
import { SpecsPage } from '../components/specifications/SpecsPage';
import { ResearchPage } from '../components/research/ResearchPage';
import { AutonomyPage } from '../components/autonomy/AutonomyPage';
import { TopView, SideView } from '../components/specifications/ThreeView';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

const AircraftScene = lazy(() => import('../aircraft/AircraftScene'));

function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

function Fallback({ reason }: { reason: string }) {
  return (
    <div className="doc" style={{ position: 'absolute' }}>
      <div className="doc-inner">
        <div className="doc-head">
          <span className="eyebrow">3D viewer unavailable</span>
          <h1>WebGL could not start</h1>
          <p>
            {reason} The rest of the site works without 3D: the overview, specification, research and autonomy pages. Try a recent
            version of Chrome, Edge, Firefox or Safari with hardware acceleration turned on.
          </p>
        </div>
        <div className="drawings">
          <figure>
            <TopView />
            <figcaption>Plan view, nose up</figcaption>
          </figure>
          <figure>
            <SideView />
            <figcaption>Profile on the centreline</figcaption>
          </figure>
        </div>
      </div>
    </div>
  );
}

class SceneBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(e: Error) {
    return { error: e.message || 'The 3D renderer stopped unexpectedly.' };
  }
  componentDidCatch() {
    useStore.getState().setRenderStatus('unavailable');
  }
  render() {
    return this.state.error ? <Fallback reason={`The 3D renderer reported an error (${this.state.error}).`} /> : this.props.children;
  }
}

function useHashRouting() {
  const tab = useStore((s) => s.tab);
  const mode = useStore((s) => s.mode);
  useEffect(() => {
    const read = () => {
      const r = parseHash(location.hash);
      if (!r) return;
      const s = useStore.getState();
      s.setTab(r.tab);
      if (r.mode) s.setMode(r.mode);
    };
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, []);
  useEffect(() => {
    const h = '#' + tab;
    try {
      if (location.hash !== h) history.replaceState(null, '', h);
    } catch {
      /* sandboxed frames may refuse history access */
    }
  }, [tab, mode]);
}

/** Full-screen inspection: also ask the browser for real full screen where it is allowed. */
function useFullscreenSync() {
  const immersive = useStore((s) => s.immersive);
  useEffect(() => {
    const el = document.documentElement;
    try {
      if (immersive && !document.fullscreenElement && el.requestFullscreen) el.requestFullscreen().catch(() => {});
      if (!immersive && document.fullscreenElement) document.exitFullscreen().catch(() => {});
    } catch {
      /* embedded frames may not allow full screen; the in-page mode still works */
    }
  }, [immersive]);
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement && useStore.getState().immersive) useStore.getState().setImmersive(false);
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
}

export default function App() {
  const tab = useStore((s) => s.tab);
  const panel = useStore((s) => s.panel);
  const status = useStore((s) => s.renderStatus);
  const immersive = useStore((s) => s.immersive);
  const selected = useStore((s) => s.selectedId);
  const [gl] = useState(webglAvailable);
  useHashRouting();
  useKeyboardShortcuts();
  useFullscreenSync();

  useEffect(() => {
    if (!gl) useStore.getState().setRenderStatus('unavailable');
  }, [gl]);

  const showScene = tab === 'aircraft';

  const onDoubleClick = () => {
    const s = useStore.getState();
    if (s.hoveredId) s.focus(s.hoveredId);
    else s.resetView();
  };

  return (
    <div className={`app tab-${tab} ${immersive ? 'is-immersive' : ''} ${selected ? 'has-sel' : ''}`}>
      <Header />
      <main className="main">
        <div className={`stage ${showScene ? '' : 'hidden'}`} aria-hidden={!showScene}>
          <div className="viewport" onDoubleClick={onDoubleClick}>
            {gl ? (
              <SceneBoundary>
                <Suspense fallback={null}>
                  <AircraftScene active={showScene} />
                </Suspense>
              </SceneBoundary>
            ) : (
              <Fallback reason="This browser or device did not provide a WebGL context." />
            )}
            {gl && (
              <div className={`loading ${status !== 'loading' ? 'done' : ''}`} aria-hidden={status !== 'loading'}>
                <span className="eyebrow">Building the airframe</span>
                <div className="bar" />
              </div>
            )}
            {gl && status !== 'unavailable' && <ViewerChrome />}
          </div>
          <aside className={`index-panel ${panel === 'index' ? 'open' : ''}`} aria-label="Component index" inert={panel !== 'index'}>
            <SystemsTree />
          </aside>
          <aside className={`cp-wrap ${selected ? 'open' : ''}`} aria-label="Component information">
            <Inspector />
          </aside>
        </div>
        {tab === 'overview' && <TechnicalOverview />}
        {tab === 'specs' && <SpecsPage />}
        {tab === 'research' && <ResearchPage />}
        {tab === 'autonomy' && <AutonomyPage />}
      </main>
    </div>
  );
}
