import type { InvestmentModule, ComputeResult } from '../core/types';
import { computeIncomeStream } from './_shapes';

// Tax lien / tax deed investing. You pay a property’s delinquent taxes and take
// a super-priority lien. Usually the owner redeems and you collect a statutory
// interest rate — a small, predictable yield. Rarely they do not, and you can
// acquire the deed for cents on the dollar of property value: a rare, large
// upside. The expected terminal value blends both outcomes.

function compute(i: Record<string, number>): ComputeResult {
  const lienAmount = i.lienAmount ?? 0;
  const statutoryInterestRate = i.statutoryInterestRate ?? 0;
  const redemptionPeriodMonths = Math.max(1, Math.round(i.redemptionPeriodMonths ?? 24));
  const redemptionProbability = i.redemptionProbability ?? 0;
  const collateralPropertyValue = i.collateralPropertyValue ?? 0;
  const deedAcquisitionCost = i.deedAcquisitionCost ?? 0;

  const redeemedPayoff = lienAmount * (1 + statutoryInterestRate * (redemptionPeriodMonths / 12));
  const deedNetValue = collateralPropertyValue - lienAmount - deedAcquisitionCost;
  const expectedTerminal =
    redemptionProbability * redeemedPayoff +
    (1 - redemptionProbability) * (lienAmount + deedNetValue);

  const capital = lienAmount;
  const years = Math.max(1, Math.ceil(redemptionPeriodMonths / 12));
  const annualCashflows = Array.from({ length: years }, () => 0); // no interim cash; payout at redemption/deed

  const core = computeIncomeStream({
    capital,
    assetPrice: lienAmount,
    annualCashflows,
    terminalValue: expectedTerminal,
    debtServiceAnnual: 0,
    noiAnnual: lienAmount * statutoryInterestRate,
  });

  const deedUpsideMultiple = lienAmount > 0 ? collateralPropertyValue / lienAmount : NaN;

  const warnings: string[] = [
    'Capital is tied up with no interim cash flow until the lien redeems or the deed is acquired.',
  ];

  return {
    metrics: {
      ...core,
      statutoryYield: statutoryInterestRate,
      redemptionProbability,
      deedUpsideMultiple,
    },
    warnings,
  };
}

export const taxLienDeed: InvestmentModule = {
  id: 'tax-lien-deed',
  name: 'Tax Lien / Tax Deed',
  category: 'Paper',
  tier: 'creative',
  blurb: 'Buy a delinquent-tax lien: statutory interest on redemption, or the deed.',
  params: [
    { key: 'lienAmount', label: 'Lien amount', type: 'currency', unit: '$', default: 8_000, min: 0, step: 250, group: 'Lien', help: 'Delinquent taxes you advance to take the lien.' },
    { key: 'statutoryInterestRate', label: 'Statutory interest rate', type: 'percent', unit: '%', default: 0.16, min: 0, max: 0.36, step: 0.01, group: 'Lien', verify: true, help: 'State-set redemption interest rate (or bid-down award). Verify the exact statute for the county.' },
    { key: 'redemptionPeriodMonths', label: 'Redemption period', type: 'integer', unit: 'count', default: 24, min: 1, max: 60, step: 1, group: 'Lien', help: 'Months the owner has to redeem before you can pursue the deed.' },
    { key: 'redemptionProbability', label: 'Redemption probability', type: 'percent', unit: '%', default: 0.95, min: 0, max: 1, step: 0.01, group: 'Outcome', verify: true, help: 'Probability the owner redeems. Most liens redeem; verify against county redemption history.' },

    { key: 'collateralPropertyValue', label: 'Property value', type: 'currency', unit: '$', default: 140_000, min: 0, step: 5000, group: 'Collateral', verify: true, help: 'Market value of the property behind the lien. Do independent due diligence — some parcels are worthless.' },
    { key: 'deedAcquisitionCost', label: 'Deed acquisition cost', type: 'currency', unit: '$', default: 3_500, min: 0, step: 250, group: 'Collateral', help: 'Foreclosure, quiet-title, and clearing costs if you take the deed.' },
  ],
  metrics: [
    { key: 'statutoryYield', label: 'Statutory yield', unit: '%', higherIsBetter: true, help: 'The state-set interest rate earned if the lien redeems.' },
    { key: 'redemptionProbability', label: 'Redemption probability', unit: '%', higherIsBetter: null, help: 'Likelihood of the small predictable outcome vs. the rare deed acquisition.' },
    { key: 'deedUpsideMultiple', label: 'Deed upside multiple', unit: 'x', higherIsBetter: true, help: 'Property value ÷ lien amount — the payoff if the lien is not redeemed and you take the deed.' },
  ],
  compute,
  narrative: {
    strategy:
      'Pay a property’s delinquent taxes to hold a super-priority lien. The common case is a **small, statutory yield** when the owner redeems; the rare case is **acquiring the property for a fraction of its value** when they do not. The expected value blends the two, but the deed upside only exists if you did real due diligence on a property actually worth taking.',
    risks: [
      'Capital is locked through the full redemption period with no interim income.',
      'The deed upside is worthless on a condemned, encumbered, or environmentally impaired parcel — property due diligence is everything.',
      'Foreclosing to perfect the deed adds legal cost, quiet-title work, and time.',
      'Competitive bid-downs at auction can compress the statutory yield well below the headline rate.',
    ],
    opportunities: [
      'Redemptions produce a predictable, statutorily-fixed return uncorrelated with markets.',
      'The occasional non-redemption delivers a property at a large discount to value.',
      'Super-priority status places the lien ahead of most other claims on the property.',
    ],
    regulatory:
      'Tax lien and tax deed rules are intensely state- and county-specific — interest rates, redemption periods, bid mechanics, and notice requirements all differ. Confirm the exact statute and procedure for the jurisdiction before bidding.',
  },
};
