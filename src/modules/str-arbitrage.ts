import type { InvestmentModule, ComputeResult } from '../core/types';
import { guardDiv } from '../core/finance';
import { computeIncomeStream } from './_shapes';

// Rental Arbitrage. You own NOTHING. You lease a unit on a long-term lease, furnish
// it, and sublet it nightly, keeping the spread. Capital at risk is tiny (furniture,
// deposit, first month) but the model is FRAGILE: the landlord can terminate, the
// lease may forbid subletting outright, and a city or platform can ban the practice
// overnight. High operational leverage on a thin base.

function compute(i: Record<string, number>): ComputeResult {
  const monthlyLeaseCost = i.monthlyLeaseCost ?? 0;
  const furnishingCost = i.furnishingCost ?? 0;
  const securityDeposit = i.securityDeposit ?? 0;
  const firstMonthRent = monthlyLeaseCost; // paid up front alongside the deposit

  const adr = i.adr ?? 0;
  const occupancy = i.occupancyPct ?? 0;
  const platformFeePct = i.platformFeePct ?? 0;
  const utilitiesMonthly = i.utilitiesMonthly ?? 0;
  const suppliesPct = i.suppliesPct ?? 0;
  const managementPct = i.managementPct ?? 0;
  const maintenancePct = i.maintenancePct ?? 0;
  const variablePct = suppliesPct + managementPct + maintenancePct;
  const leaseTermYearsModeled = Math.max(Math.round(i.leaseTermYearsModeled ?? 3), 1);

  const grossRev = adr * 365 * occupancy;
  const annualCF =
    grossRev * (1 - platformFeePct) -
    monthlyLeaseCost * 12 -
    utilitiesMonthly * 12 -
    grossRev * variablePct;

  const capital = furnishingCost + securityDeposit + firstMonthRent;
  const annualCashflows = Array.from({ length: leaseTermYearsModeled }, () => annualCF);
  const terminalValue = securityDeposit; // deposit refunded at lease end

  const core = computeIncomeStream({
    capital,
    assetPrice: capital,
    annualCashflows,
    terminalValue,
    debtServiceAnnual: 0,
    noiAnnual: annualCF,
  });

  // Break-even occupancy: the nightly occupancy at which the spread covers the
  // fixed lease + utilities. Management/supplies/maintenance scale with revenue.
  const marginPerRevenue = 1 - platformFeePct - variablePct;
  const revNeeded = guardDiv(monthlyLeaseCost * 12 + utilitiesMonthly * 12, marginPerRevenue);
  const breakEvenOccupancy = adr > 0 ? guardDiv(revNeeded, adr * 365) : NaN;
  const monthlyProfit = annualCF / 12;

  const warnings: string[] = [
    'You own no asset. Your entire position is a lease you do not control — the landlord can decline to renew or terminate for cause.',
  ];
  if (Number.isFinite(breakEvenOccupancy) && breakEvenOccupancy > occupancy)
    warnings.push(`Modeled occupancy ${(occupancy * 100).toFixed(0)}% is below break-even ${(breakEvenOccupancy * 100).toFixed(0)}% — the spread is negative at these inputs.`);
  if (Number.isFinite(breakEvenOccupancy) && breakEvenOccupancy > 0.7)
    warnings.push(`Break-even occupancy ${(breakEvenOccupancy * 100).toFixed(0)}% is high — thin cushion on a lease you must keep paying even when empty.`);
  if (annualCF < 0) warnings.push('Year-1 spread is negative: you would pay to operate this unit.');

  return {
    metrics: { ...core, breakEvenOccupancy, monthlyProfit, capitalAtRisk: capital },
    warnings,
  };
}

export const strArbitrage: InvestmentModule = {
  id: 'str-arbitrage',
  name: 'Rental Arbitrage — Sublet STR',
  category: 'Hospitality',
  tier: 'creative',
  blurb: 'No ownership: lease a unit, sublet it nightly, keep the spread. Thin capital, high fragility.',
  params: [
    { key: 'monthlyLeaseCost', label: 'Monthly lease cost', type: 'currency', unit: '$/mo', default: 2_400, min: 0, step: 50, group: 'Lease', verify: true, help: 'Your long-term rent to the landlord. Verify the actual lease terms — and that subletting is permitted in writing.' },
    { key: 'leaseTermYearsModeled', label: 'Lease term modeled', type: 'integer', unit: 'yr', default: 3, min: 1, max: 10, step: 1, group: 'Lease', help: 'Years of income modeled. You have no control beyond the current lease.' },
    { key: 'securityDeposit', label: 'Security deposit', type: 'currency', unit: '$', default: 4_800, min: 0, step: 100, group: 'Lease', help: 'Refundable at lease end (modeled as terminal value).' },

    { key: 'furnishingCost', label: 'Furnishing & setup', type: 'currency', unit: '$', default: 18_000, min: 0, step: 500, group: 'Setup', help: 'Furniture, linens, kitchen, photography. This walks away with you, but is a sunk cost if the lease ends early.' },

    { key: 'adr', label: 'Average daily rate', type: 'number', unit: '$/night', default: 180, min: 0, step: 5, group: 'Income', verify: true, help: 'Verify against comparable active listings in the exact building/submarket.' },
    { key: 'occupancyPct', label: 'Occupancy', type: 'percent', unit: '%', default: 0.65, min: 0, max: 1, step: 0.01, group: 'Income', verify: true, help: 'Paid nights / available nights. You pay the fixed lease whether booked or not.' },
    { key: 'platformFeePct', label: 'Platform fee', type: 'percent', unit: '%', default: 0.03, min: 0, max: 0.2, step: 0.005, group: 'Income' },

    { key: 'utilitiesMonthly', label: 'Utilities', type: 'currency', unit: '$/mo', default: 280, min: 0, step: 20, group: 'Expenses' },
    { key: 'suppliesPct', label: 'Supplies & consumables', type: 'percent', unit: '%', default: 0.05, min: 0, max: 0.2, step: 0.005, group: 'Expenses' },
    { key: 'managementPct', label: 'Management / co-host', type: 'percent', unit: '%', default: 0.0, min: 0, max: 0.4, step: 0.01, group: 'Expenses', help: 'Arbitrage operators typically self-manage to preserve the thin spread.' },
    { key: 'maintenancePct', label: 'Maintenance & turnover', type: 'percent', unit: '%', default: 0.04, min: 0, max: 0.2, step: 0.005, group: 'Expenses' },
  ],
  metrics: [
    { key: 'breakEvenOccupancy', label: 'Break-even occupancy', unit: '%', higherIsBetter: false, help: 'Occupancy at which the nightly spread covers the fixed lease and utilities. Lower is safer.' },
    { key: 'monthlyProfit', label: 'Monthly profit', unit: '$/mo', higherIsBetter: true, help: 'Year-1 spread divided by 12.' },
    { key: 'capitalAtRisk', label: 'Capital at risk', unit: '$', higherIsBetter: null, help: 'Furnishing + deposit + first month. Small — which is precisely why the downside is operational, not capital.' },
  ],
  compute,
  narrative: {
    strategy:
      'Lease a unit long-term, furnish it, and re-let it by the night, pocketing the spread between nightly revenue and your fixed rent. The appeal is **near-zero capital and no mortgage** — but you own nothing, and that is the whole story. Every dollar of upside sits on top of a lease you do not control and a fixed monthly payment that does not pause when the calendar goes empty. This is the most **fragile** model in the set: high operational leverage on a thin base.',
    risks: [
      'You own no asset. The landlord can decline renewal, sell the building, or terminate for cause, ending the business with no residual value.',
      'The lease itself may prohibit subletting or short-term use — operating anyway is a breach that can trigger eviction and forfeiture of the deposit. VERIFY the written lease.',
      'City STR bans and platform policy changes can zero the revenue overnight while the fixed lease payment continues.',
      'Thin spread + fixed rent = high operational leverage: a few soft months can wipe out a year of profit, and you keep paying rent through the vacancy.',
    ],
    opportunities: [
      'Lowest capital entry into STR operations — no down payment, no mortgage, no closing costs.',
      'Fully portable: furnishings and know-how move to the next unit if one lease ends.',
      'Fast to scale unit-by-unit when a market and landlord relationship prove out — no financing bottleneck.',
    ],
    regulatory:
      'This model is doubly exposed. First, the LEASE: subletting and short-term use are frequently prohibited — operating in breach risks eviction and loss of deposit, so get written landlord consent. Second, the CITY: STR permits, primary-residence rules, and outright bans apply, and arbitrage operators (who are not owners and often not residents) are the first the rules exclude. Verify both before signing anything.',
    dataHooks: ['viirs-radiance'],
  },
};
