import type { InvestmentModule, ComputeResult, YearRow } from './types';
import { irr, cashOnCash } from './finance';

// Optional after-tax layer for depreciable, held real property. Pure and tested.
// Models the two dominant tax effects an honest pre-tax pro-forma omits:
//   1. Depreciation shelter during the hold — a non-cash deduction that can turn
//      pre-tax-negative cash flow into after-tax-positive.
//   2. Tax at sale — depreciation recapture (§1250, capped ~25%) on the
//      depreciation taken, plus long-term capital gains on the rest of the gain.
//
// Deliberate, surfaced simplifications: straight-line MACRS with no mid-month
// convention; a flat marginal rate; assumes rental losses are usable in-year
// (ignores passive-activity-loss limits); basis = purchase price only (no closing
// costs or capital improvements); no 1031 exchange, NIIT, AMT, or state tax unless
// folded into the rates you enter.

export interface TaxSettings {
  marginalRate: number; // ordinary-income rate on rental income / losses
  capGainsRate: number; // long-term capital-gains rate at sale
  recaptureRate: number; // §1250 unrecaptured-gain rate cap (≤ 0.25)
  landFraction: number; // non-depreciable land share of basis
}

export const DEFAULT_TAX_SETTINGS: TaxSettings = {
  marginalRate: 0.32,
  capGainsRate: 0.15,
  recaptureRate: 0.25,
  landFraction: 0.2,
};

export interface AfterTaxYear {
  year: number;
  depreciation: number;
  interest: number;
  taxableIncome: number; // NOI − interest − depreciation
  incomeTax: number; // + owed, − benefit (loss shelters other income)
  preTaxCashFlow: number;
  afterTaxCashFlow: number;
}

export interface AfterTaxResult {
  years: AfterTaxYear[];
  annualDepreciation: number;
  accumulatedDepreciation: number;
  adjustedBasis: number;
  totalGain: number;
  recaptureTax: number;
  capitalGainsTax: number;
  saleTax: number;
  preTaxSaleProceeds: number;
  afterTaxSaleProceeds: number;
  totalIncomeTaxOverHold: number;
  metrics: {
    afterTaxAnnualCashFlow: number; // year 1
    afterTaxMonthlyCashFlow: number;
    afterTaxCashOnCash: number;
    afterTaxIrr: number;
  };
}

/**
 * The core-metric keys whose value changes under income tax. Cap rate and DSCR are
 * property-level (pre-financing, pre-income-tax) and are unaffected; cash invested
 * is unchanged. Used by the comparison view to swap these to after-tax values.
 */
export const AFTER_TAX_CORE_KEYS = [
  'annualCashFlow',
  'monthlyCashFlow',
  'cashOnCash',
  'irr5yr',
] as const;

/** Map an AfterTaxResult onto the core-metric keys it overrides. */
export function afterTaxOverrides(at: AfterTaxResult): Record<string, number> {
  return {
    annualCashFlow: at.metrics.afterTaxAnnualCashFlow,
    monthlyCashFlow: at.metrics.afterTaxMonthlyCashFlow,
    cashOnCash: at.metrics.afterTaxCashOnCash,
    irr5yr: at.metrics.afterTaxIrr,
  };
}

/**
 * Compute the after-tax view for a module that declares a taxProfile. Returns
 * null when the module has no taxProfile or produced no projection.
 */
export function computeAfterTax(
  module: InvestmentModule,
  inputs: Record<string, number>,
  result: ComputeResult,
  settings: TaxSettings,
): AfterTaxResult | null {
  const profile = module.taxProfile;
  const projection = result.projection;
  if (!profile || !projection || projection.length === 0) return null;

  const basis = profile.basis(inputs);
  const landFraction = profile.landFractionDefault ?? settings.landFraction;
  const buildingBasis = Math.max(basis * (1 - landFraction), 0);
  const annualDepreciation = profile.recoveryYears > 0 ? buildingBasis / profile.recoveryYears : 0;

  const holdYears = projection.length;
  const totalCashInvested = result.metrics.totalCashInvested ?? 0;
  const sellingCostPct = inputs.sellingCostPct ?? 0;

  const years: AfterTaxYear[] = projection.map((row: YearRow) => {
    // Straight-line: the same deduction every year (holds are far shorter than
    // the 27.5/39-year recovery period, so the asset never fully depreciates here).
    const depreciation = annualDepreciation;
    const taxableIncome = row.noi - row.interest - depreciation;
    const incomeTax = taxableIncome * settings.marginalRate;
    return {
      year: row.year,
      depreciation,
      interest: row.interest,
      taxableIncome,
      incomeTax,
      preTaxCashFlow: row.cashFlow,
      afterTaxCashFlow: row.cashFlow - incomeTax,
    };
  });

  const accumulatedDepreciation = annualDepreciation * holdYears;
  const adjustedBasis = basis - accumulatedDepreciation;

  const lastRow = projection[projection.length - 1]!;
  const grossSale = lastRow.propertyValue;
  const sellingCost = grossSale * sellingCostPct;
  const preTaxSaleProceeds = grossSale - sellingCost - lastRow.loanBalance;

  // Gain is measured against adjusted basis, net of selling costs (amount realized).
  const totalGain = grossSale - sellingCost - adjustedBasis;
  let recaptureTax = 0;
  let capitalGainsTax = 0;
  if (totalGain > 0) {
    const recaptured = Math.min(accumulatedDepreciation, totalGain);
    const capitalGain = Math.max(totalGain - recaptured, 0);
    recaptureTax = recaptured * settings.recaptureRate;
    capitalGainsTax = capitalGain * settings.capGainsRate;
  }
  const saleTax = recaptureTax + capitalGainsTax;
  const afterTaxSaleProceeds = preTaxSaleProceeds - saleTax;

  // After-tax IRR: −cash invested, each year's after-tax cash flow, plus the
  // after-tax sale proceeds in the final year.
  const cf: number[] = [-totalCashInvested];
  years.forEach((y, i) => {
    const isLast = i === years.length - 1;
    cf.push(y.afterTaxCashFlow + (isLast ? afterTaxSaleProceeds : 0));
  });
  const afterTaxIrr = irr(cf);

  const y1 = years[0]!;
  const totalIncomeTaxOverHold = years.reduce((s, y) => s + y.incomeTax, 0);

  return {
    years,
    annualDepreciation,
    accumulatedDepreciation,
    adjustedBasis,
    totalGain,
    recaptureTax,
    capitalGainsTax,
    saleTax,
    preTaxSaleProceeds,
    afterTaxSaleProceeds,
    totalIncomeTaxOverHold,
    metrics: {
      afterTaxAnnualCashFlow: y1.afterTaxCashFlow,
      afterTaxMonthlyCashFlow: y1.afterTaxCashFlow / 12,
      afterTaxCashOnCash: cashOnCash(y1.afterTaxCashFlow, totalCashInvested),
      afterTaxIrr,
    },
  };
}
