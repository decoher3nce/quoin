import type { InvestmentModule, ComputeResult } from '../core/types';
import { guardDiv } from '../core/finance';
import type { CoreMetrics } from './_shapes';

// Conservation Easement. A TAX-DRIVEN land strategy, not a cash-return
// investment. The owner donates the development rights on a parcel to a qualified
// conservation organization in perpetuity, keeping the (now reduced-value) land
// and continuing limited use (e.g. agriculture). The value proposition is the
// charitable deduction on the appraised value of the rights given up — NOT rental
// yield or appreciation. This module frames the estimated tax benefit honestly and
// makes no representation of investment or tax advice.

function compute(i: Record<string, number>): ComputeResult {
  const landBasis = i.landBasis ?? 0;
  const appraisedValueBefore = i.appraisedValueBefore ?? 0;
  const appraisedValueAfterEasement = i.appraisedValueAfterEasement ?? 0;
  const marginalTaxRate = i.marginalTaxRate ?? 0;
  const retainedAgIncomeAnnual = i.retainedAgIncomeAnnual ?? 0;

  const donationValue = appraisedValueBefore - appraisedValueAfterEasement;
  const estimatedTaxBenefit = donationValue * marginalTaxRate;
  const benefitVsBasis = guardDiv(estimatedTaxBenefit, landBasis);

  // No standard cash-flow shape: the return is a one-time tax benefit plus modest
  // retained land use, not an operating yield. The operating-hold metrics are NaN
  // and render "—"; faking a cap rate or IRR here would misrepresent the strategy.
  const core: CoreMetrics = {
    annualCashFlow: retainedAgIncomeAnnual,
    monthlyCashFlow: retainedAgIncomeAnnual / 12,
    cashOnCash: NaN,
    capRate: NaN,
    dscr: NaN,
    irr5yr: NaN,
    totalCashInvested: landBasis,
  };

  const warnings: string[] = [
    'Conservation-easement deductions are heavily scrutinized (syndicated versions are an IRS "listed transaction"). This is not tax advice.',
    'The estimated tax benefit is a one-time deduction, not a cash return, and depends entirely on a defensible qualified appraisal — the operating metrics are not applicable and render "—".',
  ];
  if (appraisedValueAfterEasement > appraisedValueBefore)
    warnings.push('After-easement appraised value exceeds the before value — check the appraisal inputs; there is no donation value.');

  return {
    metrics: {
      ...core,
      donationValue,
      estimatedTaxBenefit,
      benefitVsBasis,
    },
    warnings,
  };
}

export const conservationEasement: InvestmentModule = {
  id: 'conservation-easement',
  name: 'Conservation Easement',
  category: 'Land',
  tier: 'creative',
  blurb: 'Tax-driven: donate development rights, keep the reduced-value land.',
  params: [
    { key: 'landBasis', label: 'Land cost basis', type: 'currency', unit: '$', default: 200_000, min: 0, step: 5000, group: 'Acquisition', help: 'Your tax basis in the land. Drives the benefit-vs-basis comparison, not the deduction itself.' },
    { key: 'retainedAgIncomeAnnual', label: 'Retained ag income', type: 'currency', unit: '$/yr', default: 3_000, min: 0, step: 250, group: 'Income', help: 'Modest continuing income from permitted use (e.g. grazing or hay lease) after the easement.' },

    { key: 'appraisedValueBefore', label: 'Appraised value (before)', type: 'currency', unit: '$', default: 500_000, min: 0, step: 5000, group: 'Appraisal', verify: true, help: 'Fair market value of the land at its highest-and-best use before the easement. Requires a qualified appraisal.' },
    { key: 'appraisedValueAfterEasement', label: 'Appraised value (after)', type: 'currency', unit: '$', default: 180_000, min: 0, step: 5000, group: 'Appraisal', verify: true, help: 'Fair market value after development rights are extinguished. The before-minus-after difference is the donation value.' },
    { key: 'marginalTaxRate', label: 'Marginal tax rate', type: 'percent', unit: '%', default: 0.37, min: 0, max: 0.6, step: 0.01, group: 'Appraisal', verify: true, help: 'Your marginal rate applied to the deduction. Deduction limits, carryforwards, and AMT are NOT modeled — consult a tax professional.' },

    { key: 'holdYears', label: 'Hold period', type: 'integer', unit: 'yr', default: 5, min: 1, max: 30, step: 1, group: 'Exit', help: 'The easement itself is perpetual; this is the modeled ownership horizon for the retained land.' },
  ],
  metrics: [
    { key: 'donationValue', label: 'Donation value', unit: '$', higherIsBetter: true, help: 'Appraised value before minus after — the value of the development rights donated.' },
    { key: 'estimatedTaxBenefit', label: 'Estimated tax benefit', unit: '$', higherIsBetter: true, help: 'Donation value × marginal tax rate. A rough estimate before deduction limits, carryforwards, and AMT — not tax advice.' },
    { key: 'benefitVsBasis', label: 'Benefit vs. basis', unit: '%', higherIsBetter: true, help: 'Estimated tax benefit / land cost basis.' },
  ],
  compute,
  narrative: {
    strategy:
      'Donate the **development rights** on a parcel to a qualified conservation organization in perpetuity, keeping the land and its permitted uses. The value here is a one-time **charitable deduction** equal to the appraised drop in value (before minus after the easement) times your marginal tax rate — not rent, yield, or appreciation. It suits an owner who wants to conserve land they intend to keep and can use the deduction; it is **not** a cash-return investment, and the numbers above are estimates, **not tax advice**.',
    risks: [
      'Heavy IRS scrutiny: overvalued and especially syndicated easements are a listed transaction and a frequent audit and litigation target.',
      'Appraisal risk: the entire benefit rests on a defensible before-and-after qualified appraisal; an inflated valuation can be disallowed with penalties.',
      'Permanence: the easement runs with the land forever, constraining future use, sale price, and heirs.',
      'Deduction usability: AGI limits, carryforwards, and AMT can defer or reduce the benefit below the headline estimate.',
    ],
    opportunities: [
      'Meaningful one-time deduction for owners who intend to keep the land regardless.',
      'Conservation goals are met while retaining ownership and limited permitted use (agriculture, recreation).',
      'Potential estate-planning benefits by lowering the taxable value of retained land (verify with counsel).',
    ],
    regulatory:
      'A valid deduction requires a qualified appraisal by a qualified appraiser and donation to a qualified conservation organization, with the easement granted in perpetuity and properly recorded. Syndicated conservation easements are an IRS listed transaction subject to disclosure and penalties. This is not tax or legal advice — consult a qualified tax professional and attorney before proceeding.',
    dataHooks: ['ndvi-cropland'],
  },
};
