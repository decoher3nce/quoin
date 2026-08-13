import type { YearRow } from '../core/types';
import { formatMetric } from '../core/units';

const COLUMNS: { key: keyof YearRow; label: string }[] = [
  { key: 'year', label: 'Yr' },
  { key: 'effectiveRevenue', label: 'Eff. revenue' },
  { key: 'operatingExpenses', label: 'Op. expenses' },
  { key: 'noi', label: 'NOI' },
  { key: 'debtService', label: 'Debt service' },
  { key: 'cashFlow', label: 'Cash flow' },
  { key: 'cumulativeCashFlow', label: 'Cumulative' },
  { key: 'propertyValue', label: 'Value' },
  { key: 'loanBalance', label: 'Loan' },
  { key: 'equity', label: 'Equity' },
];

export function ProjectionTable({ rows }: { rows: YearRow[] }) {
  if (!rows.length) return null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-right text-sm">
        <thead>
          <tr className="border-b border-stone-200 text-[11px] uppercase tracking-wide text-stone-400">
            {COLUMNS.map((c) => (
              <th
                key={c.key}
                className={`px-2 py-1.5 font-medium ${c.key === 'year' ? 'text-left' : ''}`}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="tnum">
          {rows.map((r) => (
            <tr key={r.year} className="border-b border-stone-50 hover:bg-stone-50">
              {COLUMNS.map((c) => {
                const val = r[c.key];
                if (c.key === 'year') {
                  return (
                    <td key={c.key} className="px-2 py-1.5 text-left font-medium text-stone-500">
                      {val}
                    </td>
                  );
                }
                const negative = val < 0;
                return (
                  <td
                    key={c.key}
                    className={`px-2 py-1.5 ${negative ? 'text-red-600' : 'text-stone-700'}`}
                  >
                    {formatMetric(val, '$')}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
