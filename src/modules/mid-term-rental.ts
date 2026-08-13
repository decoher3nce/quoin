import type { InvestmentModule, ComputeResult } from '../core/types';
import { dscr, guardDiv } from '../core/finance';
import { computeHold } from './_shapes';

// Mid-Term Rental. A furnished unit let on 30+ day terms — traveling nurses,
// corporate relocation, insurance/displacement housing, remote workers. It sits
// between LTR and STR: a rent premium over unfurnished, far less turnover and
// regulatory exposure than nightly, but real furnishing capex and utilities the
// landlord absorbs. Occupancy here is the fraction of months the unit is filled.

function compute(i: Record<string, number>): ComputeResult {
  const price = i.purchasePrice ?? 0;
  const downPct = i.downPaymentPct ?? 0;
  const rate = i.interestRate ?? 0;
  const term = i.loanTermYears ?? 30;
  const closingPct = i.closingCostPct ?? 0;
  const furnishing = i.furnishingCost ?? 0;

  const monthlyRentFurnished = i.monthlyRentFurnished ?? 0;
  const occupancy = i.occupancyPct ?? 0;
  const rentGrowth = i.rentGrowthPct ?? 0;
  const expenseGrowth = i.expenseGrowthPct ?? 0;

  const managementPct = i.managementPct ?? 0;
  const maintenancePct = i.maintenancePct ?? 0;

  const loanAmount = price * (1 - downPct);
  const totalCashInvested = price * downPct + price * closingPct + furnishing;

  const grossRevenue = (y: number) => monthlyRentFurnished * 12 * Math.pow(1 + rentGrowth, y - 1);
  const effectiveRevenue = (y: number) => grossRevenue(y) * occupancy;
  const fixedOpex = (y: number) => {
    const eg = Math.pow(1 + expenseGrowth, y - 1);
    const value = price * Math.pow(1 + (i.appreciationPct ?? 0), y - 1);
    return (
      value * (i.propertyTaxPct ?? 0) +
      (i.insuranceAnnual ?? 0) * eg +
      (i.hoaMonthly ?? 0) * 12 * eg +
      (i.utilitiesMonthly ?? 0) * 12 * eg
    );
  };
  const operatingExpenses = (y: number) => fixedOpex(y) + effectiveRevenue(y) * (managementPct + maintenancePct);

  const { core, projection, debtService, noi } = computeHold({
    price, loanAmount, annualRate: rate, termYears: term, appreciation: i.appreciationPct ?? 0,
    grossRevenue, effectiveRevenue, operatingExpenses,
    totalCashInvested, sellingPct: i.sellingCostPct ?? 0, holdYears: i.holdYears ?? 5,
  });

  // Break-even occupancy: fraction of months that must be filled for year-1 cash
  // flow to reach zero. Management/maintenance scale with collected rent.
  const fixedPlusDebt = fixedOpex(1) + debtService;
  const annualFurnishedRent = monthlyRentFurnished * 12;
  const breakEvenOccupancy = guardDiv(fixedPlusDebt, annualFurnishedRent * (1 - managementPct - maintenancePct));
  const effectiveMonthlyRent = monthlyRentFurnished * occupancy;

  const warnings: string[] = [];
  const d = dscr(noi, debtService);
  if (Number.isFinite(breakEvenOccupancy) && breakEvenOccupancy > occupancy)
    warnings.push(`Modeled occupancy ${(occupancy * 100).toFixed(0)}% is below break-even ${(breakEvenOccupancy * 100).toFixed(0)}%.`);
  if (Number.isFinite(d) && d < 1.2) warnings.push(`DSCR ${d.toFixed(2)}× is below 1.20.`);
  if (core.annualCashFlow < 0) warnings.push('Year-1 pre-tax cash flow is negative (depreciation not modeled).');

  return {
    metrics: { ...core, breakEvenOccupancy, effectiveMonthlyRent },
    projection,
    warnings,
  };
}

export const midTermRental: InvestmentModule = {
  id: 'mid-term-rental',
  name: 'Mid-Term Rental — Furnished 30+ Day',
  category: 'Hospitality',
  tier: 'core',
  blurb: 'Furnished monthly lets (nurses, relo, insurance housing): rent premium, low turnover, few STR rules.',
  params: [
    { key: 'purchasePrice', label: 'Purchase price', type: 'currency', unit: '$', default: 420_000, min: 0, step: 5000, group: 'Financing', verify: true },
    { key: 'downPaymentPct', label: 'Down payment', type: 'percent', unit: '%', default: 0.25, min: 0, max: 1, step: 0.01, group: 'Financing' },
    { key: 'interestRate', label: 'Interest rate', type: 'percent', unit: '%', default: 0.07, min: 0, max: 0.2, step: 0.001, group: 'Financing', verify: true },
    { key: 'loanTermYears', label: 'Loan term', type: 'integer', unit: 'yr', default: 30, min: 1, max: 40, step: 1, group: 'Financing' },
    { key: 'closingCostPct', label: 'Closing costs', type: 'percent', unit: '%', default: 0.03, min: 0, max: 0.1, step: 0.005, group: 'Financing' },

    { key: 'furnishingCost', label: 'Furnishing & setup', type: 'currency', unit: '$', default: 18_000, min: 0, step: 1000, group: 'Setup', help: 'Fully furnished, housewares included. Lighter than an STR (no nightly-turnover consumables) but still real capex.' },

    { key: 'monthlyRentFurnished', label: 'Monthly rent (furnished)', type: 'currency', unit: '$/mo', default: 3_400, min: 0, step: 50, group: 'Income', verify: true, help: 'Furnished 30+ day rate — a premium over unfurnished. Verify against Furnished Finder / corporate-housing comps.' },
    { key: 'occupancyPct', label: 'Occupancy (months filled)', type: 'percent', unit: '%', default: 0.85, min: 0, max: 1, step: 0.01, group: 'Income', verify: true, help: 'Fraction of months occupied. Gaps between mid-term tenants are longer than STR nights but shorter than an LTR vacancy.' },
    { key: 'rentGrowthPct', label: 'Rent growth', type: 'percent', unit: '%', default: 0.03, min: -0.1, max: 0.15, step: 0.005, group: 'Income' },

    { key: 'propertyTaxPct', label: 'Property tax', type: 'percent', unit: '%', default: 0.011, min: 0, max: 0.05, step: 0.001, group: 'Expenses', verify: true },
    { key: 'insuranceAnnual', label: 'Insurance', type: 'currency', unit: '$/yr', default: 1_600, min: 0, step: 100, group: 'Expenses', verify: true, help: 'Furnished/rental coverage — between landlord and STR pricing.' },
    { key: 'hoaMonthly', label: 'HOA dues', type: 'currency', unit: '$/mo', default: 0, min: 0, step: 25, group: 'Expenses' },
    { key: 'utilitiesMonthly', label: 'Utilities', type: 'currency', unit: '$/mo', default: 260, min: 0, step: 20, group: 'Expenses', help: 'Mid-term tenants expect utilities and internet included in the rent.' },
    { key: 'managementPct', label: 'Management', type: 'percent', unit: '%', default: 0.1, min: 0, max: 0.3, step: 0.01, group: 'Expenses', help: 'Lower than STR — fewer turnovers, no nightly guest comms. Set to 0 if self-managing.' },
    { key: 'maintenancePct', label: 'Maintenance & turnover', type: 'percent', unit: '%', default: 0.06, min: 0, max: 0.2, step: 0.005, group: 'Expenses', help: 'As a fraction of collected rent.' },
    { key: 'expenseGrowthPct', label: 'Expense growth', type: 'percent', unit: '%', default: 0.025, min: 0, max: 0.15, step: 0.005, group: 'Expenses' },

    { key: 'appreciationPct', label: 'Appreciation', type: 'percent', unit: '%', default: 0.035, min: -0.1, max: 0.15, step: 0.005, group: 'Exit' },
    { key: 'holdYears', label: 'Hold period', type: 'integer', unit: 'yr', default: 5, min: 1, max: 30, step: 1, group: 'Exit' },
    { key: 'sellingCostPct', label: 'Selling costs', type: 'percent', unit: '%', default: 0.06, min: 0, max: 0.12, step: 0.005, group: 'Exit' },
  ],
  metrics: [
    { key: 'breakEvenOccupancy', label: 'Break-even occupancy', unit: '%', higherIsBetter: false, help: 'Fraction of months that must be filled for year-1 cash flow to be zero. Lower is safer.' },
    { key: 'effectiveMonthlyRent', label: 'Effective monthly rent', unit: '$/mo', higherIsBetter: true, help: 'Furnished rent × occupancy — the blended monthly collection.' },
  ],
  compute,
  narrative: {
    strategy:
      'Rent a furnished unit on **30+ day terms** to traveling nurses, relocating employees, insurance-displaced families, and remote workers. It captures much of the STR rent premium while avoiding the nightly grind: **turnover is monthly not daily**, management is lighter, and most jurisdictions treat 30+ day stays as ordinary rentals — so the STR permit regime largely does not apply. The trade is furnishing capex, landlord-paid utilities, and demand that depends on local institutions (hospitals, corporate employers) rather than tourism.',
    risks: [
      'Demand is institution-dependent: a hospital contract change or a corporate relocation slowdown can thin the tenant pipeline.',
      'Gaps between mid-term tenants are longer than STR nights — a single unfilled month is a large occupancy hit.',
      'Furnishing capex and included utilities/internet are real costs an unfurnished LTR does not carry.',
      'The 30-day threshold is a legal line: dip below it and the unit can be reclassified as an STR, triggering permits and lodging tax.',
    ],
    opportunities: [
      'Rent premium over unfurnished LTR with a fraction of STR operational intensity and turnover cost.',
      'Largely outside STR regulation where a genuine 30+ day minimum is enforced — a regulatory hedge against nightly bans.',
      'Diversified, often creditworthy demand (healthcare systems, insurers, employers) that can pay reliably and renew.',
    ],
    regulatory:
      'The 30-day minimum-stay line is what keeps this out of most STR ordinances — but only if it is genuinely enforced. Verify the local definition of a short-term rental (many use a 28- or 30-night threshold), any furnished-rental or business-license requirement, and lodging-tax rules. Cross the threshold, even occasionally, and the unit can be regulated and taxed as an STR.',
    dataHooks: ['viirs-radiance'],
  },
};
