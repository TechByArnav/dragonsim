// Minimal markdown → JSX renderer (headings, lists, tables, code, links).
// No dependencies; covers the docs/ files only.
import React from 'react';

function inline(text: string, keyPrefix: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith('**')) {
      parts.push(<strong key={`${keyPrefix}-${k++}`} className="text-[#ddffdc]">{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith('`')) {
      parts.push(<code key={`${keyPrefix}-${k++}`} className="font-mono text-[#7fee64] bg-black/50 px-1 rounded">{tok.slice(1, -1)}</code>);
    } else {
      const mt = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(tok);
      if (mt) {
        parts.push(<a key={`${keyPrefix}-${k++}`} href={mt[2]} className="text-[#859984] underline">{mt[1]}</a>);
      } else {
        parts.push(tok);
      }
    }
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export function Markdown({ text }: { text: string }) {
  const lines = text.split('\n');
  const out: React.ReactNode[] = [];
  let i = 0;
  let k = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^```/.test(line)) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i++; }
      i++;
      out.push(
        <div key={k++} className="codewin my-2 overflow-x-auto">
          <pre className="p-3 font-mono text-[13px] text-[#ddffdc]">{buf.join('\n')}</pre>
        </div>
      );
      continue;
    }
    if (/^\s*$/.test(line)) { i++; continue; }
    if (/^---+$/.test(line.trim())) { out.push(<hr key={k++} className="border-[#1f2a33] my-4" />); i++; continue; }
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      const lvl = h[1].length;
      const cls = lvl === 1 ? 'font-display text-3xl mt-2' : lvl === 2 ? 'font-display text-2xl mt-5' : 'font-display text-xl mt-4';
      out.push(<div key={k++} className={cls}>{inline(h[2], `h${k}`)}</div>);
      i++;
      continue;
    }
    if (/^\|.+\|$/.test(line.trim()) && i + 1 < lines.length && /^\|?[\s:|-]+\|?$/.test(lines[i + 1].trim())) {
      const head = line.trim().split('|').map((c) => c.trim()).filter(Boolean);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && /^\|.+\|$/.test(lines[i].trim())) {
        rows.push(lines[i].trim().split('|').map((c) => c.trim()).filter(Boolean));
        i++;
      }
      out.push(
        <table key={k++} className="data my-2">
          <thead><tr>{head.map((c, j) => <th key={j}>{c}</th>)}</tr></thead>
          <tbody>{rows.map((r, ri) => <tr key={ri}>{r.map((c, j) => <td key={j}>{inline(c, `t${k}-${ri}-${j}`)}</td>)}</tr>)}</tbody>
        </table>
      );
      continue;
    }
    if (/^\s*([-*])\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*])\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*([-*])\s+/, ''));
        i++;
      }
      out.push(<ul key={k++} className="list-disc ml-5 my-1 space-y-0.5">{items.map((t, j) => <li key={j}>{inline(t, `u${k}-${j}`)}</li>)}</ul>);
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
        i++;
      }
      out.push(<ol key={k++} className="list-decimal ml-5 my-1 space-y-0.5">{items.map((t, j) => <li key={j}>{inline(t, `o${k}-${j}`)}</li>)}</ol>);
      continue;
    }
    out.push(<p key={k++} className="my-1.5 leading-relaxed">{inline(line, `p${k}`)}</p>);
  }
  return <div className="text-[15px]">{out}</div>;
}
