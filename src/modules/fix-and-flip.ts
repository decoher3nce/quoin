import type { InvestmentModule, ComputeResult } from '../core/types';
import { computeFlip } from './_shapes';

// Fix & Flip. Buy, renovate, sell — no stabilized NOI, so the operating-hold
// core metrics are honestly "—". The return lives in project ROI and its
// annualization. Hard-money interest runs on a clock, so every extra month of
// rehab or days-on-market eats directly into the margin. The signature output is
// the margin of safety on the after-repair value.

function compute(i: Record<string, number>): ComputeResult {
  const purchasePrice = i.purchasePrice ?? 0;
  const rehabBudget = i.rehabBudget ?? 0;
  const financedPct = i.financedPct ?? 0;
  const rate = i.interestRate ?? 0;
  const holdingMonths = Math.max(i.holdingMonths ?? 1, 1);
  const arv = i.afterRepairValue ?? 0;
  const sellingPct = i.sellingCostPct ?? 0;

  const basis = purchasePrice + rehabBudget;
  const loan = basis * financedPct;
  const interest = loan * rate * (holdingMonths / 12); // interest-only hard money
  const buyClosing = purchasePrice * (i.buyClosingCostPct ?? 0);
  const carry = (i.monthlyCarry ?? 0) * holdingMonths;
  const cashInvested = basis * (1 - financedPct) + buyClosing + carry + interest;

  const flip = computeFlip({
    exitValue: arv,
    sellingCostPct: sellingPct,
    loanPayoff: loan,
    cashInvested,
    months: holdingMonths,
  });

  const warnings: string[] = [];
  if (Number.isFinite(flip.marginOfSafety) && flip.marginOfSafety < 0.1)
    warnings.push(
      `Margin of safety on ARV is ${(flip.marginOfSafety * 100).toFixed(0)}% — under 10%. A modest ARV miss or rehab overrun wipes out the profit.`,
    );
  if (flip.profit < 0) warnings.push('Modeled profit is negative at these inputs.');
  warnings.push('Hard-money interest accrues monthly — every extra month of rehab or days-on-market cuts the return.');

  return {
    metrics: {
      ...flip.core,
      profit: flip.profit,
      roi: flip.roi,
      annualizedRoi: flip.annualizedRoi,
      marginOfSafety: flip.marginOfSafety,
    },
    warnings,
  };
}

export const fixAndFlip: InvestmentModule = {
  id: 'fix-and-flip',
  name: 'Fix & Flip',
  category: 'Residential',
  tier: 'core',
  blurb: 'Buy, renovate, sell. Return is project ROI, not cash flow. Margin of safety is everything.',
  params: [
    { key: 'purchasePrice', label: 'Purchase price', type: 'currency', unit: '$', default: 320_000, min: 0, step: 5000, group: 'Acquisition', verify: true, help: 'The all-important buy price. Verify the comps that justify it.' },
    { key: 'buyClosingCostPct', label: 'Buy-side closing', type: 'percent', unit: '%', default: 0.02, min: 0, max: 0.1, step: 0.005, group: 'Acquisition' },
    { key: 'rehabBudget', label: 'Rehab budget', type: 'currency', unit: '$', default: 65_000, min: 0, step: 2500, group: 'Rehab', verify: true, help: 'Scope × cost. The most commonly underestimated line in a flip.' },
    { key: 'holdingMonths', label: 'Holding period', type: 'integer', unit: 'count', default: 7, min: 1, max: 36, step: 1, group: 'Rehab', help: 'Months from purchase to sale — rehab plus time on market.' },
    { key: 'monthlyCarry', label: 'Monthly carry', type: 'currency', unit: '$/mo', default: 1_400, min: 0, step: 100, group: 'Rehab', help: 'Taxes, insurance, utilities, and other holding costs per month.' },
    { key: 'financedPct', label: 'Financed portion', type: 'percent', unit: '%', default: 0.85, min: 0, max: 1, step: 0.01, group: 'Financing', help: 'Share of purchase + rehab covered by hard money. 0 = all cash.' },
    { key: 'interestRate', label: 'Loan rate (interest-only)', type: 'percent', unit: '%', default: 0.11, min: 0, max: 0.3, step: 0.005, group: 'Financing', verify: true, help: 'Hard-money rate, interest-only over the hold. Verify current terms and points.' },
    { key: 'afterRepairValue', label: 'After-repair value (ARV)', type: 'currency', unit: '$', default: 470_000, min: 0, step: 5000, group: 'Exit', verify: true, help: 'The exit price after renovation. Verify against renovated comps — the whole deal rests on this.' },
    { key: 'sellingCostPct', label: 'Selling costs', type: 'percent', unit: '%', default: 0.07, min: 0, max: 0.15, step: 0.005, group: 'Exit', help: 'Commissions, concessions, and closing on the sale.' },
  ],
  metrics: [
    { key: 'profit', label: 'Net profit', unit: '$', higherIsBetter: true, help: 'Net sale proceeds minus all cash invested.' },
    { key: 'roi', label: 'Return on investment', unit: '%', higherIsBetter: true, help: 'Profit / cash invested over the project (not annualized).' },
    { key: 'annualizedRoi', label: 'Annualized ROI', unit: '%', higherIsBetter: true, help: 'Project return scaled to an annual rate — comparable to a hold IRR.' },
    { key: 'marginOfSafety', label: 'Margin of safety', unit: '%', higherIsBetter: true, help: 'How far ARV can fall before the deal breaks even, as a fraction of ARV. The cushion.' },
  ],
  compute,
  narrative: {
    strategy:
      'Buy a distressed house below market, renovate it, and sell at the after-repair value. There is **no rental income** — cash-on-cash, cap rate, and DSCR are honestly not applicable, so they show as "—". The whole game is the **margin of safety on ARV**: the gap between what you are all-in for and what the renovated house will actually sell for. The two things that kill flips are **rehab overruns** and **days-on-market**, both of which compound against a hard-money interest clock that never stops ticking.',
    risks: [
      'ARV is an estimate; a 5% miss on a thin-margin flip can erase the entire profit.',
      'Rehab scope creep and contractor delays blow the budget and extend the interest clock.',
      'Days-on-market risk: if it does not sell fast, carry and interest grind down the return.',
      'A cooling market between purchase and sale hits both ARV and time-to-sell at once.',
    ],
    opportunities: [
      'Forced appreciation: value created by the renovation, not by waiting on the market.',
      'Fast capital turns — a clean flip recycles cash in well under a year.',
      'Disciplined buying (a wide margin of safety) makes the strategy resilient to modest misses.',
    ],
    regulatory:
      'Confirm permit requirements for the planned scope and any local anti-flipping or seasoning rules that could delay resale or restrict buyer financing.',
    dataHooks: ['viirs-radiance'],
  },
};
