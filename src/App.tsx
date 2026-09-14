import { Suspense, lazy } from 'react';
import { useApp } from './store';
import { Home } from './pages/Home';

// The 3D simulator (three.js) loads on demand so first paint stays instant,
// even on weak machines. Nothing heavy downloads until you leave Home.
const Workspace = lazy(() => import('./pages/Workspace').then((m) => ({ default: m.Workspace })));

export default function App() {
  const view = useApp((s) => s.view);
  if (view === 'home') return <Home />;
  return (
    <Suspense
      fallback={
        <div className="h-full flex items-center justify-center bg-black">
          <div className="codewin p-4 font-mono text-sm text-[#ddffdc]">Loading 3D simulator…</div>
        </div>
      }
    >
      <Workspace />
    </Suspense>
  );
}
