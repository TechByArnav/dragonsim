import React from 'react';

// Catches render crashes (e.g. a dead GPU/WebGL context) so the tab shows
// a readable message instead of going black. Panels outside the boundary
// keep working.
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; title?: string },
  { failed: boolean; message: string }
> {
  state = { failed: false, message: '' };

  static getDerivedStateFromError(err: unknown) {
    return { failed: true, message: err instanceof Error ? err.message : String(err) };
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="h-full flex items-center justify-center bg-black p-6">
          <div className="codewin p-4 max-w-md text-sm">
            <div className="font-display font-bold text-[#ddffdc]">{this.props.title ?? 'Something broke here'}</div>
            <div className="mt-1 text-[#8cab87]">
              The rest of the app still works. Try Settings → Quality → Low, close
              other tabs, and reload. If it persists, copy this:
            </div>
            <div className="mt-2 font-mono text-[11px] text-[#fb923c] break-words">{this.state.message}</div>
            <button className="btn-ghost mt-3 !py-1 text-xs" onClick={() => window.location.reload()}>
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
