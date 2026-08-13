import { useEffect, useMemo, useState } from 'react';
import type { InvestmentModule, MetricSpec } from '../core/types';
import { MODULES } from '../modules';
import { orderedSpecs } from '../core/metrics';
import { formatMetric } from '../core/units';
import { readPersistedInputs } from '../state/useModuleState';
import { exportComparisonXlsx, type ComparisonEntry } from '../export/xlsx';
import { exportPdf } from '../export/pdf';
import { computeAfterTax, afterTaxOverrides, AFTER_TAX_CORE_KEYS, type AfterTaxResult } from '../core/tax';
import type { StoredTax } from '../state/useTaxSettings';
import { buildCompareShareUrl } from '../state/scenario';
import { COMPARE_KEY } from '../state/keys';
import { ShareButton } from './ShareButton';
import { Card, HelpBadge, Toggle } from './ui';
import type { InvestmentCategory } from '../core/types';

const MAX = 4;
const MIN = 2;
const AT_KEYS = new Set<string>(AFTER_TAX_CORE_KEYS);
const CATEGORY_ORDER: InvestmentCategory[] = [
  'Land',
  'Residential',
  'Commercial',
  'Hospitality',
  'Paper',
  'ValueAdd',
  'Infrastructure',
  'Novel',
];

function loadSelected(): string[] {
  try {
    const raw = localStorage.getItem(COMPARE_KEY);
    if (raw) {
      const ids = (JSON.parse(raw) as string[]).filter((id) => MODULES.some((m) => m.id === id));
      if (ids.length >= MIN) return ids.slice(0, MAX);
    }
  } catch {
    /* ignore */
  }
  return MODULES.slice(0, 2).map((m) => m.id);
}

interface RichEntry {
  module: InvestmentModule;
  inputs: Record<string, number>;
  result: ComparisonEntry['result'];
  afterTax: AfterTaxResult | null;
}

export function ComparisonView({
  tax,
  setTaxEnabled,
}: {
  tax: StoredTax;
  setTaxEnabled: (b: boolean) => void;
}) {
  const [selected, setSelected] = useState<string[]>(() => loadSelected());

  useEffect(() => {
    try {
      localStorage.setItem(COMPARE_KEY, JSON.stringify(selected));
    } catch {
      /* ignore */
    }
  }, [selected]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= MIN) return prev;
        return prev.filter((x) => x !== id);
      }
      if (prev.length >= MAX) return prev;
      return [...prev, id];
    });
  };

  const entries: RichEntry[] = useMemo(
    () =>
      selected
        .map((id) => MODULES.find((m) => m.id === id))
        .filter((m): m is InvestmentModule => !!m)
        .map((module) => {
          const inputs = readPersistedInputs(module);
          const result = module.compute(inputs);
          const afterTax =
            tax.enabled && module.taxProfile ? computeAfterTax(module, inputs, result, tax) : null;
          return { module, inputs, result, afterTax };
        }),
    [selected, tax],
  );

  // Union of specs: core first, then shared extras, de-duplicated by key.
  const specs = useMemo(() => {
    const seen = new Set<string>();
    const out: MetricSpec[] = [];
    for (const e of entries) {
      for (const s of orderedSpecs(e.module)) {
        if (!seen.has(s.key)) {
          seen.add(s.key);
          out.push(s);
        }
      }
    }
    return out;
  }, [entries]);

  // Effective value for a metric in a column — after-tax where the toggle is on
  // and the module supports it, otherwise the pre-tax value.
  const effVal = (specKey: string, ci: number): number => {
    const e = entries[ci]!;
    if (tax.enabled && AT_KEYS.has(specKey) && e.afterTax) {
      return afterTaxOverrides(e.afterTax)[specKey] ?? NaN;
    }
    return e.result.metrics[specKey] ?? NaN;
  };

  const bestCol = (spec: MetricSpec): number => {
    if (spec.higherIsBetter !== true) return -1;
    let best = -1;
    let bestVal = -Infinity;
    entries.forEach((_, ci) => {
      const v = effVal(spec.key, ci);
      if (Number.isFinite(v) && v > bestVal) {
        bestVal = v;
        best = ci;
      }
    });
    return best;
  };

  // A cell shows a pre-tax fallback when the after-tax toggle is on, the row is a
  // tax-affected metric, but this module isn't a depreciable hold.
  const isPreTaxFallback = (specKey: string, ci: number) =>
    tax.enabled && AT_KEYS.has(specKey) && !entries[ci]!.afterTax;
  const anyFallback = tax.enabled && specs.some((s) => AT_KEYS.has(s.key)) && entries.some((e) => !e.afterTax);

  // Export entries carry the on-screen (possibly after-tax) values.
  const exportEntries: ComparisonEntry[] = entries.map((e) => ({
    module: e.module,
    result:
      tax.enabled && e.afterTax
        ? { ...e.result, metrics: { ...e.result.metrics, ...afterTaxOverrides(e.afterTax) } }
        : e.result,
  }));
  const atKeysArg = tax.enabled ? AFTER_TAX_CORE_KEYS : undefined;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-stone-800">Comparison</h2>
          <p className="text-sm text-stone-500">
            Select {MIN}–{MAX} modules. Values use each module's last-tuned inputs. Best per row is
            highlighted for higher-is-better metrics.
          </p>
        </div>
        <div className="no-print flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-stone-600">
            <span>After-tax</span>
            <Toggle checked={tax.enabled} onChange={setTaxEnabled} label="Toggle after-tax comparison" />
          </div>
          <ShareButton getUrl={() => buildCompareShareUrl(entries.map((e) => ({ module: e.module, inputs: e.inputs })))} />
          <button
            onClick={() => exportComparisonXlsx(exportEntries, atKeysArg)}
            className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-50"
          >
            Export .xlsx
          </button>
          <button
            onClick={() => exportPdf({ kind: 'comparison', entries: exportEntries, afterTaxKeys: atKeysArg })}
            className="rounded-md bg-accent-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-600"
          >
            Export .pdf
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {entries.map((e) => (
          <span
            key={e.module.id}
            className="inline-flex items-center gap-1.5 rounded-full border border-accent-500 bg-accent-500 py-1 pl-3 pr-2 text-sm text-white"
          >
            {e.module.name}
            <button
              onClick={() => toggle(e.module.id)}
              disabled={selected.length <= MIN}
              aria-label={`Remove ${e.module.name}`}
              title={selected.length <= MIN ? `Keep at least ${MIN}` : `Remove ${e.module.name}`}
              className="text-base leading-none text-white/70 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              ×
            </button>
          </span>
        ))}
        {selected.length < MAX && (
          <select
            value=""
            onChange={(ev) => ev.target.value && toggle(ev.target.value)}
            className="cursor-pointer rounded-full border border-dashed border-stone-300 bg-white px-3 py-1 text-sm text-stone-500 hover:bg-stone-50 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
          >
            <option value="">＋ Add module…</option>
            {CATEGORY_ORDER.map((cat) => {
              const opts = MODULES.filter((m) => m.category === cat && !selected.includes(m.id));
              if (opts.length === 0) return null;
              return (
                <optgroup key={cat} label={cat}>
                  {opts.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        )}
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-left">
                <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-stone-400">
                  Metric
                </th>
                {entries.map((e) => (
                  <th key={e.module.id} className="px-3 py-2 text-right text-xs font-semibold text-stone-700">
                    {e.module.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="tnum">
              {specs.map((spec) => {
                const best = bestCol(spec);
                const affected = tax.enabled && AT_KEYS.has(spec.key);
                return (
                  <tr key={spec.key} className="border-b border-stone-50">
                    <td className="px-3 py-2 text-stone-500">
                      {spec.label}
                      {affected && <span className="ml-1 text-[10px] font-medium text-accent-600">· after-tax</span>}
                      <HelpBadge text={spec.help} />
                      {spec.higherIsBetter === null && (
                        <span className="ml-1 text-[10px] text-stone-300">(neutral)</span>
                      )}
                    </td>
                    {entries.map((e, ci) => {
                      const v = effVal(spec.key, ci);
                      const isBest = best === ci;
                      const fallback = isPreTaxFallback(spec.key, ci);
                      return (
                        <td
                          key={e.module.id}
                          className={`px-3 py-2 text-right ${
                            isBest ? 'rounded bg-emerald-50 font-semibold text-emerald-700' : 'text-stone-700'
                          }`}
                        >
                          {!Number.isFinite(v) ? '—' : formatMetric(v, spec.unit)}
                          {fallback && Number.isFinite(v) && (
                            <span className="text-stone-300" title="Pre-tax — after-tax modeling doesn't apply to this asset type.">
                              *
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {anyFallback && (
          <p className="mt-2 text-[11px] text-stone-400">
            * pre-tax — after-tax modeling doesn&apos;t apply to this asset type (flips, land, notes /
            REITs / LP, personal-use).
          </p>
        )}
      </Card>
    </div>
  );
}
