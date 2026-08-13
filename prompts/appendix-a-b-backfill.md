# Appendix A + B backfill

The remaining 48 modules (everything past the three skeleton modules and `townhome-ltr`) were
authored in one coordinated pass, parallelized by category. Each category was given the same hard
contract and a per-module spec (id, name, tier, math shape + which `_shapes` helper to use, realistic
2026 default inputs with `verify:true` on swing inputs, the module-specific metrics, and narrative
pointers). This file records that intent so the trail is auditable; the enforced contract lived in
the prompt and is now enforced permanently by `src/modules/modules.test.ts`.

## The contract every module was authored against

1. `compute()` returns all 7 `CORE_METRICS` keys by spreading a `_shapes` helper's `CoreMetrics`
   object. Metrics that don't apply to a shape are `NaN` (render `—`) — never faked.
2. Every non-core metric returned has a matching `MetricSpec` in `metrics: []`, and vice-versa.
3. Percents are fractions; TypeScript strict, no `any`.
4. Realistic 2026 defaults, not flattering ones; `verify: true` on the inputs that move results.
5. `narrative` = strategy + risks + opportunities + optional regulatory + optional `dataHooks`.
   Novel (Appendix B) modules lead `risks` with the novelty-risk disclaimer and state the
   information-asymmetry thesis plainly in `strategy`.

## Categories and shapes

- **Land** — raw-land (carry), entitled-lot-dev (flip), ag-land-lease (hold), timber-mineral-rights
  (declining income stream + NPV), conservation-easement (bespoke, tax-benefit-driven, not advice).
- **Residential** — condo/townhome/sfr/small-multifamily/mid-* (income hold), large-multifamily-lp
  (income stream), mountain-second-home (lifestyle hold), fix-and-flip (flip), brrrr (hold + refi
  cash-out with the infinite-return edge).
- **Commercial** — nnn-retail, office, industrial-flex, medical-office, self-storage, mobile-home-park
  (all income holds; office/MOB carry a TI/LC drag line).
- **Hospitality** — str-metro/mountain/owner-occupied/experiential, mid-term, snowpack-indexed,
  darksky (STR-revenue holds + break-even occupancy); str-arbitrage & str-cohosting (income stream,
  no ownership); boutique-motel, glamping-rv, event-venue (operating holds).
- **Paper** — private-lending, mortgage-notes, tax-lien-deed, ground-lease, reit, syndication-lp
  (income streams; several add YTM / NPV / equity-multiple module metrics).
- **Value-add** — adu-build (incremental hold), adaptive-reuse & condo-conversion (flips).
- **Infrastructure** — solar / cell-tower / ev-charging / billboard / datacenter (long-dated income
  streams + full-term NPV).
- **Novel (Appendix B)** — optical-ground-station, insar-stable-land, darksky-astro-str,
  viewshed-easement, wildfire-hardened-arb, snowpack-indexed-str, latency-microparcel,
  frostpocket-cropland. Each declares the geo/time-series `dataHooks` it will one day consume.

## Post-integration corrections

See `DECISIONS.md` → "Backfilling all 51 modules" for the honesty fixes made after the first
integration (str-cohosting capital-metric suppression; solar / glamping / adaptive-reuse default
corrections). Fixtures were regenerated from the corrected defaults.
