import { usePersistentDismiss } from '../state/useModuleState';

const LIMITS = [
  'Metrics are pre-tax by default. A real buy-and-hold can be after-tax positive while showing negative pre-tax cash flow, so depreciable buy-and-hold modules offer an optional after-tax toggle (depreciation + recapture + capital-gains at sale). It is a planning estimate with stated simplifications, not tax advice.',
  'IRR uses modeled cash flows plus a modeled sale at the end of the hold. Appreciation and rent/revenue growth are assumptions, not forecasts.',
  'Property management, maintenance, and vacancy are modeled as fractions of rent/revenue. Real costs are lumpy and occasional (a roof, a turnover, a special assessment).',
  'Inputs marked "verify" (rates, taxes, HOA, insurance, ADR/occupancy, STR legality) move results the most and are NOT authoritative here — confirm each against a primary source.',
];

export function AssumptionsPanel() {
  const { dismissed, dismiss, restore } = usePersistentDismiss('assumptions');

  if (dismissed) {
    return (
      <button
        onClick={restore}
        className="no-print text-xs text-stone-400 underline decoration-dotted underline-offset-2 hover:text-stone-600"
      >
        Show assumptions &amp; limits
      </button>
    );
  }

  return (
    <div className="no-print rounded-lg border border-amber-200 bg-amber-50/70 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-amber-900">Assumptions &amp; limits</h3>
          <ul className="mt-2 space-y-1.5 text-sm text-amber-800">
            {LIMITS.map((l, i) => (
              <li key={i} className="flex gap-2">
                <span aria-hidden className="mt-0.5 text-amber-500">
                  •
                </span>
                <span>{l}</span>
              </li>
            ))}
          </ul>
        </div>
        <button
          onClick={dismiss}
          className="shrink-0 rounded-md border border-amber-300 bg-white/70 px-2.5 py-1 text-xs text-amber-700 hover:bg-white"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
