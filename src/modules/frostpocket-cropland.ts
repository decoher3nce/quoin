import type { InvestmentModule, ComputeResult } from '../core/types';
import { guardDiv, dscr } from '../core/finance';
import { computeHold } from './_shapes';

// Frost-Pocket Cropland. Buy a frost-PROTECTED microclimate parcel — a site where
// cold air drains AWAY downslope rather than pooling — and establish a perennial
// crop that needs frost protection (orchard, vineyard, some berries). The edge is
// a thermal / cold-air-drainage read that identifies frost-safe ground the market
// prices as ordinary cropland. Income lags for years while the planting matures:
// a J-curve of establishment cost and opex before any revenue. Modeled as a
// financed income hold over a long (maturity-covering) horizon with DELAYED
// revenue that switches on at maturity.

function compute(i: Record<string, number>): ComputeResult {
  const landCost = i.landCost ?? 0;
  const acres = i.acres ?? 1;
  const establishmentCostPerAcre = i.establishmentCostPerAcre ?? 0;
  const yearsToMaturity = Math.round(i.yearsToMaturity ?? 4);
  const matureAnnualRevenuePerAcre = i.matureAnnualRevenuePerAcre ?? 0;
  const opexPerAcreAnnual = i.opexPerAcreAnnual ?? 0;

  const financedPct = i.financedPct ?? 0;
  const interestRate = i.interestRate ?? 0;
  const loanTermYears = i.loanTermYears ?? 20;
  const appreciationPct = i.appreciationPct ?? 0;
  const holdYears = Math.round(i.holdYears ?? 8);
  const sellingCostPct = i.sellingCostPct ?? 0;

  const price = landCost + establishmentCostPerAcre * acres;
  const loanAmount = price * financedPct;
  const totalCashInvested = price * (1 - financedPct);

  // Revenue switches on only once the planting matures; opex runs from year 1.
  const grossRevenue = (year: number) =>
    year < yearsToMaturity ? 0 : matureAnnualRevenuePerAcre * acres;
  const effectiveRevenue = grossRevenue;
  const operatingExpenses = () => opexPerAcreAnnual * acres;

  const outcome = computeHold({
    price,
    loanAmount,
    annualRate: interestRate,
    termYears: loanTermYears,
    appreciation: appreciationPct,
    grossRevenue,
    effectiveRevenue,
    operatingExpenses,
    totalCashInvested,
    sellingPct: sellingCostPct,
    holdYears,
  });

  // Unlevered net yield on all-in cost once the planting is mature.
  const yieldOnCostAtMaturity = guardDiv((matureAnnualRevenuePerAcre - opexPerAcreAnnual) * acres, price);
  const yearsToPositiveCashFlow = yearsToMaturity;
  const revenuePerAcreMature = matureAnnualRevenuePerAcre;

  const warnings: string[] = [
    `J-curve: no crop revenue until year ${yearsToMaturity}, while establishment cost, opex, and debt service run from day one. The standardized 5-year IRR captures this drag honestly.`,
    'The frost-safety thesis is the whole edge — a single hard frost during bloom can wipe a year of a perennial crop. Verify the cold-air-drainage read on the ground.',
  ];
  const dscrVal = dscr(outcome.noi, outcome.debtService);
  if (Number.isFinite(dscrVal) && dscrVal < 1.2)
    warnings.push(`DSCR ${dscrVal.toFixed(2)}× is below 1.20 — during establishment there is no NOI to cover debt service.`);
  if (outcome.core.annualCashFlow < 0)
    warnings.push('Year-1 pre-tax cash flow is negative by design during the establishment years.');

  return {
    metrics: {
      ...outcome.core,
      yieldOnCostAtMaturity,
      yearsToPositiveCashFlow,
      revenuePerAcreMature,
    },
    projection: outcome.projection,
    warnings,
  };
}

export const frostpocketCropland: InvestmentModule = {
  id: 'frostpocket-cropland',
  name: 'Frost-Pocket Cropland — Microclimate Perennials',
  category: 'Novel',
  tier: 'novel',
  blurb: 'Buy frost-safe microclimate cropland for perennials; income lags maturity.',
  params: [
    { key: 'landCost', label: 'Land cost', type: 'currency', unit: '$', default: 180_000, min: 0, step: 5000, group: 'Acquisition', verify: true, help: 'Bare-ground cost. Verify against comps AND against the cold-air-drainage read that makes this parcel frost-safe.' },
    { key: 'acres', label: 'Acres', type: 'number', unit: 'count', default: 20, min: 1, step: 1, group: 'Acquisition' },
    { key: 'establishmentCostPerAcre', label: 'Establishment cost / acre', type: 'currency', unit: '$', default: 9_000, min: 0, step: 250, group: 'Acquisition', verify: true, help: 'Planting, trellis/irrigation, and early care to get a perennial to maturity. Verify with a farm advisor for the specific crop.' },

    { key: 'yearsToMaturity', label: 'Years to maturity', type: 'integer', unit: 'yr', default: 4, min: 1, max: 12, step: 1, group: 'Income', verify: true, help: 'Years before the planting produces sellable yield. Revenue is zero until then.' },
    { key: 'matureAnnualRevenuePerAcre', label: 'Mature revenue / acre', type: 'currency', unit: '$/yr', default: 6_000, min: 0, step: 250, group: 'Income', verify: true, help: 'Gross revenue per acre once mature. Verify against realistic yields and prices, not a peak year.' },
    { key: 'opexPerAcreAnnual', label: 'Operating cost / acre', type: 'currency', unit: '$/yr', default: 2_200, min: 0, step: 100, group: 'Income', help: 'Annual growing cost per acre — labor, inputs, water, harvest. Runs from year 1, including establishment years.' },

    { key: 'financedPct', label: 'Financed portion', type: 'percent', unit: '%', default: 0.5, min: 0, max: 0.9, step: 0.05, group: 'Financing', help: 'Perennial establishment is hard to finance — lenders discount pre-maturity plantings.' },
    { key: 'interestRate', label: 'Farm loan rate', type: 'percent', unit: '%', default: 0.075, min: 0, max: 0.2, step: 0.001, group: 'Financing', verify: true },
    { key: 'loanTermYears', label: 'Loan term', type: 'integer', unit: 'yr', default: 20, min: 1, max: 30, step: 1, group: 'Financing' },

    { key: 'appreciationPct', label: 'Land appreciation', type: 'percent', unit: '%', default: 0.03, min: -0.1, max: 0.15, step: 0.005, group: 'Exit', verify: true, help: 'A mature, proven-frost-safe planting can be worth more than bare ground — but verify buyers pay for it.' },
    { key: 'holdYears', label: 'Hold period', type: 'integer', unit: 'yr', default: 8, min: 1, max: 40, step: 1, group: 'Exit', help: 'Long enough to cross maturity and show stabilized income.' },
    { key: 'sellingCostPct', label: 'Selling costs', type: 'percent', unit: '%', default: 0.06, min: 0, max: 0.12, step: 0.005, group: 'Exit' },
  ],
  metrics: [
    { key: 'yieldOnCostAtMaturity', label: 'Yield on cost (mature)', unit: '%', higherIsBetter: true, help: 'Mature net income (revenue − opex) × acres / all-in cost. The steady-state yield after the J-curve.' },
    { key: 'yearsToPositiveCashFlow', label: 'Years to first revenue', unit: 'yr', higherIsBetter: false, help: 'Years of establishment before the planting produces any revenue.' },
    { key: 'revenuePerAcreMature', label: 'Mature revenue / acre', unit: '$/yr', higherIsBetter: true, help: 'Gross revenue per acre once the planting is mature.' },
  ],
  compute,
  narrative: {
    strategy:
      'Buy a parcel whose **cold air drains downslope and away** — a frost-protected microclimate — and plant a perennial crop that needs exactly that protection (orchard, vineyard, frost-sensitive berries). The edge is measuring an asset the market cannot yet price: **a frost-safe microclimate, identified by thermal imagery and a cold-air-drainage read**, on ground the market values as ordinary cropland because frost risk is invisible on a plat map. The catch is time: income lags for years while the planting matures, so you fund establishment, opex, and debt service through a **J-curve** before the first dollar of revenue.',
    risks: [
      'Novelty risk: thin comps, uncertain exit liquidity, the thesis may simply be wrong — buyers may not pay a premium for a "frost-safe" claim, and the microclimate read may be wrong for the parcel you buy.',
      'Multi-year J-curve: years of establishment cost, opex, and debt service with zero revenue mean a long, cash-negative runway that a financing hiccup can end.',
      'Crop and commodity risk: even a frost-safe site faces disease, pests, drought, water restrictions, and price swings — and a single off-cycle frost event during bloom can still destroy a year.',
      'Cold-air drainage is site-specific and can be altered by new upslope planting, structures, or vegetation changes that dam the airflow you relied on.',
    ],
    opportunities: [
      'Frost-safe ground for perennials is genuinely scarce in many regions and can outperform surrounding parcels that are periodically frozen out.',
      'A proven, mature, income-producing planting on a documented frost-safe site can re-rate well above bare-cropland comps at exit.',
      'Thermal/drainage screening lets you find and buy mispriced frost-safe parcels before the local market recognizes the microclimate.',
    ],
    regulatory:
      'Confirm water rights and irrigation-district allocations (perennials cannot be left dry), any ag-use assessment and conservation-program enrollments, crop-insurance availability for the specific perennial, and labor rules for establishment and harvest before relying on the maturity-stage revenue.',
    dataHooks: ['thermal-imagery', 'cold-air-drainage-model'],
  },
};
