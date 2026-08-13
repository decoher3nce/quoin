import type { InvestmentModule, ComputeResult } from '../core/types';
import { grm, dscr, guardDiv } from '../core/finance';
import { computeHold } from './_shapes';

// Small Multifamily (2–4 units). Still a residential loan (up to 4 units), so it
// carries the best financing terms available for income property. A house-hack
// toggle lets an owner-occupant put far less down but gives up one unit's rent.

function compute(i: Record<string, number>): ComputeResult {
  const price = i.purchasePrice ?? 0;
  const units = Math.max(Math.round(i.units ?? 3), 1);
  const ownerOccupied = (i.ownerOccupied ?? 0) >= 1 ? 1 : 0;

  const effectiveDownPct = ownerOccupied
    ? i.ownerOccDownPaymentPct ?? 0.05
    : i.downPaymentPct ?? 0.25;

  const rate = i.interestRate ?? 0;
  const term = i.loanTermYears ?? 30;
  const vacancy = i.vacancyPct ?? 0;
  const rentGrowth = i.rentGrowthPct ?? 0;
  const expenseGrowth = i.expenseGrowthPct ?? 0;
  const appreciation = i.appreciationPct ?? 0;

  const rentableUnits = Math.max(units - (ownerOccupied ? 1 : 0), 0);
  const unitRentMonthly = i.avgUnitRentMonthly ?? 0;
  const grossRentAnnual0 = rentableUnits * unitRentMonthly * 12;

  const loanAmount = price * (1 - effectiveDownPct);
  const totalCashInvested = price * effectiveDownPct + price * (i.closingCostPct ?? 0);

  const grossRevenue = (y: number) => grossRentAnnual0 * Math.pow(1 + rentGrowth, y - 1);
  const effectiveRevenue = (y: number) => grossRevenue(y) * (1 - vacancy);
  const operatingExpenses = (y: number) => {
    const eg = Math.pow(1 + expenseGrowth, y - 1);
    const value = price * Math.pow(1 + appreciation, y - 1);
    return (
      value * (i.propertyTaxPct ?? 0) +
      (i.insuranceAnnual ?? 0) * eg +
      grossRevenue(y) * (i.maintenancePct ?? 0) +
      effectiveRevenue(y) * (i.managementPct ?? 0)
    );
  };

  const { core, projection, y1, debtService, noi } = computeHold({
    price, loanAmount, annualRate: rate, termYears: term, appreciation,
    grossRevenue, effectiveRevenue, operatingExpenses,
    totalCashInvested, sellingPct: i.sellingCostPct ?? 0, holdYears: i.holdYears ?? 5,
  });

  const warnings: string[] = [];
  if (ownerOccupied) {
    warnings.push(
      `Owner-occupied: only ${rentableUnits} of ${units} units produce rent, but the low ${(effectiveDownPct * 100).toFixed(0)}% down payment reflects owner-occupant financing — you also live there.`,
    );
  }
  const d = dscr(noi, debtService);
  if (Number.isFinite(d) && d < 1.2) warnings.push(`DSCR ${d.toFixed(2)}× is below 1.20.`);
  if (core.annualCashFlow < 0) warnings.push('Year-1 pre-tax cash flow is negative (depreciation not modeled).');

  return {
    metrics: {
      ...core,
      pricePerUnit: guardDiv(price, units),
      grm: grm(price, grossRevenue(1)),
      opexRatio: y1.effectiveRevenue > 0 ? y1.operatingExpenses / y1.effectiveRevenue : NaN,
    },
    projection,
    warnings,
  };
}

export const smallMultifamily: InvestmentModule = {
  id: 'small-multifamily',
  name: 'Small Multifamily (2–4 units)',
  category: 'Residential',
  tier: 'core',
  blurb: 'Duplex to fourplex on residential financing, with a house-hack toggle.',
  params: [
    { key: 'purchasePrice', label: 'Purchase price', type: 'currency', unit: '$', default: 640_000, min: 0, step: 5000, group: 'Financing', verify: true },
    { key: 'units', label: 'Number of units', type: 'integer', unit: 'count', default: 3, min: 2, max: 4, step: 1, group: 'Financing', help: 'Residential financing tops out at 4 units.' },
    { key: 'downPaymentPct', label: 'Down payment (investor)', type: 'percent', unit: '%', default: 0.25, min: 0, max: 1, step: 0.01, group: 'Financing', help: 'Used when not owner-occupied.' },
    { key: 'ownerOccupied', label: 'House-hack (owner-occupied)', type: 'integer', unit: 'count', default: 0, min: 0, max: 1, step: 1, group: 'Financing', help: '1 = you live in one unit. Enables low-down owner-occupant financing but removes one unit of rent.' },
    { key: 'ownerOccDownPaymentPct', label: 'Down payment (owner-occ)', type: 'percent', unit: '%', default: 0.05, min: 0, max: 1, step: 0.01, group: 'Financing', help: 'Owner-occupant loans (FHA/conventional) allow far less down. Applies only when house-hacking.' },
    { key: 'interestRate', label: 'Interest rate', type: 'percent', unit: '%', default: 0.075, min: 0, max: 0.2, step: 0.001, group: 'Financing', verify: true },
    { key: 'loanTermYears', label: 'Loan term', type: 'integer', unit: 'yr', default: 30, min: 1, max: 40, step: 1, group: 'Financing' },
    { key: 'closingCostPct', label: 'Closing costs', type: 'percent', unit: '%', default: 0.03, min: 0, max: 0.1, step: 0.005, group: 'Financing' },
    { key: 'avgUnitRentMonthly', label: 'Avg rent per unit', type: 'currency', unit: '$/mo', default: 1_450, min: 0, step: 50, group: 'Income', verify: true, help: 'Average monthly rent across units. Verify against comps for the unit mix.' },
    { key: 'vacancyPct', label: 'Vacancy', type: 'percent', unit: '%', default: 0.06, min: 0, max: 0.5, step: 0.01, group: 'Income' },
    { key: 'rentGrowthPct', label: 'Rent growth', type: 'percent', unit: '%', default: 0.03, min: 0, max: 0.15, step: 0.005, group: 'Income' },
    { key: 'propertyTaxPct', label: 'Property tax', type: 'percent', unit: '%', default: 0.011, min: 0, max: 0.05, step: 0.001, group: 'Expenses', verify: true, help: 'Annual, as a fraction of assessed value. Verify with the county assessor.' },
    { key: 'insuranceAnnual', label: 'Insurance', type: 'currency', unit: '$/yr', default: 2_600, min: 0, step: 100, group: 'Expenses', verify: true },
    { key: 'maintenancePct', label: 'Maintenance', type: 'percent', unit: '%', default: 0.09, min: 0, max: 0.3, step: 0.01, group: 'Expenses', help: 'Fraction of scheduled rent. More units, more turnover and repairs.' },
    { key: 'managementPct', label: 'Management', type: 'percent', unit: '%', default: 0.08, min: 0, max: 0.2, step: 0.01, group: 'Expenses', help: 'Fraction of collected rent. Set to 0 if self-managing.' },
    { key: 'expenseGrowthPct', label: 'Expense growth', type: 'percent', unit: '%', default: 0.025, min: 0, max: 0.15, step: 0.005, group: 'Expenses' },
    { key: 'appreciationPct', label: 'Appreciation', type: 'percent', unit: '%', default: 0.035, min: -0.1, max: 0.15, step: 0.005, group: 'Exit', help: 'Assumption, not a forecast.' },
    { key: 'holdYears', label: 'Hold period', type: 'integer', unit: 'yr', default: 5, min: 1, max: 30, step: 1, group: 'Exit' },
    { key: 'sellingCostPct', label: 'Selling costs', type: 'percent', unit: '%', default: 0.06, min: 0, max: 0.12, step: 0.005, group: 'Exit' },
  ],
  metrics: [
    { key: 'pricePerUnit', label: 'Price per unit', unit: '$', higherIsBetter: false, help: 'Purchase price / number of units.' },
    { key: 'grm', label: 'Gross rent multiplier', unit: 'x', higherIsBetter: false, help: 'Price / gross annual rent (rentable units only).' },
    { key: 'opexRatio', label: 'Operating expense ratio', unit: '%', higherIsBetter: false, help: 'Operating expenses / effective revenue.' },
  ],
  compute,
  narrative: {
    strategy:
      'Buy a 2–4 unit property — the sweet spot where you still qualify for **residential financing** (better rates, longer terms, lower down than commercial) while collecting several rent checks under one roof. The **house-hack toggle** models living in one unit: you give up that unit\'s rent but unlock owner-occupant loans that can require as little as 3.5–5% down, dramatically cutting the cash to get in. Per-unit economics and diversified vacancy (one empty unit is not zero income) are the structural advantages over a single-family rental.',
    risks: [
      'House-hacking trades rental income for cheap financing — verify the remaining units still cover the payment.',
      'More units mean more turnover, more repairs, and more tenant management than a single house.',
      'Small-multi in many markets is priced richly relative to rents; GRM and cap rate can be thin.',
      'Owner-occupant loans carry a residency requirement — moving out too early can breach loan terms.',
    ],
    opportunities: [
      'Residential financing on an income-producing asset — a genuine structural edge under 5 units.',
      'Diversified vacancy: a single empty unit still leaves the rest of the rent roll intact.',
      'House-hacking can let an owner live nearly for free while tenants retire the loan.',
    ],
    regulatory:
      'Confirm local rental-licensing and occupancy rules, and — if house-hacking — the owner-occupancy term your loan program requires before you can convert to a pure rental.',
    dataHooks: ['viirs-radiance'],
  },
};
