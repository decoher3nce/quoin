import type { InvestmentModule, ComputeResult } from '../core/types';
import { computeIncomeStream } from './_shapes';

// REIT shares. Liquid, diversified, passive real-estate exposure. Return is a
// dividend yield (net of an expense-ratio drag) that grows modestly, plus share
// price appreciation. No leverage or control at the investor level.

function compute(i: Record<string, number>): ComputeResult {
  const investmentAmount = i.investmentAmount ?? 0;
  const dividendYield = i.dividendYield ?? 0;
  const dividendGrowthPct = i.dividendGrowthPct ?? 0;
  const priceAppreciationPct = i.priceAppreciationPct ?? 0;
  const expenseRatioAnnual = i.expenseRatioAnnual ?? 0;
  const holdYears = Math.max(1, Math.round(i.holdYears ?? 5));
  const navPremiumDiscount = i.navPremiumDiscount ?? 0;

  const capital = investmentAmount;

  const annualCashflows = Array.from(
    { length: holdYears },
    (_, idx) =>
      investmentAmount * (dividendYield - expenseRatioAnnual) * Math.pow(1 + dividendGrowthPct, idx),
  );
  const terminalValue = investmentAmount * Math.pow(1 + priceAppreciationPct, 5);

  const core = computeIncomeStream({
    capital,
    assetPrice: investmentAmount,
    annualCashflows,
    terminalValue,
    debtServiceAnnual: 0,
    noiAnnual: investmentAmount * dividendYield,
  });

  const totalReturnEstimate = dividendYield + priceAppreciationPct - expenseRatioAnnual;

  return {
    metrics: {
      ...core,
      dividendYield,
      totalReturnEstimate,
      navPremiumDiscount,
    },
  };
}

export const reit: InvestmentModule = {
  id: 'reit',
  name: 'REIT Shares',
  category: 'Paper',
  tier: 'core',
  blurb: 'Liquid, diversified real-estate shares: dividend yield + price appreciation.',
  params: [
    { key: 'investmentAmount', label: 'Investment amount', type: 'currency', unit: '$', default: 50_000, min: 0, step: 1000, group: 'Position' },
    { key: 'dividendYield', label: 'Dividend yield', type: 'percent', unit: '%', default: 0.045, min: 0, max: 0.15, step: 0.005, group: 'Income', verify: true, help: 'Current distribution yield. Verify against the REIT’s latest declared dividend.' },
    { key: 'dividendGrowthPct', label: 'Dividend growth', type: 'percent', unit: '%', default: 0.03, min: -0.05, max: 0.15, step: 0.005, group: 'Income', help: 'Assumed annual growth in the distribution.' },
    { key: 'expenseRatioAnnual', label: 'Expense ratio', type: 'percent', unit: '%', default: 0.005, min: 0, max: 0.03, step: 0.001, group: 'Income', help: 'Annual fee drag (fund/management expense).' },

    { key: 'priceAppreciationPct', label: 'Price appreciation', type: 'percent', unit: '%', default: 0.03, min: -0.1, max: 0.15, step: 0.005, group: 'Exit', help: 'Assumed annual share-price appreciation.' },
    { key: 'holdYears', label: 'Hold period', type: 'integer', unit: 'yr', default: 5, min: 1, max: 30, step: 1, group: 'Exit' },
    { key: 'navPremiumDiscount', label: 'NAV premium / discount', type: 'percent', unit: '%', default: 0.0, min: -0.5, max: 0.5, step: 0.01, group: 'Valuation', help: 'Share price vs. net asset value; positive = premium, negative = discount.' },
  ],
  metrics: [
    { key: 'dividendYield', label: 'Dividend yield', unit: '%', higherIsBetter: true, help: 'Current distribution as a fraction of the investment.' },
    { key: 'totalReturnEstimate', label: 'Total return estimate', unit: '%', higherIsBetter: true, help: 'Dividend yield + price appreciation − expense ratio.' },
    { key: 'navPremiumDiscount', label: 'NAV premium / discount', unit: '%', higherIsBetter: null, help: 'Price relative to net asset value. A discount can be opportunity or a warning.' },
  ],
  compute,
  narrative: {
    strategy:
      'Buy shares in a REIT for **liquid, diversified, fully passive** real-estate exposure. Return comes from a dividend (REITs must distribute most taxable income) plus share-price appreciation, less a small expense drag. You trade away control and leverage for daily liquidity and instant diversification across many properties and a professional operator.',
    risks: [
      'Publicly-traded REITs are rate-sensitive and correlate with equities — they can sell off even when the underlying properties are fine.',
      'You have no control over the portfolio, financing, or timing of dispositions.',
      'Sector or geographic concentration in a specialized REIT reintroduces the single-market risk you bought diversification to avoid.',
      'Expense and management fees compound as a persistent drag on net return.',
    ],
    opportunities: [
      'Daily liquidity lets you enter and exit without a transaction cycle.',
      'Instant diversification across many assets and a professional management team.',
      'A discount to NAV can offer a margin of safety on entry.',
    ],
    regulatory:
      'Non-traded and private REITs are a different animal: high upfront load, limited liquidity, and gated redemptions. Read the fee table and redemption terms carefully before treating a non-traded REIT as equivalent to a public one.',
  },
};
