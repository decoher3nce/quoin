import type { InvestmentModule, ComputeResult } from '../core/types';
import { guardDiv, npv } from '../core/finance';
import { computeIncomeStream } from './_shapes';

// Latency Microparcel. A tiny site whose value is not its acreage but its
// NETWORK distance to fiber and an internet exchange (IX) — the meters of
// trenching between the pad and lit fiber that determine round-trip latency for
// an edge-compute deployment. Buy the microparcel, build out a small pad/power/
// backhaul, and lease it to an edge operator for an escalating ground rent plus
// the land reversion. The novelty: the asset is a network-topology fact, priced
// by proximity to infrastructure, not by real-estate comps.

function compute(i: Record<string, number>): ComputeResult {
  const parcelCost = i.parcelCost ?? 0;
  const fiberDistanceMeters = i.fiberDistanceMeters ?? 0;
  const buildoutCost = i.buildoutCost ?? 0;
  const annualLease = i.annualLease ?? 0;
  const escalationPct = i.escalationPct ?? 0;
  const leaseTermYears = Math.round(i.leaseTermYears ?? 10);
  const appreciationPct = i.appreciationPct ?? 0;
  const discountRate = i.discountRate ?? 0;

  const capital = parcelCost + buildoutCost;
  const year1Income = annualLease;

  // Five modeled years of escalating ground rent for the standardized 5-yr core.
  const annualCashflows = Array.from({ length: 5 }, (_, k) =>
    year1Income * Math.pow(1 + escalationPct, k),
  );
  const terminalValue = parcelCost * Math.pow(1 + appreciationPct, 5);

  const core = computeIncomeStream({
    capital,
    assetPrice: capital,
    annualCashflows,
    terminalValue,
    debtServiceAnnual: 0,
    noiAnnual: year1Income,
  });

  const fullTermCashflows = Array.from({ length: leaseTermYears }, (_, k) =>
    year1Income * Math.pow(1 + escalationPct, k),
  );
  const npvOfLease = npv(discountRate, [-capital, ...fullTermCashflows, terminalValue]);

  const yieldOnCost = guardDiv(annualLease, capital);
  const fiberProximityMeters = fiberDistanceMeters;

  const warnings: string[] = [
    'Edge-compute demand at the micro-parcel scale is unproven — the tenant base is speculative and could consolidate into carrier-owned sites.',
  ];
  if (year1Income <= 0)
    warnings.push('No lease income modeled — without a signed edge tenant this is a specialized micro-lot carry.');
  if (npvOfLease < 0)
    warnings.push('Full-term lease NPV is negative at this discount rate — the modeled rent does not clear the cost of capital.');

  return {
    metrics: {
      ...core,
      yieldOnCost,
      npvOfLease,
      fiberProximityMeters,
    },
    warnings,
  };
}

export const latencyMicroparcel: InvestmentModule = {
  id: 'latency-microparcel',
  name: 'Latency Microparcel — Edge Site',
  category: 'Novel',
  tier: 'novel',
  blurb: 'Micro-site valued by network distance to fiber/IX, leased to an edge operator.',
  params: [
    { key: 'parcelCost', label: 'Parcel cost', type: 'currency', unit: '$', default: 60_000, min: 0, step: 2500, group: 'Acquisition', verify: true, help: 'Cost of the micro-lot. Verify the proximity claim (meters to lit fiber / IX) — that, not the dirt, is what you are buying.' },
    { key: 'fiberDistanceMeters', label: 'Distance to lit fiber', type: 'number', unit: 'count', default: 400, min: 0, step: 25, group: 'Acquisition', verify: true, help: 'Meters to the nearest lit fiber route. Drives latency and trenching cost — the whole thesis. Verify with the carrier, not a map.' },
    { key: 'buildoutCost', label: 'Site buildout', type: 'currency', unit: '$', default: 90_000, min: 0, step: 5000, group: 'Acquisition', help: 'Pad, power, cooling shell, and fiber backhaul trenching to lit fiber. Up-front capex; scales with distance.' },

    { key: 'annualLease', label: 'Annual ground lease', type: 'currency', unit: '$/yr', default: 28_000, min: 0, step: 1000, group: 'Income', verify: true, help: 'The thesis. Verify against a signed or letter-of-intent edge-operator lease — little public comparable data exists.' },
    { key: 'escalationPct', label: 'Lease escalation', type: 'percent', unit: '%', default: 0.03, min: 0, max: 0.1, step: 0.005, group: 'Income', verify: true },
    { key: 'leaseTermYears', label: 'Lease term', type: 'integer', unit: 'yr', default: 10, min: 1, max: 30, step: 1, group: 'Income', verify: true, help: 'Primary term. Edge tenants in a fast-moving market may resist long commitments.' },

    { key: 'appreciationPct', label: 'Land appreciation', type: 'percent', unit: '%', default: 0.02, min: -0.1, max: 0.15, step: 0.005, group: 'Exit', verify: true, help: 'Modest by assumption — a single-purpose edge micro-site is illiquid.' },
    { key: 'discountRate', label: 'Discount rate', type: 'percent', unit: '%', default: 0.11, min: 0, max: 0.3, step: 0.005, group: 'Exit', help: 'High, reflecting unproven edge-compute demand and exit-liquidity risk.' },
    { key: 'holdYears', label: 'Hold period', type: 'integer', unit: 'yr', default: 5, min: 1, max: 30, step: 1, group: 'Exit' },
  ],
  metrics: [
    { key: 'yieldOnCost', label: 'Yield on cost', unit: '%', higherIsBetter: true, help: 'Year-1 ground lease / (parcel + buildout).' },
    { key: 'npvOfLease', label: 'NPV of lease', unit: '$', higherIsBetter: true, help: 'Present value of the full-term escalating rent plus land reversion, net of capital, at the discount rate.' },
    { key: 'fiberProximityMeters', label: 'Distance to fiber', unit: 'count', higherIsBetter: false, help: 'Meters to lit fiber — the topology fact the value rests on. Fewer is better.' },
  ],
  compute,
  narrative: {
    strategy:
      'Buy a **micro-parcel** whose worth has nothing to do with its size and everything to do with its **network distance to fiber and an internet exchange**, then lease it to an edge-compute operator that needs a low-latency pad close to lit fiber. The edge is measuring an asset the market cannot yet price: **network topology — the meters to fiber/IX** — a networking fact, not a real-estate fact, that land comps are blind to. If edge compute pushes workloads out of core data centers toward users, a proven low-latency site becomes scarce infrastructure; if it does not, you own a tiny specialized lot with a very narrow tenant pool.',
    risks: [
      'Novelty risk: thin comps, uncertain exit liquidity, the thesis may simply be wrong — micro-scale edge-compute demand is unproven and may never materialize as a leasing market.',
      'Single-purpose, single-tenant: value depends on a small set of edge operators; losing the tenant strands a lot no one else wants.',
      'The latency advantage is fragile — a new fiber route, a carrier lighting different strands, or a nearby carrier-neutral facility can erase your proximity premium overnight.',
      'Buildout and trenching costs to lit fiber can exceed estimates, and carrier access/cross-connect terms may not materialize as assumed.',
    ],
    opportunities: [
      'If edge workloads scale, verified low-latency sites near fiber/IX are genuinely scarce and hard to replicate quickly.',
      'A signed, escalating lease to a credible operator is a bond-like coupon on top of land you keep.',
      'Proximity to an IX can attract multiple network-dependent tenants (edge, wireless backhaul, small-cell aggregation) beyond a single operator.',
    ],
    regulatory:
      'Confirm zoning for a small data/telecom use, fiber-access and pole/conduit or trenching rights to reach lit fiber, power-service availability and capacity, and any carrier cross-connect terms at the IX. The proximity thesis is only bankable if the physical and contractual right to connect actually exists.',
    dataHooks: ['fiber-distance', 'ix-distance'],
  },
};
