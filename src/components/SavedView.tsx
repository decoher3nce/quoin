import { useMemo, useState } from 'react';
import { getModule } from '../modules';
import { CORE_METRICS } from '../core/metrics';
import { formatMetric } from '../core/units';
import type { SavedScenario } from '../core/scenarios';
import { Card } from './ui';

// Columns of key metrics shown per saved deal, recomputed live from its inputs.
const COLS = ['monthlyCashFlow', 'cashOnCash', 'irr5yr', 'totalCashInvested'] as const;

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

export function SavedView({
  scenarios,
  onLoad,
  onRename,
  onRemove,
}: {
  scenarios: SavedScenario[];
  onLoad: (s: SavedScenario) => void;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const specByKey = useMemo(() => new Map(CORE_METRICS.map((m) => [m.key, m])), []);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-stone-800">Saved scenarios</h2>
        <p className="text-sm text-stone-500">
          Your library of tuned deals. Metrics are recomputed live from each saved scenario's inputs.
        </p>
      </div>

      {scenarios.length === 0 ? (
        <Card>
          <p className="text-sm text-stone-500">
            No saved scenarios yet. Open a module, tune its inputs, and click <strong>Save</strong> to
            add it here.
          </p>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-left text-[11px] uppercase tracking-wide text-stone-400">
                  <th className="px-3 py-2 font-semibold">Name</th>
                  <th className="px-3 py-2 font-semibold">Type</th>
                  {COLS.map((k) => (
                    <th key={k} className="px-3 py-2 text-right font-semibold">
                      {specByKey.get(k)?.label ?? k}
                    </th>
                  ))}
                  <th className="px-3 py-2 font-semibold">Saved</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="tnum">
                {scenarios.map((s) => {
                  const module = getModule(s.moduleId);
                  const metrics = module ? module.compute(s.inputs).metrics : {};
                  return (
                    <tr key={s.id} className="border-b border-stone-50 hover:bg-stone-50/60">
                      <td className="px-3 py-2 font-medium text-stone-700">
                        {editing === s.id ? (
                          <input
                            autoFocus
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onBlur={() => {
                              onRename(s.id, draft);
                              setEditing(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                onRename(s.id, draft);
                                setEditing(null);
                              }
                              if (e.key === 'Escape') setEditing(null);
                            }}
                            className="w-40 rounded border border-stone-300 bg-white px-1.5 py-0.5 text-sm focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
                          />
                        ) : (
                          <button className="text-left hover:text-accent-700" onClick={() => onLoad(s)} title="Load this scenario">
                            {s.name}
                          </button>
                        )}
                        {s.tax?.enabled && (
                          <span className="ml-1.5 rounded bg-emerald-50 px-1 text-[10px] font-medium text-emerald-600">
                            after-tax
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-stone-500">{module?.name ?? s.moduleId}</td>
                      {COLS.map((k) => {
                        const spec = specByKey.get(k)!;
                        const v = metrics[k];
                        const neg = spec.higherIsBetter === true && Number.isFinite(v) && (v as number) < 0;
                        return (
                          <td key={k} className={`px-3 py-2 text-right ${neg ? 'text-red-600' : 'text-stone-700'}`}>
                            {v == null || !Number.isFinite(v) ? '—' : formatMetric(v, spec.unit)}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2 text-xs text-stone-400">{fmtDate(s.savedAt)}</td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-1.5 text-xs">
                          <button onClick={() => onLoad(s)} className="rounded border border-stone-300 px-2 py-0.5 text-stone-600 hover:bg-stone-50">
                            Load
                          </button>
                          <button
                            onClick={() => { setEditing(s.id); setDraft(s.name); }}
                            className="rounded border border-stone-300 px-2 py-0.5 text-stone-600 hover:bg-stone-50"
                          >
                            Rename
                          </button>
                          <button onClick={() => onRemove(s.id)} className="rounded border border-stone-300 px-2 py-0.5 text-stone-500 hover:bg-red-50 hover:text-red-600">
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
