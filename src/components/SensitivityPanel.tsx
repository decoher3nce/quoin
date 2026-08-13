import { useMemo, useState } from 'react';
import type { InvestmentModule, ParamSpec, MetricSpec } from '../core/types';
import { CORE_METRICS } from '../core/metrics';
import { formatMetric, formatParam } from '../core/units';
import { tornado, grid, sensitiveParams } from '../core/sensitivity';
import { Card, HelpBadge } from './ui';

// Metrics offered for sensitivity: the comparable, higher-is-better core set.
const OFFERED = ['irr5yr', 'cashOnCash', 'capRate', 'dscr', 'annualCashFlow', 'monthlyCashFlow'];
const RANGES = [0.05, 0.1, 0.2];
const MAX_BARS = 8;

function Select({
  value,
  onChange,
  children,
  className = '',
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`rounded-md border border-stone-300 bg-white px-2 py-1 text-sm text-stone-700 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500 ${className}`}
    >
      {children}
    </select>
  );
}

function Tornado({
  bars,
  base,
  spec,
  paramByKey,
}: {
  bars: ReturnType<typeof tornado>['bars'];
  base: number;
  spec: MetricSpec;
  paramByKey: Map<string, ParamSpec>;
}) {
  const shown = bars.filter((b) => Number.isFinite(b.swing)).slice(0, MAX_BARS);
  if (shown.length === 0) return <p className="text-sm text-stone-400">No measurable sensitivity.</p>;

  const vals = shown.flatMap((b) => [b.low, b.high]).concat(base);
  let min = Math.min(...vals);
  let max = Math.max(...vals);
  const pad = (max - min || Math.abs(base) || 1) * 0.08;
  min -= pad;
  max += pad;

  const W = 680;
  const rowH = 28;
  const labelW = 168;
  const rightW = 8;
  const chartW = W - labelW - rightW;
  const H = shown.length * rowH + 24;
  const x = (v: number) => labelW + ((v - min) / (max - min || 1)) * chartW;
  const xBase = x(base);

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[560px]" role="img" aria-label="Tornado chart">
        {/* base reference line */}
        <line x1={xBase} y1={4} x2={xBase} y2={H - 16} stroke="#3f5c78" strokeWidth="1" strokeDasharray="3 3" />
        <text x={xBase} y={H - 4} textAnchor="middle" fontSize="9" className="fill-accent-600">
          base {formatMetric(base, spec.unit)}
        </text>
        {shown.map((b, i) => {
          const y = i * rowH + 8;
          const barMin = Math.min(b.low, b.high);
          const barMax = Math.max(b.low, b.high);
          const p = paramByKey.get(b.key);
          const tip = p
            ? `${b.label}: ${formatParam(b.lowInput, p.type, p.unit)} → ${formatParam(b.highInput, p.type, p.unit)}  ⇒  ${formatMetric(b.low, spec.unit)} … ${formatMetric(b.high, spec.unit)}`
            : b.label;
          return (
            <g key={b.key}>
              <title>{tip}</title>
              <text x={labelW - 8} y={y + 13} textAnchor="end" fontSize="11" className="fill-stone-600">
                {b.label.length > 26 ? b.label.slice(0, 25) + '…' : b.label}
              </text>
              {/* downside (worse than base) */}
              {barMin < base && (
                <rect x={x(barMin)} y={y + 3} width={Math.max(x(Math.min(base, barMax)) - x(barMin), 0)} height={rowH - 10} fill="#d97706" fillOpacity="0.55" rx="2" />
              )}
              {/* upside (better than base) */}
              {barMax > base && (
                <rect x={x(Math.max(base, barMin))} y={y + 3} width={Math.max(x(barMax) - x(Math.max(base, barMin)), 0)} height={rowH - 10} fill="#10b981" fillOpacity="0.6" rx="2" />
              )}
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex gap-4 text-[11px] text-stone-500">
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-3 rounded-sm bg-amber-500/60" /> lower output</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-3 rounded-sm bg-emerald-500/60" /> higher output</span>
        <span className="text-stone-400">bars span the output as each input moves ±the selected range</span>
      </div>
    </div>
  );
}

function cellColor(v: number, base: number, min: number, max: number, higherIsBetter: boolean | null): string {
  if (!Number.isFinite(v)) return 'transparent';
  const maxDev = Math.max(max - base, base - min, 1e-9);
  let t = (v - base) / maxDev;
  if (higherIsBetter === false) t = -t;
  t = Math.max(-1, Math.min(1, t));
  return t >= 0
    ? `rgba(16,185,129,${(0.1 + 0.5 * t).toFixed(3)})`
    : `rgba(217,119,6,${(0.1 + 0.5 * -t).toFixed(3)})`;
}

function Heatmap({
  g,
  spec,
  xSpec,
  ySpec,
}: {
  g: ReturnType<typeof grid>;
  spec: MetricSpec;
  xSpec: ParamSpec;
  ySpec: ParamSpec;
}) {
  const rows = g.ys.map((_, i) => i).reverse(); // highest y on top
  const mid = (g.xs.length - 1) / 2;
  return (
    <div className="overflow-x-auto">
      <table className="border-separate text-right text-xs tnum" style={{ borderSpacing: 2 }}>
        <thead>
          <tr>
            <th className="px-1 py-1 text-left text-[10px] font-medium uppercase tracking-wide text-stone-400">
              {ySpec.label} \ {xSpec.label}
            </th>
            {g.xs.map((xv, xi) => (
              <th key={xi} className={`px-2 py-1 font-medium ${xi === mid ? 'text-accent-600' : 'text-stone-500'}`}>
                {formatParam(xv, xSpec.type, xSpec.unit)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((yi) => (
            <tr key={yi}>
              <td className={`px-2 py-1 text-left font-medium ${yi === mid ? 'text-accent-600' : 'text-stone-500'}`}>
                {formatParam(g.ys[yi]!, ySpec.type, ySpec.unit)}
              </td>
              {g.cells[yi]!.map((v, xi) => {
                const isBase = yi === mid && xi === mid;
                return (
                  <td
                    key={xi}
                    className={`px-2 py-1 text-stone-700 ${isBase ? 'ring-2 ring-accent-500' : ''}`}
                    style={{ backgroundColor: cellColor(v, g.base, g.min, g.max, spec.higherIsBetter) }}
                    title={`${xSpec.label} ${formatParam(g.xs[xi]!, xSpec.type, xSpec.unit)}, ${ySpec.label} ${formatParam(g.ys[yi]!, ySpec.type, ySpec.unit)}`}
                  >
                    {Number.isFinite(v) ? formatMetric(v, spec.unit) : '—'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1 text-[11px] text-stone-400">
        Green = better than the base case ({formatMetric(g.base, spec.unit)}), amber = worse. The ringed
        centre cell is the current deal.
      </p>
    </div>
  );
}

export function SensitivityPanel({
  module,
  inputs,
}: {
  module: InvestmentModule;
  inputs: Record<string, number>;
}) {
  const baseMetrics = useMemo(() => module.compute(inputs).metrics, [module, inputs]);
  const metricOptions = OFFERED.filter((k) => Number.isFinite(baseMetrics[k]));
  const [metricKey, setMetricKey] = useState<string>(metricOptions[0] ?? 'irr5yr');
  const [pct, setPct] = useState<number>(0.1);
  const [xOverride, setXOverride] = useState<string | null>(null);
  const [yOverride, setYOverride] = useState<string | null>(null);

  const activeMetric = metricOptions.includes(metricKey) ? metricKey : (metricOptions[0] ?? 'irr5yr');
  const spec = CORE_METRICS.find((m) => m.key === activeMetric)!;

  const paramByKey = useMemo(() => new Map(module.params.map((p) => [p.key, p])), [module]);
  const params = useMemo(() => sensitiveParams(module, inputs), [module, inputs]);

  const t = useMemo(
    () => tornado(module, inputs, activeMetric, pct),
    [module, inputs, activeMetric, pct],
  );

  const xKey = xOverride ?? t.bars[0]?.key ?? params[0]?.key ?? '';
  const yKey =
    yOverride ?? t.bars.find((b) => b.key !== xKey)?.key ?? params.find((p) => p.key !== xKey)?.key ?? '';

  const g = useMemo(
    () => (xKey && yKey ? grid(module, inputs, xKey, yKey, activeMetric, 5, pct) : null),
    [module, inputs, xKey, yKey, activeMetric, pct],
  );

  if (metricOptions.length === 0 || !Number.isFinite(t.base)) {
    return (
      <Card title="Sensitivity">
        <p className="text-sm text-stone-500">
          No finite core metric to analyze for this module — sensitivity needs a base value to vary
          around.
        </p>
      </Card>
    );
  }

  return (
    <Card
      title="Sensitivity"
      right={
        <div className="flex items-center gap-2">
          <Select value={activeMetric} onChange={setMetricKey}>
            {metricOptions.map((k) => (
              <option key={k} value={k}>
                {CORE_METRICS.find((m) => m.key === k)!.label}
              </option>
            ))}
          </Select>
          <Select value={String(pct)} onChange={(v) => setPct(Number(v))}>
            {RANGES.map((r) => (
              <option key={r} value={r}>
                ±{Math.round(r * 100)}%
              </option>
            ))}
          </Select>
        </div>
      }
    >
      <div className="space-y-5">
        <div>
          <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-stone-400">
            What moves {spec.label.toLowerCase()}?
            <HelpBadge text={`Each input is varied ±${Math.round(pct * 100)}% around its current value; bars are ranked by how far ${spec.label} swings. This is the fastest read on which assumptions matter.`} />
          </h4>
          <Tornado bars={t.bars} base={t.base} spec={spec} paramByKey={paramByKey} />
        </div>

        {g && (
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                Two-way grid
              </h4>
              <span className="text-xs text-stone-400">rows</span>
              <Select value={yKey} onChange={(v) => setYOverride(v)}>
                {params.filter((p) => p.key !== xKey).map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </Select>
              <span className="text-xs text-stone-400">×  cols</span>
              <Select value={xKey} onChange={(v) => setXOverride(v)}>
                {params.filter((p) => p.key !== yKey).map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </div>
            <Heatmap g={g} spec={spec} xSpec={paramByKey.get(xKey)!} ySpec={paramByKey.get(yKey)!} />
          </div>
        )}
      </div>
    </Card>
  );
}
