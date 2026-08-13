import type { InvestmentModule, ComputeResult } from '../core/types';
import { computeIncomeStream } from './_shapes';

// Large Multifamily — Passive LP. A limited-partner interest in a syndicated
// apartment deal: you wire capital, receive an annual cash distribution, and
// collect a share of the profit when the sponsor sells. Truly passive, but every
// number here is a sponsor projection, not a contract. Modeled as an income
// stream: distributions plus a terminal return of capital and profit.

function compute(i: Record<string, number>): ComputeResult {
  const capital = i.investmentAmount ?? 0;
  const holdYears = Math.max(Math.round(i.holdYears ?? 5), 1);
  const cashDistPct = i.cashDistributionPct ?? 0;
  const prefPct = i.preferredReturnPct ?? 0;
  const exitProfitPct = i.projectedExitProfitPct ?? 0;

  const annualDist = capital * cashDistPct;
  const annualCashflows = Array.from({ length: holdYears }, () => annualDist);
  const profitAtExit = capital * exitProfitPct;
  const terminalValue = capital + profitAtExit; // return of capital + LP profit share at sale

  const core = computeIncomeStream({
    capital,
    assetPrice: capital,
    annualCashflows,
    terminalValue,
    debtServiceAnnual: 0,
    noiAnnual: annualDist,
  });

  const equityMultiple =
    capital > 0 ? (annualDist * holdYears + capital * (1 + exitProfitPct)) / capital : NaN;

  const warnings: string[] = [
    'These are sponsor projections, not guarantees. Distributions can be paused and exit profit can evaporate.',
  ];
  if (cashDistPct < prefPct)
    warnings.push('Cash distributions below the preferred return — the shortfall accrues and is paid at exit (if the deal performs).');

  return {
    metrics: {
      ...core,
      equityMultiple,
      preferredReturn: prefPct,
      profitAtExit,
    },
    warnings,
  };
}

export const largeMultifamilyLp: InvestmentModule = {
  id: 'large-multifamily-lp',
  name: 'Large Multifamily — Passive LP',
  category: 'Residential',
  tier: 'creative',
  blurb: 'Limited-partner stake in a syndicated apartment deal. Passive, illiquid, sponsor-dependent.',
  params: [
    { key: 'investmentAmount', label: 'Investment amount', type: 'currency', unit: '$', default: 100_000, min: 0, step: 5000, group: 'Financing', help: 'Capital committed as an LP. Most syndications set a minimum around $50k–$100k.' },
    { key: 'holdYears', label: 'Projected hold', type: 'integer', unit: 'yr', default: 5, min: 1, max: 15, step: 1, group: 'Exit', help: 'Sponsor\'s projected hold before sale or recapitalization.' },
    { key: 'cashDistributionPct', label: 'Cash distribution', type: 'percent', unit: '%', default: 0.05, min: 0, max: 0.2, step: 0.005, group: 'Income', verify: true, help: 'Projected annual cash yield on invested capital. Verify against the sponsor\'s pro-forma and track record.' },
    { key: 'preferredReturnPct', label: 'Preferred return', type: 'percent', unit: '%', default: 0.08, min: 0, max: 0.2, step: 0.005, group: 'Income', verify: true, help: 'The return LPs receive before the GP shares in profit. Accrues if unpaid.' },
    { key: 'projectedExitProfitPct', label: 'Exit profit', type: 'percent', unit: '%', default: 0.55, min: -0.5, max: 2, step: 0.05, group: 'Exit', verify: true, help: 'LP profit at sale as a fraction of invested capital, net of the GP split. A projection.' },
    { key: 'lpProfitSplit', label: 'LP profit split', type: 'percent', unit: '%', default: 0.7, min: 0, max: 1, step: 0.05, group: 'Exit', help: 'LP share of profit above the preferred return (context — exit profit is already net of the split).' },
  ],
  metrics: [
    { key: 'equityMultiple', label: 'Equity multiple', unit: 'x', higherIsBetter: true, help: 'Total distributions plus return of capital and profit, divided by capital invested.' },
    { key: 'preferredReturn', label: 'Preferred return', unit: '%', higherIsBetter: true, help: 'The hurdle LPs are paid before the GP shares in profit.' },
    { key: 'profitAtExit', label: 'Profit at exit', unit: '$', higherIsBetter: true, help: 'Projected LP profit at sale, net of the GP split.' },
  ],
  compute,
  narrative: {
    strategy:
      'Invest as a **limited partner** in a professionally operated apartment deal: the sponsor (GP) sources, finances, and runs the property; you supply capital and receive an annual **cash distribution** plus a share of the **profit at sale**. It is genuinely passive — no tenants, no toilets — but it is entirely **GP-dependent** and **illiquid**: your capital is locked for the hold, you cannot force a sale, and the returns shown are the sponsor\'s projections. The **preferred return** and **profit split** are the alignment mechanism; understand them before wiring.',
    risks: [
      'Sponsor risk: an inexperienced or over-leveraged GP can impair the deal regardless of the projections.',
      'Illiquidity and capital calls: your money is locked for years and the GP can request more.',
      'Fee drag: acquisition, asset-management, and disposition fees quietly reduce LP returns.',
      'Projections are not guarantees — distributions can be paused and exit profit can go to zero.',
    ],
    opportunities: [
      'Truly passive exposure to institutional-scale multifamily you could not buy alone.',
      'The preferred return puts LP capital ahead of the GP\'s profit share.',
      'Access to professional operations, financing, and economies of scale on large assets.',
    ],
    regulatory:
      'Most syndications rely on a securities exemption (typically Reg D 506(b)/(c)) and require accredited-investor status. Read the PPM, operating agreement, and fee schedule, and verify the sponsor\'s track record before investing.',
    dataHooks: ['viirs-radiance'],
  },
};
