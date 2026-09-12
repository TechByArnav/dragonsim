import { useApp } from './store';
import { Home } from './pages/Home';
import { Workspace } from './pages/Workspace';

export default function App() {
  const view = useApp((s) => s.view);
  if (view === 'home') return <Home />;
  return <Workspace />;
}
