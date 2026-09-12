import { openDB } from 'idb';
const DB = 'dragonsim-v1';
export async function db() {
  return openDB(DB, 1, {
    upgrade(d) {
      d.createObjectStore('scenarios', { keyPath: 'id' });
      d.createObjectStore('results', { keyPath: 'id' });
      d.createObjectStore('annotations', { keyPath: 'id' });
    },
  });
}
export async function saveScenario(s: any) { const d = await db(); await d.put('scenarios', s); }
export async function listScenarios(): Promise<any[]> { const d = await db(); return d.getAll('scenarios'); }
export async function loadScenario(id: string) { const d = await db(); return d.get('scenarios', id); }
export function exportJSON(name: string, obj: unknown) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
export function exportCSV(name: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const cols = Object.keys(rows[0]);
  const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => JSON.stringify(r[c] ?? '')).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
