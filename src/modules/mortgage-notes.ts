import type { InvestmentModule, ComputeResult } from '../core/types';
import { pmt, loanBalance, irr } from '../core/finance';
import { computeIncomeStream } from './_shapes';

// Mortgage note investing. Buy a performing note at a discount to unpaid
// principal (UPB). You collect the amortizing P&I; the discount is the margin
// of safety and the source of yield-to-maturity above the coupon. If the loan
// stops performing, the collateral value backstops recovery.

function compute(i: Record<string, number>): ComputeResult {
  const upb = i.unpaidPrincipalBalance ?? 0;
  const pricePct = i.purchasePricePctOfUpb ?? 1;
  const noteRate = i.noteRate ?? 0;
  const remainingTermMonths = Math.max(1, Math.round(i.remainingTermMonths ?? 240));
  const collateralPropertyValue = i.collateralPropertyValue ?? 0;

  const purchasePrice = upb * pricePct;
  const capital = purchasePrice;

  const termYears = remainingTermMonths / 12;
  const monthlyPI = pmt(noteRate, termYears, upb);
  const annualPI = monthlyPI * 12;

  // Performing: five years of scheduled P&I, then the note is sold/paid off at
  // its amortized balance.
  const annualCashflows = [annualPI, annualPI, annualPI, annualPI, annualPI];
  const terminalValue = loanBalance(upb, noteRate, termYears, 60);

  const core = computeIncomeStream({
    capital,
    assetPrice: purchasePrice,
    annualCashflows,
    terminalValue,
    debtServiceAnnual: 0,
    noiAnnual: annualPI,
  });

  // Yield to (5-yr) maturity on the discounted purchase price.
  const yieldToMaturity = irr([
    -capital,
    annualPI,
    annualPI,
    annualPI,
    annualPI,
    annualPI + terminalValue,
  ]);
  const discountToUpb = 1 - pricePct;
  const collateralCoverage = purchasePrice > 0 ? collateralPropertyValue / purchasePrice : NaN;

  return {
    metrics: {
      ...core,
      yieldToMaturity,
      discountToUpb,
      collateralCoverage,
    },
  };
}

export const mortgageNotes: InvestmentModule = {
  id: 'mortgage-notes',
  name: 'Mortgage Notes — Discounted Purchase',
  category: 'Paper',
  tier: 'creative',
  blurb: 'Buy a performing mortgage note below unpaid principal; collect P&I.',
  params: [
    { key: 'unpaidPrincipalBalance', label: 'Unpaid principal (UPB)', type: 'currency', unit: '$', default: 180_000, min: 0, step: 5000, group: 'Note', help: 'Outstanding balance the borrower still owes.' },
    { key: 'purchasePricePctOfUpb', label: 'Price (% of UPB)', type: 'percent', unit: '%', default: 0.72, min: 0.1, max: 1.2, step: 0.01, group: 'Note', verify: true, help: 'What you pay per dollar of UPB. The discount is your margin of safety. Verify against recent note-trade comps.' },
    { key: 'noteRate', label: 'Note rate (coupon)', type: 'percent', unit: '%', default: 0.06, min: 0, max: 0.2, step: 0.005, group: 'Note', help: 'Contractual interest rate on the underlying loan.' },
    { key: 'remainingTermMonths', label: 'Remaining term', type: 'integer', unit: 'count', default: 240, min: 1, max: 480, step: 12, group: 'Note', help: 'Months left on the amortization schedule.' },
    { key: 'performing', label: 'Performing', type: 'integer', unit: 'count', default: 1, min: 0, max: 1, step: 1, group: 'Note', help: '1 = borrower is current. Non-performing notes are priced far lower and modeled differently.' },

    { key: 'collateralPropertyValue', label: 'Collateral value', type: 'currency', unit: '$', default: 230_000, min: 0, step: 5000, group: 'Collateral', verify: true, help: 'Current market value of the property securing the note. Verify with an independent valuation.' },
  ],
  metrics: [
    { key: 'yieldToMaturity', label: 'Yield to maturity', unit: '%', higherIsBetter: true, help: 'IRR on the discounted price over a 5-year hold, incl. payoff at the amortized balance.' },
    { key: 'discountToUpb', label: 'Discount to UPB', unit: '%', higherIsBetter: true, help: '1 − price/UPB. The built-in equity cushion at purchase.' },
    { key: 'collateralCoverage', label: 'Collateral coverage', unit: 'x', higherIsBetter: true, help: 'Collateral value ÷ purchase price. How far value can fall before your basis is impaired.' },
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
