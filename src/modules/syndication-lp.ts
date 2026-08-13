import type { InvestmentModule, ComputeResult } from '../core/types';
import { computeIncomeStream } from './_shapes';

// Real-estate syndication, passive LP interest. You commit capital to a
// sponsor-led deal, receive periodic cash distributions plus a share of the
// exit profit. Fully passive but entirely dependent on the GP’s execution and
// the honesty of the sponsor’s projections.

function compute(i: Record<string, number>): ComputeResult {
  const investmentAmount = i.investmentAmount ?? 0;
  const holdYears = Math.max(1, Math.round(i.holdYears ?? 5));
  const cashDistributionPct = i.cashDistributionPct ?? 0;
  const preferredReturnPct = i.preferredReturnPct ?? 0;
  const projectedExitProfitPct = i.projectedExitProfitPct ?? 0;

  const annualDist = investmentAmount * cashDistributionPct;
  const annualCashflows = Array.from({ length: holdYears }, () => annualDist);
  const terminalValue = investmentAmount * (1 + projectedExitProfitPct);

  const core = computeIncomeStream({
    capital: investmentAmount,
    assetPrice: investmentAmount,
    annualCashflows,
    terminalValue,
    debtServiceAnnual: 0,
    noiAnnual: annualDist,
  });

  const equityMultiple =
    investmentAmount > 0
      ? (annualDist * holdYears + investmentAmount * (1 + projectedExitProfitPct)) / investmentAmount
      : NaN;
  const profitAtExit = investmentAmount * projectedExitProfitPct;

  const warnings: string[] = [];
  if (cashDistributionPct < preferredReturnPct)
    warnings.push(
      'Cash distributions below preferred return — shortfall accrues to exit (if the deal performs).',
    );

  return {
    metrics: {
      ...core,
      equityMultiple,
      preferredReturn: preferredReturnPct,
      profitAtExit,
    },
    warnings,
  };
}

export const syndicationLp: InvestmentModule = {
  id: 'syndication-lp',
  name: 'Syndication — Passive LP',
  category: 'Paper',
  tier: 'core',
  blurb: 'Passive LP stake in a sponsor-led deal: distributions + a share of exit profit.',
  params: [
    { key: 'investmentAmount', label: 'LP investment', type: 'currency', unit: '$', default: 100_000, min: 0, step: 5000, group: 'Position', help: 'Your committed capital as a limited partner.' },
    { key: 'holdYears', label: 'Hold period', type: 'integer', unit: 'yr', default: 5, min: 1, max: 15, step: 1, group: 'Position', help: 'Projected years to the sponsor’s exit.' },
    { key: 'cashDistributionPct', label: 'Cash distribution', type: 'percent', unit: '%', default: 0.05, min: 0, max: 0.2, step: 0.005, group: 'Returns', verify: true, help: 'Annual cash-on-cash distribution to LPs. Verify against the offering’s projected distributions.' },
    { key: 'preferredReturnPct', label: 'Preferred return', type: 'percent', unit: '%', default: 0.08, min: 0, max: 0.2, step: 0.005, group: 'Returns', verify: true, help: 'LP hurdle before the GP shares in profit. Verify against the operating agreement.' },
    { key: 'projectedExitProfitPct', label: 'Projected exit profit', type: 'percent', unit: '%', default: 0.55, min: -0.5, max: 3, step: 0.05, group: 'Returns', verify: true, help: 'Total profit on capital at exit, net to the LP. Sponsor assumption — verify the underwriting.' },
    { key: 'lpProfitSplit', label: 'LP profit split', type: 'percent', unit: '%', default: 0.70, min: 0, max: 1, step: 0.05, group: 'Returns', help: 'LP share of profit above the preferred return (the rest is GP promote).' },
  ],
  metrics: [
    { key: 'equityMultiple', label: 'Equity multiple', unit: 'x', higherIsBetter: true, help: 'Total cash returned (distributions + exit) ÷ capital invested.' },
    { key: 'preferredReturn', label: 'Preferred return', unit: '%', higherIsBetter: true, help: 'LP hurdle rate that must be met before the GP earns its promote.' },
    { key: 'profitAtExit', label: 'Profit at exit', unit: '$', higherIsBetter: true, help: 'Projected profit on capital realized at the sponsor’s exit.' },
  ],
  compute,
  narrative: {
    strategy:
      'Commit capital as a passive limited partner in a sponsor-led real-estate deal, collecting periodic distributions and a share of the profit at exit above a preferred return. You get **institutional-scale exposure with zero operational work**, but every dollar of the outcome depends on the general partner’s execution and the realism of their underwriting.',
    risks: [
      'Fully GP-dependent: a weak or dishonest sponsor can impair the deal regardless of the asset.',
      'Illiquid and long-dated, often with capital calls that require reserves beyond the initial check.',
      'Fees and the GP promote drag on net returns, especially if the deal underperforms.',
      'Projections are the sponsor’s assumptions, not outcomes — exit profit can be far below plan or negative.',
    ],
    opportunities: [
      'The preferred return puts LP capital ahead of the GP’s profit share, aligning incentives toward performance.',
      'Access to larger, professionally-operated assets than an individual could buy directly.',
      'Genuinely passive — no management, tenants, or financing to handle.',
    ],
    regulatory:
      'Most syndications are private placements under Regulation D and typically require accredited-investor status. Read the PPM, operating agreement, and the full fee-and-promote waterfall before committing.',
  },
};
