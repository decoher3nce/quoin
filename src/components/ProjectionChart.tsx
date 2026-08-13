import type { YearRow } from '../core/types';
import { formatMetric } from '../core/units';

// Dependency-free SVG chart: equity (area) and cumulative cash flow (line) over
// the hold. Kept intentionally simple — a legible glance, not an analytics suite.
export function ProjectionChart({ rows }: { rows: YearRow[] }) {
  if (rows.length < 2) return null;

  const W = 640;
  const H = 200;
  const padX = 40;
  const padY = 20;

  const years = rows.map((r) => r.year);
  const equity = rows.map((r) => r.equity);
  const cumCf = rows.map((r) => r.cumulativeCashFlow);

  const allVals = [...equity, ...cumCf, 0];
  const minV = Math.min(...allVals);
  const maxV = Math.max(...allVals);
  const span = maxV - minV || 1;

  const x = (i: number) => padX + (i / (rows.length - 1)) * (W - 2 * padX);
  const y = (v: number) => H - padY - ((v - minV) / span) * (H - 2 * padY);

  const equityArea =
    `M ${x(0)} ${y(0)} ` +
    equity.map((v, i) => `L ${x(i)} ${y(v)}`).join(' ') +
    ` L ${x(rows.length - 1)} ${y(0)} Z`;
  const cfLine = cumCf.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(v)}`).join(' ');
  const zeroY = y(0);

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[420px]" role="img" aria-label="Projection chart">
        {/* zero line */}
        <line x1={padX} y1={zeroY} x2={W - padX} y2={zeroY} stroke="#cfc8bb" strokeWidth="1" strokeDasharray="3 3" />
        <text x={4} y={zeroY + 3} className="fill-stone-400" fontSize="9">
          $0
        </text>
        {/* equity area */}
        <path d={equityArea} fill="#3f5c78" fillOpacity="0.12" stroke="#3f5c78" strokeWidth="1.5" />
        {/* cumulative cash flow line */}
        <path d={cfLine} fill="none" stroke="#b45309" strokeWidth="2" />
        {cumCf.map((v, i) => (
          <circle key={i} cx={x(i)} cy={y(v)} r="2.5" fill="#b45309" />
        ))}
        {/* year labels */}
        {years.map((yr, i) => (
          <text key={yr} x={x(i)} y={H - 4} textAnchor="middle" className="fill-stone-400" fontSize="9">
            {yr}
          </text>
        ))}
        {/* max equity marker */}
        <text x={W - padX} y={y(Math.max(...equity)) - 4} textAnchor="end" className="fill-accent-600" fontSize="9">
          {formatMetric(Math.max(...equity), '$')}
        </text>
      </svg>
      <div className="mt-1 flex gap-4 text-[11px] text-stone-500">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-3 rounded-sm bg-accent-500/30 ring-1 ring-accent-500" /> Equity
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-3 bg-amber-700" /> Cumulative cash flow
        </span>
      </div>
    </div>
  );
}
