import type { InvestmentModule, ComputeResult } from '../core/types';
import { dscr, guardDiv } from '../core/finance';
import { computeHold } from './_shapes';

// Event Venue. A barn, hall, or estate booked for weddings and events. Revenue is
// per event at a high ticket, against a heavy FIXED cost base (staff, utilities,
// insurance, marketing) and booking demand that concentrates on weekends and a
// short season. Few bookings, each large — so the number of events, not occupancy,
// is the driver, and the break-even event count is the number that matters.

function compute(i: Record<string, number>): ComputeResult {
  const purchasePrice = i.purchasePrice ?? 0;
  const renovationBudget = i.renovationBudget ?? 0;
  const price = purchasePrice + renovationBudget;
  const downPct = i.downPaymentPct ?? 0;
  const rate = i.interestRate ?? 0;
  const term = i.loanTermYears ?? 20;
  const closingPct = i.closingCostPct ?? 0;

  const eventsPerYear = i.eventsPerYear ?? 0;
  const avgRevenuePerEvent = i.avgRevenuePerEvent ?? 0;
  const variableCostPerEvent = i.variableCostPerEvent ?? 0;
  const fixedOpexAnnual = i.fixedOpexAnnual ?? 0;
  const revGrowth = i.revGrowthPct ?? 0;

  const loanAmount = purchasePrice * (1 - downPct);
  const totalCashInvested = purchasePrice * downPct + purchasePrice * closingPct + renovationBudget;

  const grossRevenue = (y: number) => eventsPerYear * avgRevenuePerEvent * Math.pow(1 + revGrowth, y - 1);
  const effectiveRevenue = (y: number) => grossRevenue(y);
  const operatingExpenses = (y: number) => {
    const g = Math.pow(1 + revGrowth, y - 1);
    return eventsPerYear * variableCostPerEvent * g + fixedOpexAnnual * g;
  };

  const { core, projection, debtService, noi } = computeHold({
    price, loanAmount, annualRate: rate, termYears: term, appreciation: i.appreciationPct ?? 0,
    grossRevenue, effectiveRevenue, operatingExpenses,
    totalCashInvested, sellingPct: i.sellingCostPct ?? 0, holdYears: i.holdYears ?? 5,
  });

  const contributionPerEvent = avgRevenuePerEvent - variableCostPerEvent;
  const breakEvenEvents = guardDiv(fixedOpexAnnual + debtService, contributionPerEvent);
  const grossMarginPerEvent = guardDiv(contributionPerEvent, avgRevenuePerEvent);

  const warnings: string[] = [];
  const d = dscr(noi, debtService);
  if (Number.isFinite(breakEvenEvents) && breakEvenEvents > eventsPerYear)
    warnings.push(`Break-even needs ${breakEvenEvents.toFixed(0)} events/yr but only ${eventsPerYear.toFixed(0)} are modeled — this configuration loses money.`);
  if (Number.isFinite(breakEvenEvents) && breakEvenEvents > eventsPerYear * 0.8)
    warnings.push(`Break-even at ${breakEvenEvents.toFixed(0)} of ${eventsPerYear.toFixed(0)} events leaves little cushion for a soft booking season.`);
  if (Number.isFinite(d) && d < 1.3) warnings.push(`DSCR ${d.toFixed(2)}× is below 1.30 — high fixed cost makes lenders cautious.`);
  if (core.annualCashFlow < 0) warnings.push('Year-1 pre-tax cash flow is negative.');

  return {
    metrics: { ...core, revenuePerEvent: avgRevenuePerEvent, breakEvenEvents, grossMarginPerEvent },
    projection,
    warnings,
  };
}

export const eventVenue: InvestmentModule = {
  id: 'event-venue',
  name: 'Event Venue',
  category: 'Hospitality',
  tier: 'creative',
  blurb: 'Weddings/events by the booking: high revenue per event, heavy fixed cost, weekend/seasonal concentration.',
  params: [
    { key: 'purchasePrice', label: 'Purchase price', type: 'currency', unit: '$', default: 1_100_000, min: 0, step: 25_000, group: 'Acquisition', verify: true, help: 'Verify the property is zoned for assembly/events — the single biggest value driver and risk.' },
    { key: 'renovationBudget', label: 'Renovation budget', type: 'currency', unit: '$', default: 250_000, min: 0, step: 10_000, group: 'Acquisition', verify: true, help: 'Assembly-occupancy upgrades: restrooms, parking, ADA, fire/life-safety, catering prep. Verify against bids.' },
    { key: 'downPaymentPct', label: 'Down payment', type: 'percent', unit: '%', default: 0.3, min: 0, max: 1, step: 0.01, group: 'Financing', help: 'Special-use commercial lending wants substantial equity.' },
    { key: 'interestRate', label: 'Interest rate', type: 'percent', unit: '%', default: 0.08, min: 0, max: 0.2, step: 0.001, group: 'Financing', verify: true },
    { key: 'loanTermYears', label: 'Loan term', type: 'integer', unit: 'yr', default: 20, min: 1, max: 30, step: 1, group: 'Financing' },
    { key: 'closingCostPct', label: 'Closing costs', type: 'percent', unit: '%', default: 0.03, min: 0, max: 0.1, step: 0.005, group: 'Financing' },

    { key: 'eventsPerYear', label: 'Events per year', type: 'integer', unit: 'count', default: 45, min: 0, step: 1, group: 'Operations', verify: true, help: 'Bookings per year. Weekend/seasonal concentration caps the realistic count — verify against comparable venues.' },
    { key: 'avgRevenuePerEvent', label: 'Avg revenue per event', type: 'currency', unit: '$', default: 6_500, min: 0, step: 250, group: 'Operations', verify: true, help: 'Venue fee plus in-house services. Verify against the local wedding/event market, not aspirational packages.' },
    { key: 'variableCostPerEvent', label: 'Variable cost per event', type: 'currency', unit: '$', default: 1_800, min: 0, step: 100, group: 'Operations', help: 'Event staff, cleaning, consumables, day-of coordination — costs that scale per booking.' },
    { key: 'fixedOpexAnnual', label: 'Fixed operating cost', type: 'currency', unit: '$/yr', default: 120_000, min: 0, step: 5000, group: 'Operations', help: 'Base staff, utilities, insurance, and marketing — paid whether or not the calendar fills.' },
    { key: 'revGrowthPct', label: 'Revenue growth', type: 'percent', unit: '%', default: 0.03, min: -0.1, max: 0.15, step: 0.005, group: 'Operations' },

    { key: 'appreciationPct', label: 'Appreciation', type: 'percent', unit: '%', default: 0.02, min: -0.1, max: 0.15, step: 0.005, group: 'Exit', help: 'Special-use property; value tracks income more than land inflation — kept conservative.' },
    { key: 'holdYears', label: 'Hold period', type: 'integer', unit: 'yr', default: 5, min: 1, max: 30, step: 1, group: 'Exit' },
    { key: 'sellingCostPct', label: 'Selling costs', type: 'percent', unit: '%', default: 0.06, min: 0, max: 0.12, step: 0.005, group: 'Exit', help: 'Special-use venues sell to a thin buyer pool — expect higher frictions and longer marketing.' },
  ],
  metrics: [
    { key: 'revenuePerEvent', label: 'Revenue per event', unit: '$', higherIsBetter: true, help: 'Average all-in revenue per booking.' },
    { key: 'breakEvenEvents', label: 'Break-even events', unit: 'count', higherIsBetter: false, help: 'Events per year needed to cover fixed cost and debt: (fixed + debt) ÷ contribution per event.' },
    { key: 'grossMarginPerEvent', label: 'Gross margin per event', unit: '%', higherIsBetter: true, help: '1 − variable cost / revenue. The contribution each booking makes toward fixed cost.' },
  ],
  compute,
  narrative: {
    strategy:
      'Own and operate a venue — barn, hall, or estate — booked for weddings and events. Each booking is a **high-ticket sale**, but there are relatively few of them and a **heavy fixed cost base** (staff, utilities, insurance, marketing) runs whether or not the calendar fills. Demand concentrates on weekends and a short peak season, so the driver is the **number of events**, and the deal hinges on the break-even event count: how many bookings are needed before the venue makes money at all.',
    risks: [
      'High operating leverage: a large fixed cost against few bookings means a soft season swings straight to the bottom line.',
      'Booking concentration — weekends and a short peak season cap the realistic event count; midweek and off-season sit largely idle.',
      'Reputation- and marketing-dependent: reviews, referrals, and planner relationships drive bookings, and one bad season compounds.',
      'Long lead times and deposit/cancellation exposure; special-use property is illiquid and sells to a thin buyer pool.',
    ],
    opportunities: [
      'Ancillary revenue — in-house catering, bar, rentals, lodging, and vendor commissions can rival the base venue fee.',
      'Pricing power for a differentiated, well-reviewed venue in a supply-constrained market; premium dates command premiums.',
      'Weekday, corporate, and off-season programming can backfill the calendar and lift the event count above the wedding base.',
    ],
    regulatory:
      'Assembly-occupancy use is the gating issue. Verify zoning permits commercial events (rural and residential-adjacent parcels frequently do not), and confirm the assembly occupancy permit, parking and ADA requirements, fire/life-safety code, noise ordinances, and liquor licensing or bring-your-own rules. Neighbor opposition and conditional-use conditions (event caps, curfews) are common — confirm the legal event count and hours before relying on the booking model.',
    dataHooks: ['viirs-radiance'],
  },
};
