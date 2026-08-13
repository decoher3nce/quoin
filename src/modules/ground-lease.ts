import type { InvestmentModule, ComputeResult } from '../core/types';
import { npv } from '../core/finance';
import { computeIncomeStream } from './_shapes';

// Ground lease. You own the LAND under a building and lease it to the building
// owner on a very long term with contractual rent escalations. It is a bond-like
// position: low risk, low current yield, inflation protection via escalations,
// and reversion of the improvements at the (distant) end of the lease.

function compute(i: Record<string, number>): ComputeResult {
  const landPurchasePrice = i.landPurchasePrice ?? 0;
  const annualGroundRent = i.annualGroundRent ?? 0;
  const rentEscalationPct = i.rentEscalationPct ?? 0;
  const leaseTermYears = i.leaseTermYears ?? 0;
  const landAppreciationPct = i.landAppreciationPct ?? 0;
  const holdYears = Math.max(1, Math.round(i.holdYears ?? 5));
  const sellingCostPct = i.sellingCostPct ?? 0;

  const capital = landPurchasePrice;

  const annualCashflows = Array.from(
    { length: holdYears },
    (_, idx) => annualGroundRent * Math.pow(1 + rentEscalationPct, idx),
  );
  // Sell the leased-fee position at year 5, after land appreciation, net of costs.
  const terminalValue =
    landPurchasePrice * Math.pow(1 + landAppreciationPct, 5) * (1 - sellingCostPct);

  const core = computeIncomeStream({
    capital,
    assetPrice: landPurchasePrice,
    annualCashflows,
    terminalValue,
    debtServiceAnnual: 0,
    noiAnnual: annualGroundRent,
  });

  const currentYield = landPurchasePrice > 0 ? annualGroundRent / landPurchasePrice : NaN;

  // NPV of the next 20 years of escalating rent at a 6% discount. A leading 0
  // places each rent payment at end of its year (t = 1..20).
  const leaseCashflows: number[] = [0];
  for (let y = 0; y < 20; y++) {
    leaseCashflows.push(annualGroundRent * Math.pow(1 + rentEscalationPct, y));
  }
  const npvOfLease = npv(0.06, leaseCashflows);

  return {
    metrics: {
      ...core,
      currentYield,
      npvOfLease,
      reversionYearsAway: leaseTermYears,
    },
  };
}

export const groundLease: InvestmentModule = {
  id: 'ground-lease',
  name: 'Ground Lease — Leased-Fee Land',
  category: 'Paper',
  tier: 'creative',
  blurb: 'Own the land under a building; collect escalating rent, keep the reversion.',
  params: [
    { key: 'landPurchasePrice', label: 'Land purchase price', type: 'currency', unit: '$', default: 1_200_000, min: 0, step: 25_000, group: 'Acquisition', verify: true, help: 'Price for the land parcel under the improvements. Verify against ground-lease cap-rate comps.' },
    { key: 'annualGroundRent', label: 'Annual ground rent', type: 'currency', unit: '$/yr', default: 66_000, min: 0, step: 1000, group: 'Income', verify: true, help: 'Contractual rent the building owner pays you. Verify against the executed lease.' },
    { key: 'rentEscalationPct', label: 'Rent escalation', type: 'percent', unit: '%', default: 0.02, min: 0, max: 0.1, step: 0.005, group: 'Income', help: 'Contractual annual step-up (fixed or CPI-linked).' },
    { key: 'leaseTermYears', label: 'Lease term', type: 'integer', unit: 'yr', default: 75, min: 1, max: 99, step: 1, group: 'Lease', help: 'Years remaining until reversion of the improvements.' },

    { key: 'landAppreciationPct', label: 'Land appreciation', type: 'percent', unit: '%', default: 0.03, min: -0.05, max: 0.15, step: 0.005, group: 'Exit', verify: true, help: 'Assumed annual appreciation of the leased-fee position.' },
    { key: 'holdYears', label: 'Hold period', type: 'integer', unit: 'yr', default: 5, min: 1, max: 30, step: 1, group: 'Exit' },
    { key: 'sellingCostPct', label: 'Selling costs', type: 'percent', unit: '%', default: 0.04, min: 0, max: 0.1, step: 0.005, group: 'Exit' },
  ],
  metrics: [
    { key: 'currentYield', label: 'Current yield', unit: '%', higherIsBetter: true, help: 'Year-1 ground rent ÷ land price. The bond-like running yield.' },
    { key: 'npvOfLease', label: 'NPV of lease (20 yr)', unit: '$', higherIsBetter: true, help: 'Present value of the next 20 years of escalating rent at a 6% discount.' },
    { key: 'reversionYearsAway', label: 'Reversion horizon', unit: 'yr', higherIsBetter: null, help: 'Years until the improvements revert to the landowner at lease end.' },
  ],
  compute,
  narrative: {
    strategy:
      'Own the land beneath a building and lease it back to the building owner on a long term with contractual escalations. It behaves like an **inflation-linked bond secured by real estate**: the rent is senior to the building owner’s own economics, escalations track inflation, and at the (usually distant) end of the lease the improvements revert to you for nothing. Low yield, low risk, very long duration.',
    risks: [
      'Long duration makes the position highly rate-sensitive — value falls when discount rates rise.',
      'The reversion of improvements is decades away and heavily discounted, so near-term value rests almost entirely on the rent.',
      'Tenant (building-owner) default or bankruptcy can interrupt rent despite the senior position.',
      'Subordination of the fee to the building’s mortgage, if agreed, weakens the landowner’s priority.',
    ],
    opportunities: [
      'Rent sits ahead of the building owner’s operating and debt costs — a durable, senior claim.',
      'Contractual escalations provide built-in inflation protection with no re-leasing effort.',
      'Reversion of the improvements at lease end is a large, essentially free terminal asset.',
    ],
    regulatory:
      'Whether the ground lease is subordinated or unsubordinated to the building’s financing materially changes the landowner’s priority and risk. Confirm the subordination terms and reversion clause in the executed lease.',
  },
};
