import type { InvestmentModule, ComputeResult } from '../core/types';
import { capRate, cashOnCash, dscr, irr, guardDiv, annualDebtService } from '../core/finance';
import { buildProjection, holdCashflows } from './_projection';

// Short-Term Rental (metro). Revenue = ADR × 365 × occupancy, minus a platform
// fee. Heavy operating expenses (management, supplies, utilities the host now
// pays) and up-front furnishing capex. The signature output is break-even
// occupancy: the demand floor below which the deal bleeds.

function compute(i: Record<string, number>): ComputeResult {
  const price = i.purchasePrice ?? 0;
  const downPct = i.downPaymentPct ?? 0;
  const rate = i.interestRate ?? 0;
  const term = i.loanTermYears ?? 30;
  const closingPct = i.closingCostPct ?? 0;

  const adr = i.adr ?? 0;
  const occ = i.occupancyPct ?? 0;
  const platformFee = i.platformFeePct ?? 0;
  const revGrowth = i.revenueGrowthPct ?? 0;
  const expenseGrowth = i.expenseGrowthPct ?? 0;

  const suppliesPct = i.suppliesPct ?? 0;
  const managementPct = i.managementPct ?? 0;
  const maintenancePct = i.maintenancePct ?? 0;
  const variablePct = suppliesPct + managementPct + maintenancePct;

  const loanAmount = price * (1 - downPct);
  const downPayment = price * downPct;
  const closing = price * closingPct;
  const furnishing = i.furnishingCost ?? 0;
  const reserve = i.reserveCash ?? 0;
  const totalCashInvested = downPayment + closing + furnishing + reserve;

  const grossRevenue = (year: number) => adr * 365 * occ * Math.pow(1 + revGrowth, year - 1);
  const effectiveRevenue = (year: number) => grossRevenue(year) * (1 - platformFee);
  const fixedOpex = (year: number) => {
    const eg = Math.pow(1 + expenseGrowth, year - 1);
    const value = price * Math.pow(1 + (i.appreciationPct ?? 0), year - 1);
    const tax = value * (i.propertyTaxPct ?? 0);
    const insurance = (i.insuranceAnnual ?? 0) * eg;
    const hoa = (i.hoaMonthly ?? 0) * 12 * eg;
    const utilities = (i.utilitiesMonthly ?? 0) * 12 * eg;
    return tax + insurance + hoa + utilities;
  };
  const operatingExpenses = (year: number) => fixedOpex(year) + grossRevenue(year) * variablePct;

  const horizon = Math.max(Math.round(i.holdYears ?? 5), 5);
  const full = buildProjection(
    { price, loanAmount, annualRate: rate, termYears: term, appreciation: i.appreciationPct ?? 0, grossRevenue, effectiveRevenue, operatingExpenses },
    horizon,
  );

  const y1 = full[0]!;
  const debtService = loanAmount > 0 ? annualDebtService(rate, term, loanAmount) : 0;
  const noi = y1.noi;
  const annualCashFlow = y1.cashFlow;

  const irr5yr = irr(holdCashflows(full, totalCashInvested, 5, i.sellingCostPct ?? 0));
  const projection = full.slice(0, Math.round(i.holdYears ?? 5));

  // Break-even occupancy (year 1): solve cashFlow(occ) = 0.
  // revenue R(occ) = adr*365*occ; cashFlow = R*(1-fee) - fixed - R*variablePct - debtService.
  const marginPerRevenue = 1 - platformFee - variablePct;
  const fixedPlusDebt = fixedOpex(1) + debtService;
  const revNeeded = guardDiv(fixedPlusDebt, marginPerRevenue);
  const breakEvenOccupancy = adr > 0 ? guardDiv(revNeeded, adr * 365) : NaN;
  const revPAN = adr * occ; // revenue per available night

  const warnings: string[] = [];
  const dscrVal = dscr(noi, debtService);
  if (Number.isFinite(breakEvenOccupancy) && breakEvenOccupancy > 0.8)
    warnings.push(`Break-even occupancy ${(breakEvenOccupancy * 100).toFixed(0)}% is high — little cushion for a soft season or new-supply shock.`);
  if (Number.isFinite(breakEvenOccupancy) && breakEvenOccupancy > occ)
    warnings.push(`Modeled occupancy ${(occ * 100).toFixed(0)}% is below break-even ${(breakEvenOccupancy * 100).toFixed(0)}% — this configuration loses money.`);
  if (Number.isFinite(dscrVal) && dscrVal < 1.2) warnings.push(`DSCR ${dscrVal.toFixed(2)}× is below 1.20.`);
  if (annualCashFlow < 0) warnings.push('Year-1 pre-tax cash flow is negative.');

  return {
    metrics: {
      annualCashFlow,
      monthlyCashFlow: annualCashFlow / 12,
      cashOnCash: cashOnCash(annualCashFlow, totalCashInvested),
      capRate: capRate(noi, price),
      dscr: dscrVal,
      irr5yr,
      totalCashInvested,
      breakEvenOccupancy,
      revPAN,
    },
    projection,
    warnings,
  };
}

export const strMetro: InvestmentModule = {
  id: 'str-metro',
  name: 'Short-Term Rental — Metro',
  category: 'Hospitality',
  tier: 'core',
  blurb: 'Nightly rental: ADR × occupancy, heavy opex, furnishing capex.',
  params: [
    { key: 'purchasePrice', label: 'Purchase price', type: 'currency', unit: '$', default: 480_000, min: 0, step: 5000, group: 'Financing', verify: true },
    { key: 'downPaymentPct', label: 'Down payment', type: 'percent', unit: '%', default: 0.25, min: 0, max: 1, step: 0.01, group: 'Financing' },
    { key: 'interestRate', label: 'Interest rate', type: 'percent', unit: '%', default: 0.075, min: 0, max: 0.2, step: 0.001, group: 'Financing', verify: true },
    { key: 'loanTermYears', label: 'Loan term', type: 'integer', unit: 'yr', default: 30, min: 1, max: 40, step: 1, group: 'Financing' },
    { key: 'closingCostPct', label: 'Closing costs', type: 'percent', unit: '%', default: 0.03, min: 0, max: 0.1, step: 0.005, group: 'Financing' },

    { key: 'furnishingCost', label: 'Furnishing & setup', type: 'currency', unit: '$', default: 35_000, min: 0, step: 1000, group: 'Setup', help: 'Furniture, linens, kitchen, photography, listing setup. Up-front capex.' },
    { key: 'reserveCash', label: 'Operating reserve', type: 'currency', unit: '$', default: 8_000, min: 0, step: 500, group: 'Setup', help: 'Cash cushion for seasonality and turnover.' },

    { key: 'adr', label: 'Average daily rate', type: 'number', unit: '$/night', default: 220, min: 0, step: 5, group: 'Income', verify: true, help: 'Verify against AirDNA / comparable active listings in the exact submarket.' },
    { key: 'occupancyPct', label: 'Occupancy', type: 'percent', unit: '%', default: 0.62, min: 0, max: 1, step: 0.01, group: 'Income', verify: true, help: 'Paid nights / available nights. The single most over-optimistic input in STR pro-formas.' },
    { key: 'platformFeePct', label: 'Platform fee', type: 'percent', unit: '%', default: 0.03, min: 0, max: 0.2, step: 0.005, group: 'Income', help: 'Host-side share of the booking platform take.' },
    { key: 'revenueGrowthPct', label: 'Revenue growth', type: 'percent', unit: '%', default: 0.03, min: -0.1, max: 0.15, step: 0.005, group: 'Income' },

    { key: 'propertyTaxPct', label: 'Property tax', type: 'percent', unit: '%', default: 0.011, min: 0, max: 0.05, step: 0.001, group: 'Expenses', verify: true },
    { key: 'insuranceAnnual', label: 'STR insurance', type: 'currency', unit: '$/yr', default: 2_600, min: 0, step: 100, group: 'Expenses', verify: true, help: 'Short-term-rental coverage costs more than a standard landlord policy.' },
    { key: 'hoaMonthly', label: 'HOA dues', type: 'currency', unit: '$/mo', default: 0, min: 0, step: 25, group: 'Expenses' },
    { key: 'utilitiesMonthly', label: 'Utilities', type: 'currency', unit: '$/mo', default: 320, min: 0, step: 20, group: 'Expenses', help: 'STR hosts pay all utilities, internet, streaming.' },
    { key: 'suppliesPct', label: 'Supplies & consumables', type: 'percent', unit: '%', default: 0.04, min: 0, max: 0.2, step: 0.005, group: 'Expenses', help: 'As a fraction of gross revenue.' },
    { key: 'managementPct', label: 'Management / co-host', type: 'percent', unit: '%', default: 0.2, min: 0, max: 0.4, step: 0.01, group: 'Expenses', verify: true, help: 'Full-service STR management runs 18–25% of gross. Set to 0 if self-managing.' },
    { key: 'maintenancePct', label: 'Maintenance & turnover', type: 'percent', unit: '%', default: 0.06, min: 0, max: 0.2, step: 0.005, group: 'Expenses', help: 'As a fraction of gross revenue.' },
    { key: 'expenseGrowthPct', label: 'Expense growth', type: 'percent', unit: '%', default: 0.03, min: 0, max: 0.15, step: 0.005, group: 'Expenses' },

    { key: 'appreciationPct', label: 'Appreciation', type: 'percent', unit: '%', default: 0.035, min: -0.1, max: 0.15, step: 0.005, group: 'Exit' },
    { key: 'holdYears', label: 'Hold period', type: 'integer', unit: 'yr', default: 5, min: 1, max: 30, step: 1, group: 'Exit' },
    { key: 'sellingCostPct', label: 'Selling costs', type: 'percent', unit: '%', default: 0.06, min: 0, max: 0.12, step: 0.005, group: 'Exit' },
  ],
  metrics: [
    { key: 'breakEvenOccupancy', label: 'Break-even occupancy', unit: '%', higherIsBetter: false, help: 'Occupancy at which year-1 cash flow is zero. Lower is safer.' },
    { key: 'revPAN', label: 'Revenue / available night', unit: '$/night', higherIsBetter: true, help: 'ADR × occupancy — the blended nightly yield.' },
  ],
  compute,
  narrative: {
    strategy:
      'Operate a furnished unit as a nightly rental. Revenue is **ADR × 365 × occupancy**, which at a healthy occupancy can far exceed long-term rent — but it is a hospitality business, not passive real estate. Operating expenses are heavy (management, cleaning, supplies, all utilities), furnishing is real up-front capex, and demand is seasonal and competitive. The deal lives or dies on **break-even occupancy**: how far demand can fall before cash flow turns negative.',
    risks: [
      'Regulatory: cities can restrict, permit-cap, or ban STRs — often with little notice. This is the dominant risk.',
      'Occupancy and ADR are the most over-optimistic inputs in most pro-formas; new supply compresses both.',
      'Operating intensity: it is a business with labor, reviews, and turnover, not mailbox money.',
      'Financing and insurance both cost more for STR use, and lenders may restrict it outright.',
    ],
    opportunities: [
      'Revenue can substantially exceed long-term rent where regulation is stable and demand is deep.',
      'Dynamic pricing, direct booking, and higher review scores lift both ADR and occupancy.',
      'Mid-term (30+ day) fallback can backstop occupancy when nightly demand softens.',
    ],
    regulatory:
      'STR legality is the make-or-break variable. Verify the specific municipal and HOA rules — permits, caps, primary-residence requirements, occupancy taxes — BEFORE underwriting. A ban or cap can zero this model overnight.',
    dataHooks: ['viirs-radiance'],
  },
};
