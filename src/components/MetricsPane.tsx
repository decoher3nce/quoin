import type { InvestmentModule, ComputeResult, MetricSpec } from '../core/types';
import { CORE_METRICS } from '../core/metrics';
import { formatMetric } from '../core/units';
import { HelpBadge } from './ui';

function MetricTile({ spec, value }: { spec: MetricSpec; value: number | undefined }) {
  const v = value ?? NaN;
  const negative = spec.higherIsBetter === true && Number.isFinite(v) && v < 0;
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-3">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
          {spec.label}
          <HelpBadge text={spec.help} />
        </span>
      </div>
      <div
        className={`tnum mt-1 text-xl font-semibold tracking-tight ${
          negative ? 'text-red-600' : 'text-stone-800'
        }`}
      >
        {formatMetric(v, spec.unit)}
      </div>
    </div>
  );
}

export function MetricsPane({
  module,
  result,
}: {
  module: InvestmentModule;
  result: ComputeResult;
}) {
  const extras = module.metrics;
  return (
    <div className="space-y-4">
      {result.warnings && result.warnings.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <ul className="space-y-1 text-sm text-amber-800">
            {result.warnings.map((w, i) => (
              <li key={i} className="flex gap-2">
                <span aria-hidden className="mt-0.5 text-amber-500">
                  ▲
                </span>
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-stone-400">
          Core metrics
        </h4>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {CORE_METRICS.map((spec) => (
            <MetricTile key={spec.key} spec={spec} value={result.metrics[spec.key]} />
          ))}
        </div>
      </div>

      {extras.length > 0 && (
        <div>
          <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-stone-400">
            {module.name.split('—')[0]?.trim()} specifics
          </h4>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {extras.map((spec) => (
              <MetricTile key={spec.key} spec={spec} value={result.metrics[spec.key]} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
