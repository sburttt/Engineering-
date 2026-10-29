import { Component, Suspense, lazy, useEffect, useRef, useState, type ReactNode } from 'react';
import { useStore, TAB_ORDER, VIEWER_TABS, type Tab } from '../state/store';
import { TopNav } from '../components/layout/TopNav';
import { StatusBar } from '../components/layout/StatusBar';
import { SystemsTree } from '../components/layout/SystemsTree';
import { Inspector } from '../components/inspection/Inspector';
import { ViewportUI } from '../components/controls/ViewportUI';
import { Overview } from '../components/overview/Overview';
import { SpecsPage } from '../components/specifications/SpecsPage';
import { ResearchPage } from '../components/research/ResearchPage';
import { AutonomyPage } from '../components/autonomy/AutonomyPage';
import { TopView, SideView } from '../components/specifications/ThreeView';
import { Emblem } from '../components/brand/Logo';
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
            {reason} The rest of the presentation still works: the specification sheet, research library and autonomy pages do not
            need 3D. Try a recent version of Chrome, Edge, Firefox or Safari with hardware acceleration turned on.
          </p>
        </div>
        <div className="grid-2">
          <div className="card"><TopView /></div>
          <div className="card"><SideView /></div>
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
  const setTab = useStore((s) => s.setTab);
  useEffect(() => {
    const read = () => {
      const h = location.hash.replace('#', '') as Tab;
      if (TAB_ORDER.includes(h)) setTab(h);
    };
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, [setTab]);
  useEffect(() => {
    try {
      if (location.hash !== '#' + tab) history.replaceState(null, '', '#' + tab);
    } catch {
      /* sandboxed frames may refuse history access */
    }
  }, [tab]);
}

export default function App() {
  const tab = useStore((s) => s.tab);
  const drawer = useStore((s) => s.drawer);
  const status = useStore((s) => s.renderStatus);
  const selectedId = useStore((s) => s.selectedId);
  const [gl] = useState(webglAvailable);
  useHashRouting();
  useKeyboardShortcuts();

  useEffect(() => {
    if (!gl) useStore.getState().setRenderStatus('unavailable');
  }, [gl]);

  // On narrow screens, open the inspection sheet when something is selected.
  const prevSel = useRef<string | null>(null);
  useEffect(() => {
    if (selectedId && selectedId !== prevSel.current && window.matchMedia('(max-width: 900px)').matches) useStore.getState().setDrawer('inspector');
    prevSel.current = selectedId;
  }, [selectedId]);

  const viewerTab = VIEWER_TABS.includes(tab);
  const showScene = viewerTab || tab === 'overview';

  const onDoubleClick = () => {
    const s = useStore.getState();
    if (s.hoveredId) s.enlarge(s.hoveredId);
    else s.resetView();
  };

  return (
    <div className={`app mode-${tab}`}>
      <TopNav />
      <main className="main">
        <div className={`viewer-grid ${showScene ? '' : 'hidden'}`} aria-hidden={!showScene}>
          <aside className={`side ${drawer === 'systems' ? 'open' : ''}`} aria-label="Aircraft systems">
            <SystemsTree />
          </aside>
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
                <div style={{ display: 'grid', justifyItems: 'center', color: 'var(--fg-2)' }}>
                  <Emblem size={40} />
                  <span className="eyebrow" style={{ marginTop: 12 }}>Generating CX-7 geometry</span>
                  <div className="bar" />
                </div>
              </div>
            )}
            {viewerTab && gl && <ViewportUI />}
            {tab === 'overview' && <Overview />}
          </div>
          <aside className={`insp ${drawer === 'inspector' ? 'open' : ''}`} aria-label="Component inspection">
            <Inspector />
          </aside>
        </div>
        {tab === 'specs' && <SpecsPage />}
        {tab === 'research' && <ResearchPage />}
        {tab === 'autonomy' && <AutonomyPage />}
      </main>
      <StatusBar />
    </div>
  );
}
