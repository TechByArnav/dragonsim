import { useEffect, useState } from 'react';
import { useApp } from '../store';

interface Asset { name: string; sizeMB: number; kind: string; note: string; tags: string[] }

const BUILTIN: Asset[] = [
  { name: '2026GameManual.pdf', sizeMB: 4.8, kind: 'PDF · 166 pp · TU22', note: 'Rules authority: scoring, HUB Table 6-3, robot limits R103–R107', tags: ['rules', 'scoring', 'measurement'] },
  { name: '2026-field-dimension-dwgs.pdf', sizeMB: 28.4, kind: 'PDF · 31 pp · FE-2026 Rev B', note: 'Field truth: footprint + reference dims (parentheses = no tolerance)', tags: ['field', 'measurement'] },
  { name: '2026-field-dwg-game-specific.pdf', sizeMB: 184.0, kind: 'PDF · 196 pp', note: 'Fabrication: HUB/BUMP/TRENCH/OUTPOST/TOWER/DEPOT', tags: ['field', 'mechanism'] },
  { name: 'FE-2026- REBUILT Playing Field.step', sizeMB: 21.5, kind: 'STEP AP242 · Onshape', note: 'Official 3D representation per §5.1', tags: ['field', 'cad'] },
  { name: 'REBUILT Presented by Haas Game Animation_720p.mp4', sizeMB: 11.4, kind: 'Video · 720p · official', note: 'Flow concept only — never dims', tags: ['strategy'] },
  { name: "REBUILT Match Strategies [FRC Saturday's]_720p.mp4", sizeMB: 136.3, kind: 'Video · 720p · unofficial', note: 'Third-party ideas — speculative', tags: ['strategy'] },
];

export function ContextView() {
  const [ann, setAnn] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState('all');
  useEffect(() => {
    try { setAnn(JSON.parse(localStorage.getItem('dragonsim-annotations') ?? '{}')); } catch { /* noop */ }
  }, []);
  const save = (k: string, v: string) => {
    const n = { ...ann, [k]: v };
    setAnn(n);
    localStorage.setItem('dragonsim-annotations', JSON.stringify(n));
  };
  const rows = BUILTIN.filter((a) => filter === 'all' || a.tags.includes(filter));
  return (
    <div className="p-4 space-y-3 overflow-y-auto">
      <div className="panel p-3 text-sm">
        <div className="font-display font-bold text-lg">Context Library — traceability</div>
        <div className="text-zinc-400 text-xs">Local Context/ assets. No team prototype media detected — archetypes are baselines until you link your robot evidence. Never claim vision-derived dims as exact without calibrated scale reference.</div>
        <div className="flex gap-2 mt-2 text-xs">
          {['all', 'field', 'rules', 'strategy', 'measurement', 'cad', 'mechanism'].map((t) => (
            <button key={t} onClick={() => setFilter(t)} className={`px-2 py-1 rounded border ${filter === t ? 'border-dragon-500 bg-dragon-500/10' : 'border-white/10'}`}>{t}</button>
          ))}
        </div>
      </div>
      {rows.map((a) => (
        <div key={a.name} className="panel p-3 text-sm grid md:grid-cols-3 gap-3">
          <div>
            <div className="font-mono font-bold">{a.name}</div>
            <div className="text-xs text-zinc-400">{a.kind} · {a.sizeMB} MB</div>
            <div className="flex gap-1 mt-1 flex-wrap">{a.tags.map((t) => <span key={t} className="text-[11px] border border-white/15 rounded px-1">{t}</span>)}</div>
          </div>
          <div className="text-xs text-zinc-300">{a.note}<div className="mt-1 text-zinc-500">Preview: PDFs/video/STEP open from your local Context/ folder (kept out of git). Thumbnails generated on file select in a full build.</div></div>
          <label className="text-xs">Annotation / measurement link
            <textarea className="w-full h-16 mt-1" placeholder="e.g. HUB opening 41.7in p23 → hubBlue.openingHexIn; confidence: confirmed" value={ann[a.name] ?? ''} onChange={(e) => save(a.name, e.target.value)} />
          </label>
        </div>
      ))}
      <ReviewScreen />
    </div>
  );
}

function ReviewScreen() {
  const s = useApp();
  const r = s.robot();
  return (
    <div className="panel p-3 text-sm">
      <div className="font-display font-bold">Review: confirm / edit / reject prototype assumptions</div>
      <div className="text-xs text-zinc-400">Single-team mode: only the team placeholder exists. Every override below is user-entered until linked to a frame/image/diagram above.</div>
      <table className="data mt-2">
        <thead><tr><th>Parameter</th><th>Value</th><th>Source</th><th>Confidence</th></tr></thead>
        <tbody>
          {[['vmaxInPerSec', r.vmaxInPerSec], ['storage', r.storage], ['accuracy.' + s.zone, r.accuracy?.[s.zone]], ['climb.pSuccess', r.climb?.pSuccess]].map(([k, v]) => (
            <tr key={k as string}><td>{k}</td><td>{String(v)}</td><td>{(r as any).source ?? 'dragonsim-baseline'}</td><td>{(r as any).confidence ?? 'baseline-estimate'}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
