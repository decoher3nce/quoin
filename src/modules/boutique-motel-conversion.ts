import type { InvestmentModule, ComputeResult } from '../core/types';
import { dscr, guardDiv } from '../core/finance';
import { computeHold } from './_shapes';

// Boutique Motel Conversion. Buy a tired roadside motel, reposition it (renovation,
// rebrand, revenue management), and operate it as a boutique property. This is an
// OPERATING BUSINESS, not passive real estate: staff, a brand, seasonality, and a
// labor-heavy expense base. The return comes from stabilizing occupancy and ADR on
// an all-in basis that includes the renovation.

function compute(i: Record<string, number>): ComputeResult {
  const purchasePrice = i.purchasePrice ?? 0;
  const renovationBudget = i.renovationBudget ?? 0;
  const price = purchasePrice + renovationBudget; // all-in basis
  const downPct = i.downPaymentPct ?? 0;
  const rate = i.interestRate ?? 0;
  const term = i.loanTermYears ?? 20;
  const closingPct = i.closingCostPct ?? 0;

  const rooms = i.rooms ?? 0;
  const adr = i.adr ?? 0;
  const stabilizedOccupancy = i.stabilizedOccupancy ?? 0;
  const opexRatio = i.opexRatioOfRevenue ?? 0;
  const fixedOpexAnnual = i.fixedOpexAnnual ?? 0;
  const revGrowth = i.revGrowthPct ?? 0;

  // Loan is sized on the purchase; renovation is typically cash / separate facility.
  const loanAmount = purchasePrice * (1 - downPct);
  const totalCashInvested = purchasePrice * downPct + purchasePrice * closingPct + renovationBudget;

  const grossRevenue = (y: number) => rooms * adr * 365 * stabilizedOccupancy * Math.pow(1 + revGrowth, y - 1);
  const effectiveRevenue = (y: number) => grossRevenue(y);
  const operatingExpenses = (y: number) =>
    grossRevenue(y) * opexRatio + fixedOpexAnnual * Math.pow(1 + revGrowth, y - 1);

  const { core, projection, debtService, noi } = computeHold({
    price, loanAmount, annualRate: rate, termYears: term, appreciation: i.appreciationPct ?? 0,
    grossRevenue, effectiveRevenue, operatingExpenses,
    totalCashInvested, sellingPct: i.sellingCostPct ?? 0, holdYears: i.holdYears ?? 5,
  });

  const revPAR = adr * stabilizedOccupancy;
  const pricePerRoom = guardDiv(price, rooms);
  const grossOperatingMarginPct = 1 - opexRatio;

  const warnings: string[] = [];
  const d = dscr(noi, debtService);
  if (Number.isFinite(d) && d < 1.3) warnings.push(`DSCR ${d.toFixed(2)}× is below 1.30 — operating-business lenders want more cushion than for a rental.`);
  if (core.annualCashFlow < 0) warnings.push('Year-1 pre-tax cash flow is negative — repositioning may not stabilize immediately.');
  if (stabilizedOccupancy > 0.75) warnings.push(`Stabilized occupancy ${(stabilizedOccupancy * 100).toFixed(0)}% is optimistic for an independent boutique property.`);

  return {
    metrics: { ...core, revPAR, pricePerRoom, grossOperatingMarginPct },
    projection,
    warnings,
  };
}

export const boutiqueMotelConversion: InvestmentModule = {
  id: 'boutique-motel-conversion',
  name: 'Boutique Motel Conversion',
  category: 'Hospitality',
  tier: 'creative',
  blurb: 'Buy a tired motel, reposition, and operate it. An operating business, not passive real estate.',
  params: [
    { key: 'purchasePrice', label: 'Purchase price', type: 'currency', unit: '$', default: 1_400_000, min: 0, step: 25_000, group: 'Acquisition', verify: true, help: 'Distressed/independent motels trade on in-place income; verify the trailing P&L, not the pro-forma.' },
    { key: 'renovationBudget', label: 'Renovation budget', type: 'currency', unit: '$', default: 600_000, min: 0, step: 25_000, group: 'Acquisition', verify: true, help: 'Repositioning capex. Verify against contractor bids — motel conversions routinely overrun.' },
    { key: 'rooms', label: 'Room count', type: 'integer', unit: 'count', default: 24, min: 1, step: 1, group: 'Acquisition' },
    { key: 'downPaymentPct', label: 'Down payment', type: 'percent', unit: '%', default: 0.3, min: 0, max: 1, step: 0.01, group: 'Financing', help: 'Hospitality/SBA lending typically wants more equity than residential.' },
    { key: 'interestRate', label: 'Interest rate', type: 'percent', unit: '%', default: 0.085, min: 0, max: 0.2, step: 0.001, group: 'Financing', verify: true, help: 'Commercial/SBA hospitality debt prices above residential mortgages.' },
    { key: 'loanTermYears', label: 'Loan term', type: 'integer', unit: 'yr', default: 20, min: 1, max: 30, step: 1, group: 'Financing' },
    { key: 'closingCostPct', label: 'Closing costs', type: 'percent', unit: '%', default: 0.03, min: 0, max: 0.1, step: 0.005, group: 'Financing' },

    { key: 'adr', label: 'Stabilized ADR', type: 'number', unit: '$/night', default: 135, min: 0, step: 5, group: 'Operations', verify: true, help: 'Post-repositioning average daily rate. Verify against comparable boutique/independent properties in the market.' },
    { key: 'stabilizedOccupancy', label: 'Stabilized occupancy', type: 'percent', unit: '%', default: 0.62, min: 0, max: 1, step: 0.01, group: 'Operations', verify: true, help: 'Occupancy after ramp-up. Independent properties rarely match branded-flag occupancy; be conservative.' },
    { key: 'opexRatioOfRevenue', label: 'Operating expense ratio', type: 'percent', unit: '%', default: 0.5, min: 0, max: 1, step: 0.01, group: 'Operations', verify: true, help: 'Labor-heavy: housekeeping, front desk, utilities, OTA commissions. Independent motels commonly run near 50% of revenue.' },
    { key: 'fixedOpexAnnual', label: 'Fixed operating cost', type: 'currency', unit: '$/yr', default: 90_000, min: 0, step: 5000, group: 'Operations', help: 'Management, insurance, property tax base, and other largely fixed annual costs.' },
    { key: 'revGrowthPct', label: 'Revenue growth', type: 'percent', unit: '%', default: 0.03, min: -0.1, max: 0.15, step: 0.005, group: 'Operations' },

    { key: 'appreciationPct', label: 'Appreciation', type: 'percent', unit: '%', default: 0.02, min: -0.1, max: 0.15, step: 0.005, group: 'Exit', help: 'Hospitality value tracks income (a cap-rate on NOI) more than land inflation — kept conservative.' },
    { key: 'holdYears', label: 'Hold period', type: 'integer', unit: 'yr', default: 5, min: 1, max: 30, step: 1, group: 'Exit' },
    { key: 'sellingCostPct', label: 'Selling costs', type: 'percent', unit: '%', default: 0.06, min: 0, max: 0.12, step: 0.005, group: 'Exit' },
  ],
  metrics: [
    { key: 'revPAR', label: 'RevPAR', unit: '$/night', higherIsBetter: true, help: 'Revenue per available room = ADR × occupancy. The core hospitality yield metric.' },
    { key: 'pricePerRoom', label: 'All-in price per room', unit: '$', higherIsBetter: false, help: '(Purchase + renovation) ÷ rooms. Compare to replacement cost and market per-key comps.' },
    { key: 'grossOperatingMarginPct', label: 'Gross operating margin', unit: '%', higherIsBetter: true, help: '1 − operating expense ratio. What each revenue dollar keeps before fixed cost and debt.' },
  ],
  compute,
  narrative: {
    strategy:
      'Acquire an underperforming motel, renovate and rebrand it, and run it as a boutique property — capturing the gap between a tired in-place operation and a repositioned one. This is fundamentally an **operating business**: you are buying staff, a brand, and a P&L, not a passive rent stream. Returns come from lifting **RevPAR** (ADR × occupancy) and disciplining a labor-heavy expense base, then exiting on a stabilized NOI at a market cap rate. The all-in basis (purchase **plus** renovation) is what must pencil.',
    risks: [
      'It is a business to run, not an asset to hold: staffing, guest service, reviews, and revenue management are ongoing operational demands.',
      'Renovation and repositioning risk — cost overruns, schedule slippage, and a slower-than-modeled occupancy ramp are the norm, not the exception.',
      'Seasonality and location dependence: roadside/leisure demand can be highly seasonal, and a weak location cannot be renovated away.',
      'Independent properties lack flag distribution — occupancy and ADR are harder to hold than branded comps, and OTA commissions eat margin.',
    ],
    opportunities: [
      'Value-add on stabilization: lifting NOI at a market cap rate can create equity well above the renovation spend.',
      'Distinctive boutique positioning and direct/social booking can command ADR premiums a generic motel never could.',
      'Ancillary revenue (F&B, events, experiences) and operational efficiencies expand margin beyond the room line.',
    ],
    regulatory:
      'A licensed lodging operation carries a heavier compliance load than a rental: hospitality/lodging licenses, health and life-safety/fire code, ADA accessibility, employment and payroll law for staff, and occupancy/lodging tax collection and remittance. Conversion or change-of-use may also trigger zoning review and updated building-code compliance. Verify the full licensing and code path — and any change-of-use hurdle — before closing.',
    dataHooks: ['viirs-radiance'],
  },
};
