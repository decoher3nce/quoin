import type { InvestmentModule, ComputeResult } from '../core/types';
import { computeIncomeStream } from './_shapes';

// Private / hard-money lending. You fund a short-term loan against real-property
// collateral, earning contractual interest plus upfront points. The borrower's
// promise is not the asset — the COLLATERAL and the LTV are. A default-loss
// haircut (probability × loss-given-default) is applied to show the honest,
// risk-adjusted yield next to the headline contractual yield.

function compute(i: Record<string, number>): ComputeResult {
  const loanAmount = i.loanAmount ?? 0;
  const noteRate = i.noteRate ?? 0;
  const pointsPct = i.pointsPct ?? 0;
  const termMonths = Math.max(1, Math.round(i.termMonths ?? 12));
  const ltv = i.ltv ?? 0;
  const defaultProbability = i.defaultProbability ?? 0;
  const lossGivenDefaultPct = i.lossGivenDefaultPct ?? 0;

  const annualInterest = loanAmount * noteRate;
  const capital = loanAmount; // you fund the full note; points are income, basis stays clear
  const pointsIncome = loanAmount * pointsPct;

  const years = Math.max(1, Math.ceil(termMonths / 12));
  const annualCashflows = Array.from({ length: years }, (_, idx) =>
    idx === 0 ? annualInterest + pointsIncome : annualInterest,
  );
  const terminalValue = loanAmount; // interest-only: principal returned at maturity

  const core = computeIncomeStream({
    capital,
    assetPrice: loanAmount,
    annualCashflows,
    terminalValue,
    debtServiceAnnual: 0,
    noiAnnual: annualInterest,
  });

  // Points annualize by how much of a year the term actually runs.
  const pointsAnnualized = pointsPct * (12 / termMonths);
  const contractualYield = noteRate + pointsAnnualized;
  const lossAdjustedYield =
    noteRate * (1 - defaultProbability * lossGivenDefaultPct) + pointsAnnualized;

  const warnings: string[] = [];
  if (ltv > 0.75)
    warnings.push(
      `LTV ${(ltv * 100).toFixed(0)}% leaves a thin equity cushion — a soft comp or a slow workout can wipe it out.`,
    );

  return {
    metrics: {
      ...core,
      contractualYield,
      lossAdjustedYield,
      ltv,
    },
    warnings,
  };
}

export const privateLending: InvestmentModule = {
  id: 'private-lending',
  name: 'Private / Hard-Money Lending',
  category: 'Paper',
  tier: 'core',
  blurb: 'Fund a short-term loan against real-property collateral: interest + points.',
  params: [
    { key: 'loanAmount', label: 'Loan amount funded', type: 'currency', unit: '$', default: 250_000, min: 0, step: 5000, group: 'Loan', verify: true, help: 'Principal you advance to the borrower.' },
    { key: 'noteRate', label: 'Note rate', type: 'percent', unit: '%', default: 0.11, min: 0, max: 0.3, step: 0.005, group: 'Loan', verify: true, help: 'Contractual annual interest. Verify against current private-lending rate sheets and state usury caps.' },
    { key: 'pointsPct', label: 'Origination points', type: 'percent', unit: '%', default: 0.02, min: 0, max: 0.1, step: 0.005, group: 'Loan', help: 'Upfront fee income, as a fraction of the loan.' },
    { key: 'termMonths', label: 'Term', type: 'integer', unit: 'count', default: 12, min: 1, max: 60, step: 1, group: 'Loan', help: 'Months to maturity. Hard-money notes are short.' },
    { key: 'interestOnly', label: 'Interest-only', type: 'integer', unit: 'count', default: 1, min: 0, max: 1, step: 1, group: 'Loan', help: '1 = interest-only with principal returned at maturity.' },

    { key: 'ltv', label: 'Loan-to-value', type: 'percent', unit: '%', default: 0.65, min: 0, max: 1, step: 0.01, group: 'Collateral', verify: true, help: 'Loan ÷ collateral value. The real protection. Verify against an independent valuation, not the borrower’s number.' },
    { key: 'defaultProbability', label: 'Default probability', type: 'percent', unit: '%', default: 0.05, min: 0, max: 1, step: 0.01, group: 'Risk', verify: true, help: 'Probability the borrower defaults over the term. Verify against your own book or a lender’s loss history.' },
    { key: 'lossGivenDefaultPct', label: 'Loss given default', type: 'percent', unit: '%', default: 0.25, min: 0, max: 1, step: 0.01, group: 'Risk', verify: true, help: 'Fraction of principal lost after foreclosure and resale, if a default happens.' },
  ],
  metrics: [
    { key: 'contractualYield', label: 'Contractual yield', unit: '%', higherIsBetter: true, help: 'Note rate plus term-annualized points, assuming full performance.' },
    { key: 'lossAdjustedYield', label: 'Loss-adjusted yield', unit: '%', higherIsBetter: true, help: 'Contractual yield haircut by default probability × loss-given-default. The honest number.' },
    { key: 'ltv', label: 'Loan-to-value', unit: '%', higherIsBetter: false, help: 'Loan ÷ collateral value. Lower is safer.' },
  ],
  compute,
  narrative: {
    strategy:
      'Lend against real property at a conservative loan-to-value, earning double-digit interest plus upfront points over a short term. The thesis is **collateral, not credit**: you underwrite the property and the equity cushion so that even a default returns your principal through foreclosure. The borrower’s promise is worth little; the LTV is worth everything.',
    risks: [
      'Default plus a weak collateral value is the real loss scenario — foreclosure is slow and costly, and a soft resale market erodes the cushion you underwrote to.',
      'Illiquidity: your capital is locked for the full term with no secondary market to exit into.',
      'Workout and foreclosure carry legal cost and months of lost time even when you ultimately recover.',
      'Concentration in a single note and a single property means no diversification against a local downturn.',
    ],
    opportunities: [
      'Points plus a high note rate produce strong current yield on a short duration.',
      'A low LTV converts most defaults into a recovery rather than a loss.',
      'Short terms let you re-underwrite and reprice quickly as rates move.',
    ],
    regulatory:
      'Private lending is heavily state-specific: many states require a lending or broker license, and usury statutes cap the enforceable rate. Confirm licensing, maximum rate, and foreclosure procedure in the property’s state before funding.',
  },
};
