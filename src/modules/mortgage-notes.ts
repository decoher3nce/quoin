import type { InvestmentModule, ComputeResult } from '../core/types';
import { pmt, loanBalance } from '../core/finance';
import { computeIncomeStream } from './_shapes';

// Mortgage note investing. Buy a note at a discount to unpaid principal (UPB).
// PERFORMING: the borrower pays, so you collect amortizing P&I and the discount
// lifts your yield above the coupon. NON-PERFORMING: the borrower has stopped
// paying, so there is no interim income — value comes from a workout that
// recovers the collateral (net of foreclosure/REO costs), and the deeper
// discount is what makes the recovery profitable. The `performing` toggle
// switches between the two cash-flow shapes.

function compute(i: Record<string, number>): ComputeResult {
  const upb = i.unpaidPrincipalBalance ?? 0;
  const pricePct = i.purchasePricePctOfUpb ?? 1;
  const noteRate = i.noteRate ?? 0;
  const remainingTermMonths = Math.max(1, Math.round(i.remainingTermMonths ?? 240));
  const collateralPropertyValue = i.collateralPropertyValue ?? 0;
  const performing = Math.round(i.performing ?? 1) >= 1;

  const purchasePrice = upb * pricePct;
  const capital = purchasePrice;

  const warnings: string[] = [];
  let annualCashflows: number[];
  let terminalValue: number;
  let noiAnnual: number;

  if (performing) {
    // Collect scheduled P&I, then sell/pay off at the amortized balance in year 5.
    const termYears = remainingTermMonths / 12;
    const annualPI = pmt(noteRate, termYears, upb) * 12;
    annualCashflows = [annualPI, annualPI, annualPI, annualPI, annualPI];
    terminalValue = loanBalance(upb, noteRate, termYears, 60);
    noiAnnual = annualPI;
  } else {
    // Non-performing: no scheduled payments. Value comes from a workout — recover
    // the collateral net of foreclosure/REO/selling costs, capped at what you are
    // owed (UPB), realized after a resolution timeline.
    const workoutMonths = Math.max(1, Math.round(i.workoutMonths ?? 18));
    const foreclosureCostPct = i.foreclosureCostPct ?? 0;
    const years = Math.max(1, Math.ceil(workoutMonths / 12));
    annualCashflows = Array.from({ length: years }, () => 0);
    terminalValue = Math.min(collateralPropertyValue * (1 - foreclosureCostPct), upb);
    noiAnnual = 0;
    warnings.push(
      `Non-performing: no interim payments. Recovery is modeled at month ${workoutMonths} as collateral value net of ${(foreclosureCostPct * 100).toFixed(0)}% foreclosure/REO costs, capped at UPB.`,
    );
    if (terminalValue < purchasePrice)
      warnings.push('Modeled recovery is below your purchase price — a loss even before time value; the collateral does not cover your basis.');
  }

  const core = computeIncomeStream({
    capital,
    assetPrice: purchasePrice,
    annualCashflows,
    terminalValue,
    debtServiceAnnual: 0,
    noiAnnual,
  });

  const discountToUpb = 1 - pricePct;
  const collateralCoverage = purchasePrice > 0 ? collateralPropertyValue / purchasePrice : NaN;

  return {
    metrics: {
      ...core,
      discountToUpb,
      collateralCoverage,
      recoveryValue: terminalValue,
    },
    warnings,
  };
}

export const mortgageNotes: InvestmentModule = {
  id: 'mortgage-notes',
  name: 'Mortgage Notes — Discounted Purchase',
  category: 'Paper',
  tier: 'creative',
  blurb: 'Buy a mortgage note below UPB — collect P&I (performing) or work out the collateral (non-performing).',
  params: [
    { key: 'unpaidPrincipalBalance', label: 'Unpaid principal (UPB)', type: 'currency', unit: '$', default: 180_000, min: 0, step: 5000, group: 'Note', help: 'Outstanding balance the borrower still owes.' },
    { key: 'purchasePricePctOfUpb', label: 'Price (% of UPB)', type: 'percent', unit: '%', default: 0.72, min: 0.1, max: 1.2, step: 0.01, group: 'Note', verify: true, help: 'What you pay per dollar of UPB. The discount is your margin of safety. Verify against recent note-trade comps.' },
    { key: 'noteRate', label: 'Note rate (coupon)', type: 'percent', unit: '%', default: 0.06, min: 0, max: 0.2, step: 0.005, group: 'Note', help: 'Contractual interest rate on the underlying loan.' },
    { key: 'remainingTermMonths', label: 'Remaining term', type: 'integer', unit: 'count', default: 240, min: 1, max: 480, step: 12, group: 'Note', help: 'Months left on the amortization schedule.' },
    { key: 'performing', label: 'Performing (1) / non-performing (0)', type: 'integer', unit: 'count', default: 1, min: 0, max: 1, step: 1, group: 'Note', help: '1 = borrower is current: model scheduled P&I. 0 = defaulted: model a collateral recovery via workout instead (uses the two Non-performing inputs below).' },

    { key: 'collateralPropertyValue', label: 'Collateral value', type: 'currency', unit: '$', default: 230_000, min: 0, step: 5000, group: 'Collateral', verify: true, help: 'Current market value of the property securing the note. Verify with an independent valuation.' },

    { key: 'workoutMonths', label: 'Workout period', type: 'integer', unit: 'count', default: 18, min: 1, max: 60, step: 1, group: 'Non-performing', help: 'Months to resolve a defaulted note (modification, deed-in-lieu, or foreclosure) before the recovery is realized. Only used when non-performing.' },
    { key: 'foreclosureCostPct', label: 'Foreclosure / REO cost', type: 'percent', unit: '%', default: 0.15, min: 0, max: 0.5, step: 0.01, group: 'Non-performing', verify: true, help: 'Legal, servicing, REO, and selling costs as a fraction of collateral value. Only used when non-performing.' },
  ],
  metrics: [
    { key: 'discountToUpb', label: 'Discount to UPB', unit: '%', higherIsBetter: true, help: '1 − price/UPB. The built-in equity cushion at purchase.' },
    { key: 'collateralCoverage', label: 'Collateral coverage', unit: 'x', higherIsBetter: true, help: 'Collateral value ÷ purchase price. How far value can fall before your basis is impaired.' },
    { key: 'recoveryValue', label: 'Exit / recovery value', unit: '$', higherIsBetter: true, help: 'What you receive at the end: the amortized note balance (performing) or the workout recovery net of costs, capped at UPB (non-performing). The core 5-yr IRR is the yield to maturity on this.' },
  ],
  compute,
  narrative: {
    strategy:
      'Buy a seasoned, performing mortgage note for less than its unpaid principal and collect the borrower’s scheduled principal and interest. The **discount is the margin of safety**: it lifts your yield above the coupon and gives you room to recover even if the loan later defaults, because your basis sits well below both the UPB and the collateral value.',
    risks: [
      'A performing note can go non-performing; servicing, legal, and foreclosure costs then eat into the recovery.',
      'On default, recovery depends entirely on the collateral value — an overstated property value erases the apparent cushion.',
      'Prepayment shortens the stream and can cut the realized yield-to-maturity below plan.',
      'Notes are illiquid and title/lien-position defects can subordinate your claim.',
    ],
    opportunities: [
      'The purchase discount produces a yield-to-maturity meaningfully above the note’s coupon.',
      'A large collateral-to-basis coverage turns most defaults into a full recovery.',
      'Non-performing notes bought even cheaper offer workout, modification, or foreclosure upside.',
    ],
    regulatory:
      'Note servicing and any modification or foreclosure are governed by federal (RESPA, TILA, FDCPA) and state law. Use a licensed servicer and confirm lien position and clean title before purchase.',
  },
};
