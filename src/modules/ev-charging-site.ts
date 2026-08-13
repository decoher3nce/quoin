import type { InvestmentModule, ComputeResult } from '../core/types';
import { guardDiv, npv } from '../core/finance';
import { computeIncomeStream } from './_shapes';

// EV Charging Site (passive ground-lease version). Own a well-located site and
// lease it to a fast-charging operator on a per-stall basis, with income ramping
// as utilization grows in the early years. This is the passive host posture — you
// take site rent, not the volatile per-session revenue — but the sector is young,
// so the discount rate is high and the growth curve is uncertain. Unlevered: dscr NaN.

function compute(i: Record<string, number>): ComputeResult {
  const siteAcquisitionCost = i.siteAcquisitionCost ?? 0;
  const numberOfStalls = Math.max(i.numberOfStalls ?? 0, 0);
  const annualLeasePerStall = i.annualLeasePerStall ?? 0;
  const utilizationGrowthPct = i.utilizationGrowthPct ?? 0;
  const leaseTermYears = Math.round(i.leaseTermYears ?? 15);
  const appreciationPct = i.appreciationPct ?? 0;
  const discountRate = i.discountRate ?? 0;
  const holdYears = Math.round(i.holdYears ?? 5);
  const sellingCostPct = i.sellingCostPct ?? 0;

  const year1Income = numberOfStalls * annualLeasePerStall;
  const capital = siteAcquisitionCost;
  const assetPrice = siteAcquisitionCost;
  // Early ramp: utilization growth stands in for the income escalator.
  const escalationPct = utilizationGrowthPct;

  const annualCashflows = Array.from({ length: 5 }, (_, k) =>
    year1Income * Math.pow(1 + escalationPct, k),
  );
  const terminalValue =
    siteAcquisitionCost * Math.pow(1 + appreciationPct, holdYears) * (1 - sellingCostPct);

  const core = computeIncomeStream({
    capital,
    assetPrice,
    annualCashflows,
    terminalValue,
    debtServiceAnnual: 0,
    noiAnnual: year1Income,
  });

  const fullTermCashflows = Array.from({ length: leaseTermYears }, (_, k) =>
    year1Income * Math.pow(1 + escalationPct, k),
  );
  const npvOfLease = npv(discountRate, [-capital, ...fullTermCashflows, terminalValue]);

  const warnings: string[] = [
    'Utilization is the swing variable — early-ramp EV site income can undershoot the modeled growth curve materially.',
  ];

  return {
    metrics: {
      ...core,
      yieldOnCost: guardDiv(year1Income, siteAcquisitionCost),
      revenuePerStall: annualLeasePerStall,
      npvOfLease,
    },
    warnings,
  };
}

export const evChargingSite: InvestmentModule = {
  id: 'ev-charging-site',
  name: 'EV Charging Site',
  category: 'Infrastructure',
  tier: 'creative',
  blurb: 'Host EV fast-charging on a ground lease to a charging operator.',
  params: [
    { key: 'siteAcquisitionCost', label: 'Site acquisition cost', type: 'currency', unit: '$', default: 450_000, min: 0, step: 10_000, group: 'Acquisition', verify: true, help: 'Cost to acquire the pad/site.' },
    { key: 'numberOfStalls', label: 'Charging stalls', type: 'integer', unit: 'count', default: 8, min: 1, max: 40, step: 1, group: 'Income', help: 'Number of fast-charging stalls on the site.' },
    { key: 'annualLeasePerStall', label: 'Lease per stall', type: 'currency', unit: '$/yr', default: 4_500, min: 0, step: 250, group: 'Income', verify: true, help: 'Annual site rent per stall (or revenue-share equivalent). Verify against the operator agreement.' },
    { key: 'utilizationGrowthPct', label: 'Utilization growth', type: 'percent', unit: '%', default: 0.06, min: 0, max: 0.3, step: 0.01, group: 'Income', verify: true, help: 'Early-ramp annual growth in utilization/income.' },
    { key: 'leaseTermYears', label: 'Lease term', type: 'integer', unit: 'yr', default: 15, min: 1, max: 30, step: 1, group: 'Income', verify: true },

    { key: 'appreciationPct', label: 'Site appreciation', type: 'percent', unit: '%', default: 0.03, min: -0.1, max: 0.15, step: 0.005, group: 'Exit' },
    { key: 'discountRate', label: 'Discount rate', type: 'percent', unit: '%', default: 0.09, min: 0, max: 0.3, step: 0.005, group: 'Exit', help: 'Higher than mature ground leases to reflect sector immaturity.' },
    { key: 'holdYears', label: 'Hold period', type: 'integer', unit: 'yr', default: 5, min: 1, max: 30, step: 1, group: 'Exit' },
    { key: 'sellingCostPct', label: 'Selling costs', type: 'percent', unit: '%', default: 0.06, min: 0, max: 0.15, step: 0.005, group: 'Exit' },
  ],
  metrics: [
    { key: 'yieldOnCost', label: 'Yield on cost', unit: '%', higherIsBetter: true, help: 'Year-1 lease income / site acquisition cost.' },
    { key: 'revenuePerStall', label: 'Revenue per stall', unit: '$/yr', higherIsBetter: true, help: 'Annual lease income per charging stall.' },
    { key: 'npvOfLease', label: 'NPV of lease', unit: '$', higherIsBetter: true, help: 'Present value of the full-term ramping lease plus site reversion, net of acquisition.' },
  ],
  compute,
  narrative: {
    strategy:
      'Own a well-placed site and lease it to an EV fast-charging operator on a per-stall basis, taking **site rent rather than session revenue** — the passive posture in an emerging sector. Income ramps as utilization climbs in the early years. This is an **early-stage** bet: adoption, standards, and site economics are still shifting, so the higher discount rate is deliberate. The edge is locking in a scarce, grid-connected, high-traffic location before the sector matures.',
    risks: [
      'Utilization is uncertain and standards are still shifting — fast-charging demand and connector/plug standards can move against a specific site.',
      'Location and grid-capacity dependence: without adequate interconnection and traffic, a site underperforms regardless of the lease.',
      'Operator credit: many charging operators are young and unprofitable, so the lease is only as strong as the counterparty.',
      'Early-ramp income can undershoot the growth assumption, and a soft ramp compresses both yield and exit value.',
    ],
    opportunities: [
      'NEVI and state/utility incentive programs are a real tailwind for build-out and site economics.',
      'Scarce, grid-ready, high-traffic sites should command rising rents as EV adoption grows.',
      'A passive ground-lease structure captures upside while offloading operating volatility to the operator.',
    ],
    regulatory:
      'Charging-site economics are shaped by NEVI and state/utility incentive rules, interconnection policy, and make-ready cost allocation — confirm program eligibility and grid availability before underwriting the ramp.',
    dataHooks: ['viirs-radiance'],
  },
};
