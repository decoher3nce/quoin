import type { InvestmentModule, ComputeResult } from '../core/types';
import { guardDiv, npv } from '../core/finance';
import { computeIncomeStream } from './_shapes';

// Solar Land Lease. Buy the dirt, lease it to a utility-scale solar developer,
// and collect a bond-like, contractually escalating ground rent while retaining
// ownership of the land itself. The whole point is passivity: no operations, no
// debt service modeled, a long fixed-term stream plus the reversion of the land
// at exit. cap rate here is the yield on land value; dscr is NaN (unlevered).

function compute(i: Record<string, number>): ComputeResult {
  const landPurchasePrice = i.landPurchasePrice ?? 0;
  const acres = i.acres ?? 1;
  const leaseRatePerAcreAnnual = i.leaseRatePerAcreAnnual ?? 0;
  const escalationPct = i.escalationPct ?? 0;
  const leaseTermYears = Math.round(i.leaseTermYears ?? 25);
  const landAppreciationPct = i.landAppreciationPct ?? 0;
  const discountRate = i.discountRate ?? 0;
  const holdYears = Math.round(i.holdYears ?? 5);
  const sellingCostPct = i.sellingCostPct ?? 0;

  const year1Income = leaseRatePerAcreAnnual * acres;
  const capital = landPurchasePrice;
  const assetPrice = landPurchasePrice;

  // Five modeled years of escalating ground rent for the standardized 5-yr core.
  const annualCashflows = Array.from({ length: 5 }, (_, k) =>
    year1Income * Math.pow(1 + escalationPct, k),
  );
  const terminalValue =
    landPurchasePrice * Math.pow(1 + landAppreciationPct, holdYears) * (1 - sellingCostPct);

  const core = computeIncomeStream({
    capital,
    assetPrice,
    annualCashflows,
    terminalValue,
    debtServiceAnnual: 0,
    noiAnnual: year1Income,
  });

  // Full lease-term NPV: every escalating rent payment across the whole term,
  // with the appreciated, sale-cost-adjusted land reversion at the end.
  const fullTermCashflows = Array.from({ length: leaseTermYears }, (_, k) =>
    year1Income * Math.pow(1 + escalationPct, k),
  );
  const npvOfLease = npv(discountRate, [-capital, ...fullTermCashflows, terminalValue]);

  const warnings: string[] = [];
  if (year1Income <= 0)
    warnings.push('No lease income modeled — a pre-construction option period pays little or nothing.');

  return {
    metrics: {
      ...core,
      yieldOnLandValue: guardDiv(year1Income, landPurchasePrice),
      leaseRatePerAcre: leaseRatePerAcreAnnual,
      npvOfLease,
    },
    warnings,
  };
}

export const solarLandLease: InvestmentModule = {
  id: 'solar-land-lease',
  name: 'Solar Land Lease',
  category: 'Infrastructure',
  tier: 'creative',
  blurb: 'Lease land to a utility-scale solar developer for escalating ground rent.',
  params: [
    { key: 'landPurchasePrice', label: 'Land purchase price', type: 'currency', unit: '$', default: 2_400_000, min: 0, step: 10_000, group: 'Acquisition', verify: true, help: 'All-in cost to buy the parcel ($/acre × acres). Solar-viable land near substations is not cheap.' },
    { key: 'acres', label: 'Parcel size', type: 'number', unit: 'count', default: 300, min: 1, step: 10, group: 'Acquisition', help: 'Acres under lease.' },
    { key: 'leaseRatePerAcreAnnual', label: 'Lease rate per acre', type: 'currency', unit: '$/yr', default: 1_000, min: 0, step: 50, group: 'Income', verify: true, help: 'Annual ground rent per acre (commonly $800–1,400). Verify against a signed or comparable solar option/lease.' },
    { key: 'escalationPct', label: 'Rent escalation', type: 'percent', unit: '%', default: 0.02, min: 0, max: 0.1, step: 0.005, group: 'Income', verify: true, help: 'Contractual annual escalator.' },
    { key: 'leaseTermYears', label: 'Lease term', type: 'integer', unit: 'yr', default: 25, min: 1, max: 50, step: 1, group: 'Income', verify: true, help: 'Primary term; utility-scale solar leases commonly run 20–35 years.' },

    { key: 'landAppreciationPct', label: 'Land appreciation', type: 'percent', unit: '%', default: 0.02, min: -0.1, max: 0.15, step: 0.005, group: 'Exit', help: 'Appreciation of the underlying land you retain.' },
    { key: 'discountRate', label: 'Discount rate', type: 'percent', unit: '%', default: 0.07, min: 0, max: 0.25, step: 0.005, group: 'Exit', help: 'Rate used to discount the full-term lease NPV.' },
    { key: 'holdYears', label: 'Hold period', type: 'integer', unit: 'yr', default: 5, min: 1, max: 30, step: 1, group: 'Exit' },
    { key: 'sellingCostPct', label: 'Selling costs', type: 'percent', unit: '%', default: 0.05, min: 0, max: 0.15, step: 0.005, group: 'Exit' },
  ],
  metrics: [
    { key: 'yieldOnLandValue', label: 'Yield on land value', unit: '%', higherIsBetter: true, help: 'Year-1 ground rent / land purchase price.' },
    { key: 'leaseRatePerAcre', label: 'Lease rate per acre', unit: '$/yr', higherIsBetter: true, help: 'Contract ground rent per acre per year.' },
    { key: 'npvOfLease', label: 'NPV of lease', unit: '$', higherIsBetter: true, help: 'Present value of the full-term escalating rent plus land reversion, net of purchase.' },
  ],
  compute,
  narrative: {
    strategy:
      'Buy the land and lease it to a utility-scale solar developer, collecting a **bond-like, contractually escalating** ground rent for decades while you keep the dirt. There is no operating business to run and no debt modeled — the return is a long, predictable income stream plus the reversion of an appreciating asset you never sold. The edge is buying land whose lease value the market has not yet priced, then holding a passive, inflation-hedged coupon.',
    risks: [
      'Developer **credit and execution**: a signed lease is only as good as the counterparty, and many leases sit in an option period before construction ever begins.',
      'Interconnection and construction contingency — grid-queue delays or a cancelled project can leave the land producing little income for years.',
      'Decommissioning obligations: if the developer defaults, restoring the site and removing equipment can fall to the landowner.',
      'Long duration means rate and inflation risk — a fixed escalator can lag if inflation runs hot over a 25-year term.',
    ],
    opportunities: [
      'Passive, escalating income with essentially no operations once the lease is signed.',
      'You retain ownership of the land and its appreciation, capturing both the coupon and the reversion.',
      'Long-dated, investment-grade-style cash flows can be attractive to buyers, supporting a premium exit.',
    ],
    regulatory:
      'Solar leases carry decommissioning-bond and land-restoration requirements that vary by county and state — confirm who is obligated and whether financial assurance is posted before relying on the terminal land value.',
    dataHooks: ['viirs-radiance'],
  },
};
