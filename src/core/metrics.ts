import type { MetricSpec, InvestmentModule } from './types';

// The core metric contract. Every module's compute().metrics MUST include every
// key here so the comparison view can line modules up on the same footing.
export const CORE_METRICS: MetricSpec[] = [
  {
    key: 'annualCashFlow',
    label: 'Annual cash flow',
    unit: '$/yr',
    higherIsBetter: true,
    help: 'Pre-tax cash left after operating expenses and debt service in year 1.',
  },
  {
    key: 'monthlyCashFlow',
    label: 'Monthly cash flow',
    unit: '$/mo',
    higherIsBetter: true,
    help: 'Year-1 annual cash flow divided by 12.',
  },
  {
    key: 'cashOnCash',
    label: 'Cash-on-cash',
    unit: '%',
    higherIsBetter: true,
    help: 'Year-1 cash flow divided by total cash invested.',
  },
  {
    key: 'capRate',
    label: 'Cap rate',
    unit: '%',
    higherIsBetter: true,
    help: 'Net operating income divided by price. Debt-independent yield on the asset.',
  },
  {
    key: 'dscr',
    label: 'DSCR',
    unit: 'x',
    higherIsBetter: true,
    help: 'NOI divided by annual debt service. Lenders typically want ≥ 1.20–1.25.',
  },
  {
    key: 'irr5yr',
    label: '5-yr IRR',
    unit: '%',
    higherIsBetter: true,
    help: 'Internal rate of return over a 5-year hold incl. a modeled sale. Assumption-driven.',
  },
  {
    key: 'totalCashInvested',
    label: 'Total cash invested',
    unit: '$',
    higherIsBetter: null,
    help: 'Equity out of pocket: down payment, closing, rehab, furnishing, reserves. Lower is not strictly better.',
  },
];

export const CORE_METRIC_KEYS: readonly string[] = CORE_METRICS.map((m) => m.key);

/** Keys every module must provide. Used by a dev-time contract test. */
export function assertCoreMetrics(metrics: Record<string, number>): string[] {
  return CORE_METRIC_KEYS.filter((k) => !(k in metrics));
}

/** Ordered metric specs for display: the core set first, then module extras. */
export function orderedSpecs(module: InvestmentModule): MetricSpec[] {
  return [...CORE_METRICS, ...module.metrics];
}
