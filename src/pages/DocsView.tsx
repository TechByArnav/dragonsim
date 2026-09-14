import { useApp } from '../store';
import { Markdown } from '../lib/markdown';
import guide from '../../docs/USER-GUIDE.md?raw';
import components from '../../docs/COMPONENTS.md?raw';
import reference from '../../docs/REFERENCE.md?raw';
import architecture from '../../docs/ARCHITECTURE.md?raw';

const PAGES = [
  { id: 'guide', label: 'Start here (1 page)', text: guide },
  { id: 'components', label: 'Components deep-dive', text: components },
  { id: 'reference', label: 'APIs, variables, knobs', text: reference },
  { id: 'architecture', label: 'Architecture & files', text: architecture },
];

export function DocsView() {
  const s = useApp();
  const cur = PAGES.find((p) => p.id === s.docsPage) ?? PAGES[0];
  return (
    <div className="p-4 max-w-4xl mx-auto overflow-y-auto">
      <div className="flex gap-1.5 flex-wrap mb-3">
        {PAGES.map((p) => (
          <button key={p.id} onClick={() => s.set({ docsPage: p.id })}
            className={`px-3 py-1.5 rounded-full border text-xs font-bold ${cur.id === p.id ? 'bg-[#7fee64] text-black border-[#7fee64]' : 'border-[#485346] text-[#859984]'}`}>
            {p.label}
          </button>
        ))}
      </div>
      <div className="panel p-5">
        <Markdown text={cur.text} />
      </div>
    </div>
  );
}
