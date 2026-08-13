import type { InvestmentModule, ComputeResult } from '../core/types';
import { guardDiv, npv } from '../core/finance';
import { computeIncomeStream } from './_shapes';

// Cell Tower Ground Lease. Own the ground under a wireless tower and collect the
// rent a tower operator (or carrier) pays for the pad and access. Famously sticky
// income — relocating a live tower is expensive and disruptive — with contractual
// escalators and colocation upside as extra tenants hang equipment for pure margin.
// Unlevered here, so dscr is NaN; cap rate is the current yield on cost.

function compute(i: Record<string, number>): ComputeResult {
  const acquisitionCost = i.acquisitionCost ?? 0;
  const monthlyRent = i.monthlyRent ?? 0;
  const escalationPct = i.escalationPct ?? 0;
  const leaseTermYears = Math.round(i.leaseTermYears ?? 30);
  const colocationTenants = Math.max(i.colocationTenants ?? 1, 0);
  const appreciationPct = i.appreciationPct ?? 0;
  const discountRate = i.discountRate ?? 0;
  const holdYears = Math.round(i.holdYears ?? 5);
  const sellingCostPct = i.sellingCostPct ?? 0;

  const year1Income = monthlyRent * 12 * colocationTenants;
  const capital = acquisitionCost;
  const assetPrice = acquisitionCost;

  const annualCashflows = Array.from({ length: 5 }, (_, k) =>
    year1Income * Math.pow(1 + escalationPct, k),
  );
  const terminalValue =
    acquisitionCost * Math.pow(1 + appreciationPct, holdYears) * (1 - sellingCostPct);

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

  return {
    metrics: {
      ...core,
      currentYield: guardDiv(year1Income, acquisitionCost),
      escalation: escalationPct,
      // Rough buyout comp: capitalize year-1 rent at ~6% — what an aggregator
      // might offer as a lump sum for the stream.
      leaseBuyoutEstimate: guardDiv(year1Income, 0.06),
      npvOfLease,
    },
  };
}

export const cellTowerGroundLease: InvestmentModule = {
  id: 'cell-tower-ground-lease',
  name: 'Cell Tower Ground Lease',
  category: 'Infrastructure',
  tier: 'creative',
  blurb: 'Own the ground under a wireless tower and collect sticky, escalating rent.',
  params: [
    { key: 'acquisitionCost', label: 'Acquisition cost', type: 'currency', unit: '$', default: 350_000, min: 0, step: 10_000, group: 'Acquisition', verify: true, help: 'Cost to acquire the parcel / ground-lease position.' },
    { key: 'monthlyRent', label: 'Monthly ground rent', type: 'currency', unit: '$/mo', default: 2_200, min: 0, step: 50, group: 'Income', verify: true, help: 'Rent per tenant per month. Verify against the lease.' },
    { key: 'colocationTenants', label: 'Colocation tenants', type: 'integer', unit: 'count', default: 1, min: 0, max: 6, step: 1, group: 'Income', help: 'Carriers/tenants on the tower. Each additional tenant is near-pure margin.' },
    { key: 'escalationPct', label: 'Rent escalation', type: 'percent', unit: '%', default: 0.03, min: 0, max: 0.1, step: 0.005, group: 'Income', verify: true, help: 'Contractual annual escalator (often 3%).' },
    { key: 'leaseTermYears', label: 'Lease term', type: 'integer', unit: 'yr', default: 30, min: 1, max: 50, step: 1, group: 'Income', verify: true, help: 'Primary plus renewal terms commonly reach 25–50 years.' },

    { key: 'appreciationPct', label: 'Position appreciation', type: 'percent', unit: '%', default: 0.03, min: -0.1, max: 0.15, step: 0.005, group: 'Exit', help: 'Appreciation of the ground-lease position at exit.' },
    { key: 'discountRate', label: 'Discount rate', type: 'percent', unit: '%', default: 0.08, min: 0, max: 0.25, step: 0.005, group: 'Exit' },
    { key: 'holdYears', label: 'Hold period', type: 'integer', unit: 'yr', default: 5, min: 1, max: 30, step: 1, group: 'Exit' },
    { key: 'sellingCostPct', label: 'Selling costs', type: 'percent', unit: '%', default: 0.05, min: 0, max: 0.15, step: 0.005, group: 'Exit' },
  ],
  metrics: [
    { key: 'currentYield', label: 'Current yield', unit: '%', higherIsBetter: true, help: 'Year-1 rent / acquisition cost.' },
    { key: 'escalation', label: 'Rent escalator', unit: '%', higherIsBetter: true, help: 'Contractual annual rent escalation.' },
    { key: 'leaseBuyoutEstimate', label: 'Lease buyout estimate', unit: '$', higherIsBetter: null, help: 'Year-1 rent capitalized at ~6% — an indicative lump-sum buyout comp.' },
    { key: 'npvOfLease', label: 'NPV of lease', unit: '$', higherIsBetter: true, help: 'Full-term escalating rent plus reversion, discounted at the discount rate.' },
  ],
  compute,
  narrative: {
    strategy:
      'Own the ground beneath a wireless tower and collect the operator’s rent. The income is **extremely sticky**: once a tower is built and carriers are on air, relocating it costs the operator far more than the rent, so leases renew almost automatically. Built-in escalators grow the coupon, and every additional **colocation** tenant is near-pure margin on the same pad. The play is a durable, low-touch annuity with quiet upside.',
    risks: [
      'Buyout-offer temptation: aggregators dangle lump sums that can look large but often price the stream below its long-run value — selling trades a growing annuity for a one-time check.',
      'Technology risk: small-cell/DAS densification and network redesign could, over decades, reduce a specific macro site’s importance.',
      'Single-tenant concentration — with one carrier, a non-renewal or consolidation event removes most of the income at once.',
      'Long-dated cash flows carry interest-rate and inflation risk if the escalator lags.',
    ],
    opportunities: [
      'Colocation: adding a second or third tenant multiplies rent with almost no added cost or capital.',
      'Contractual escalators compound the coupon year after year with no re-leasing effort.',
      'Scarcity and stickiness support premium exit multiples from tower REITs and lease aggregators.',
    ],
    dataHooks: ['viirs-radiance'],
  },
};
