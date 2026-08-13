import { describeSignal } from '../core/data';

// Displays the future geo/time-series signals a module WANTS. v1 shows intent
// only — the DataSource is stubbed and never fetches.
export function DataHooks({ hooks }: { hooks?: string[] }) {
  if (!hooks || hooks.length === 0) return null;
  return (
    <div className="rounded-lg border border-dashed border-stone-300 bg-stone-50 p-3">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="inline-flex items-center rounded bg-stone-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-stone-500">
          Future data layer
        </span>
        <span className="text-xs text-stone-400">not wired in v1</span>
      </div>
      <ul className="space-y-1 text-sm text-stone-600">
        {hooks.map((h) => (
          <li key={h} className="flex gap-2">
            <span aria-hidden className="text-stone-400">
              ↗
            </span>
            <span>
              <code className="rounded bg-stone-200 px-1 text-[12px] text-stone-600">{h}</code>{' '}
              <span className="text-stone-500">— {describeSignal(h)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
