import type { InvestmentModule, ComputeResult } from '../core/types';
import { guardDiv } from '../core/finance';
import { computeIncomeStream } from './_shapes';

// Viewshed Easement. Acquire the parcel that CONTROLS a sightline — the land a
// neighbor's view (or a neighbor's fear of a future obstruction) depends on —
// then sell a view easement to the benefited parcel. This is a pure optionality
// play: you monetize control of a sightline, not the dirt. The proceeds are a
// one-time, negotiated, probabilistic event, so the model is expected-value:
// carry the parcel through a negotiation window, then realize a probability-
// weighted easement payment plus the residual land value. cap rate is negative
// (carry only); the whole return hinges on a single counterparty negotiation.

function compute(i: Record<string, number>): ComputeResult {
  const controllingParcelCost = i.controllingParcelCost ?? 0;
  const easementValueToNeighbor = i.easementValueToNeighbor ?? 0;
  const negotiationProbability = i.negotiationProbability ?? 0;
  const annualCarryCost = i.annualCarryCost ?? 0;
  const yearsToClose = Math.round(i.yearsToClose ?? 3);
  const residualParcelValue = i.residualParcelValue ?? 0;

  const capital = controllingParcelCost;
  const expectedEasementProceeds = easementValueToNeighbor * negotiationProbability;

  // Carry the parcel each year of the negotiation window (negative cashflows),
  // then realize the expected easement proceeds plus the residual land at the end.
  const annualCashflows = Array.from({ length: yearsToClose }, () => -annualCarryCost);
  const terminalValue = expectedEasementProceeds + residualParcelValue;

  const core = computeIncomeStream({
    capital,
    assetPrice: controllingParcelCost,
    annualCashflows,
    terminalValue,
    debtServiceAnnual: 0,
    noiAnnual: -annualCarryCost,
  });

  const expectedEasementValue = expectedEasementProceeds;
  const probabilityWeightedMultiple = guardDiv(
    expectedEasementProceeds + residualParcelValue,
    controllingParcelCost,
  );

  const warnings: string[] = [
    'The payoff is one-time, negotiated, and probabilistic — expected value, not a schedule. A single counterparty can simply say no.',
  ];
  if (negotiationProbability <= 0)
    warnings.push('Negotiation probability is zero — no expected easement value; you own a carry-only parcel.');
  if (probabilityWeightedMultiple < 1)
    warnings.push('Probability-weighted proceeds are below the parcel cost — the base case does not recover capital without appreciation.');

  return {
    metrics: {
      ...core,
      expectedEasementValue,
      probabilityWeightedMultiple,
      negotiationProbability,
    },
    warnings,
  };
}

export const viewshedEasement: InvestmentModule = {
  id: 'viewshed-easement',
  name: 'Viewshed Easement — Sightline Control',
  category: 'Novel',
  tier: 'novel',
  blurb: 'Control a sightline-defining parcel, then sell a view easement to the neighbor.',
  params: [
    { key: 'controllingParcelCost', label: 'Controlling parcel cost', type: 'currency', unit: '$', default: 150_000, min: 0, step: 5000, group: 'Acquisition', verify: true, help: 'All-in cost to buy the parcel that controls the sightline. Verify it actually controls the view (survey the line of sight).' },
    { key: 'residualParcelValue', label: 'Residual parcel value', type: 'currency', unit: '$', default: 140_000, min: 0, step: 5000, group: 'Acquisition', help: 'What the parcel is worth after granting the easement — you keep the land, encumbered.' },

    { key: 'easementValueToNeighbor', label: 'Easement value to neighbor', type: 'currency', unit: '$', default: 120_000, min: 0, step: 5000, group: 'Deal', verify: true, help: 'What preserving the view is worth to the benefited parcel. Verify against the uplift a protected view adds to THAT property.' },
    { key: 'negotiationProbability', label: 'Negotiation success probability', type: 'percent', unit: '%', default: 0.5, min: 0, max: 1, step: 0.05, group: 'Deal', verify: true, help: 'Probability the neighbor actually agrees and closes. A single-counterparty deal — be honest and pessimistic.' },
    { key: 'annualCarryCost', label: 'Annual carry cost', type: 'currency', unit: '$/yr', default: 1_200, min: 0, step: 50, group: 'Deal', help: 'Tax, liability, and upkeep while negotiating.' },
    { key: 'yearsToClose', label: 'Years to close', type: 'integer', unit: 'yr', default: 3, min: 1, max: 15, step: 1, group: 'Deal', help: 'Negotiation window before the easement (if any) is realized.' },

    { key: 'holdYears', label: 'Hold period', type: 'integer', unit: 'yr', default: 5, min: 1, max: 30, step: 1, group: 'Exit' },
  ],
  metrics: [
    { key: 'expectedEasementValue', label: 'Expected easement value', unit: '$', higherIsBetter: true, help: 'Easement value to neighbor × success probability — the probability-weighted proceeds.' },
    { key: 'probabilityWeightedMultiple', label: 'Prob-weighted multiple', unit: 'x', higherIsBetter: true, help: '(Expected easement proceeds + residual land) / parcel cost.' },
    { key: 'negotiationProbability', label: 'Negotiation probability', unit: '%', higherIsBetter: true, help: 'Assumed probability the single counterparty agrees and closes.' },
  ],
  compute,
  narrative: {
    strategy:
      'Buy the parcel that **controls a sightline** — the land a neighboring property\'s view depends on, or could be blocked by — and then sell that neighbor a **view easement** that permanently protects (or unblocks) the sightline. The edge is measuring an asset the market cannot yet price: **control of a sightline**, an optionality/information play where value comes not from the dirt but from the fact that one specific benefited parcel needs what you hold. This is pure negotiation optionality: you carry the parcel through a negotiation window and realize a one-time, probability-weighted payment if — and only if — a single counterparty agrees.',
    risks: [
      'Novelty risk: thin comps, uncertain exit liquidity, the thesis may simply be wrong — view-easement transactions are idiosyncratic and rarely trade, so both value and probability are guesses.',
      'Single-counterparty dependence: the entire payoff hinges on one neighbor choosing to deal; they can wait you out, refuse, or litigate, and you have no second buyer.',
      'The neighbor may not actually need the easement — existing zoning, height limits, or covenants might already protect their view for free, collapsing your leverage.',
      'Carry is certain and the catalyst is not; a long, failed negotiation is a pure loss net of carry.',
    ],
    opportunities: [
      'If the view genuinely drives the neighbor\'s property value, the easement can be worth a large fraction of that uplift — an asymmetric payoff on a modest parcel.',
      'You retain the (encumbered) land whether or not the deal closes, providing a residual floor.',
      'The same control can be monetized other ways — a development-rights sale, a billboard/antenna sightline, or simply holding for appreciation.',
    ],
    regulatory:
      'View and conservation easements are creatures of state property law and must be properly drafted, recorded, and (often) appraised to be enforceable and, if donated, deductible. Confirm that existing zoning or covenants do not already grant the neighbor the protection, and involve counsel before assuming any easement can be created or sold.',
    dataHooks: ['dem-line-of-sight'],
  },
};
