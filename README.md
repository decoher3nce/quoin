# Quoin

Real-estate investment analysis. Model many *kinds* of real-estate deals — not just rental
houses — tune the inputs, and read output metrics that let you evaluate and compare investments on
the same footing. Each investment type also carries written strategy, risks, and opportunities.

> A *quoin* is the dressed cornerstone that squares and strengthens a wall. This tool is meant to be
> the load-bearing corner of an investment decision: honest math you can lean on.

**Status: v2.** All 51 investment modules from the brief's Appendix A (traditional → creative) and
Appendix B (novel remote-sensing) are implemented end to end, each with a golden fixture. On top of
the v1 engine + comparison + export + stubbed data layer, v2 adds an optional after-tax layer,
sensitivity analysis, shareable scenario links, a saved-scenarios library, and a glossary. Defaults
are deliberately realistic (2026 prices/rates) rather than flattering — many deals show thin or
negative *pre-tax* cash flow, which is the truth the tool is meant to surface.

## Run / build / test

```bash
npm install
npm run dev        # Vite dev server (http://localhost:5173)
npm run build      # typecheck (tsc -b) + production build to dist/
npm run preview    # serve the production build
npm test           # Vitest — finance engine + module fixtures + xlsx export
npm run test:watch # Vitest in watch mode
npm run typecheck  # tsc -b, no emit
```

Node ≥ 20 recommended (developed on Node 25). No server, no network, no accounts — v1 is fully
client-side and persists your tuned inputs to `localStorage`.

## What's here

- **51 modules across 8 categories** — Land, Residential, Commercial, Hospitality, Paper, Value-add,
  Infrastructure, and Novel — built on four reusable math archetypes in `src/modules/_shapes.ts`:
  - **Income hold** (`computeHold`) — financed asset with annual NOI, held then sold: the LTR
    variants, commercial leases, storage, MHP, ag-lease, mid-term and STR-revenue holds.
  - **Flip / development** (`computeFlip`) — buy, spend, sell; no stabilized NOI, so operating-hold
    metrics are honestly `—`: fix-and-flip, entitled-lot-dev, adaptive-reuse, condo-conversion.
  - **Income stream** (`computeIncomeStream`) — deploy capital, receive a stream, maybe a terminal
    value: notes, lending, tax liens, REITs, ground/solar/cell/EV/billboard/datacenter leases.
  - **Bespoke** — BRRRR (refi cash-out with an infinite-return edge), conservation-easement
    (tax-benefit-driven), cohosting (labor-bound, capital metrics suppressed), and the novel
    remote-sensing theses whose `narrative` leads with novelty risk.
- **Sensitivity analysis** — on every hold module, a **tornado chart** ranks which inputs move a
  chosen output metric the most (each varied ±5/10/20%), plus a **two-way grid** (heatmap) of that
  metric across any two inputs, color-coded against the base case. Pure engine in
  `src/core/sensitivity.ts` (tested for ranking + monotonicity); composes each module's `compute()`.
- **Comparison view** — pick 2–4 modules, see the core metric contract side by side, best-per-row
  highlighted for higher-is-better metrics.
- **Export** — `.xlsx` (SheetJS; Inputs / Metrics / Projection sheets, or one Comparison sheet) and
  `.pdf` (jsPDF + autotable) behind a single swappable `exportPdf(target)` entry point.
- **Shareable scenario links** — a **Share** button copies a link that encodes the module + its tuned
  inputs (deltas only) + the after-tax view (or a whole comparison) into the URL hash. Opening it
  restores the exact scenario. Pure codec in `src/core/share.ts` (round-trip tested); the link is
  applied to `localStorage` at startup so the normal state hooks pick it up (`src/state/scenario.ts`).
- **Saved scenarios** — a **Save** button stores a tuned deal under a name; the **Saved** view is a
  library of your deals with each one's key metrics recomputed live, plus Load / Rename / Delete. Pure
  CRUD in `src/core/scenarios.ts` (tested); persisted to `localStorage`.
- **Assumptions & limits** panel — persistent, dismissible; states what the model does *not* do.
- **After-tax modeling** (optional) — on depreciable buy-and-hold modules, a toggle layers
  depreciation, income tax, and recapture + capital-gains at sale over the pre-tax view, with editable
  rates. Engine in `src/core/tax.ts` (hand-verified test); depreciability policy is one auditable
  table in `src/modules/index.ts`. Fully integrated: the module view's tax panel, an **After-tax
  sheet** in the `.xlsx` export and an after-tax section in the `.pdf`, and an **after-tax toggle in
  the comparison view** (tax-affected rows relabeled; non-depreciable assets fall back to pre-tax,
  marked `*`).
- **Glossary** — an on-site, searchable reference for every acronym and term (NOI, DSCR, IRR, ADR,
  BRRRR, NNN, TI/LC, MACRS, recapture, InSAR, SWE, …), grouped by area with clickable cross-references
  (`src/core/glossary.ts`). A data test guards uniqueness and against dangling "see also" links.
- **Collapsible nav** — the left category groups collapse/expand (state persisted to `localStorage`);
  searching temporarily expands everything to show matches.
- **Stubbed data layer** — `DataSource` interface only; modules declare desired signals in
  `narrative.dataHooks`, and the UI shows "future: will pull X".

## Architecture

Every investment type is a **self-contained plugin** implementing `InvestmentModule`
(`src/core/types.ts`) and registered in `src/modules/index.ts`. The UI is generic — it renders any
module from its `params` / `metrics` / `narrative`. There is **no investment-specific UI code**.

```
src/
  core/
    types.ts        # the plugin contract + shared types
    finance.ts      # pure, tested primitives: pmt, loanBalance, npv, irr, capRate, dscr, grm, guardDiv
    metrics.ts      # CORE_METRICS contract + ordering helpers
    units.ts        # display formatting by Unit / ParamType
    data.ts         # DataSource interface + NullDataSource stub + signal catalog
  modules/
    index.ts        # MODULES registry
    _projection.ts  # shared hold-projection builder (composes finance.ts)
    metro-condo-ltr.ts, raw-land.ts, str-metro.ts
    __fixtures__/   # golden inputs → expected metrics, tolerance-checked
  components/       # generic panes: Inputs, Metrics, Projection, Narrative, TabNav, Comparison, …
  export/           # xlsx.ts, pdf.ts (both with a build/download seam)
  state/            # localStorage-backed input state + persistent dismiss
```

### The core metric contract

So the comparison view can line any two modules up, **every** module's `compute().metrics` must
include the `CORE_METRICS` keys (`src/core/metrics.ts`): `annualCashFlow`, `monthlyCashFlow`,
`cashOnCash`, `capRate`, `dscr`, `irr5yr`, `totalCashInvested`. A contract test enforces this.
Modules may add their own metrics beyond the core set (e.g. `breakEvenOccupancy`, `pricePerAcre`).

Conventions worth knowing:

- **Percents are fractions everywhere internally** (`0.07` === 7%). The UI edits them as whole
  percents; `units.ts` converts at the boundary.
- **`compute` is pure** — no side effects, no fetch. Live recompute on every keystroke is cheap.
- **`irr5yr` is standardized to a 5-year hold** for cross-module comparability, even when a module's
  displayed projection uses a different `holdYears`.

## How to add a module (the plugin contract)

1. Create `src/modules/<your-id>.ts` exporting an `InvestmentModule`:
   - `params: ParamSpec[]` — grouped inputs with defaults, `min/max/step`, `help`, and `verify: true`
     on any input the user must confirm against a primary source.
   - `compute(inputs) => { metrics, projection?, warnings? }` — compose `finance.ts` primitives; for
     a hold strategy, use `buildProjection` / `holdCashflows` from `_projection.ts`. **Must** return
     every `CORE_METRICS` key.
   - `metrics: MetricSpec[]` — specs for any metric *beyond* the core set that `compute` returns.
   - `narrative` — `strategy` (markdown-ish; `**bold**` supported), `risks`, `opportunities`,
     optional `regulatory`, optional `dataHooks`.
2. Register it: import and add to `MODULES` in `src/modules/index.ts`.
3. Generate a golden fixture: `npx vite-node scripts/gen-fixtures.ts`, eyeball the printed numbers,
   commit the fixture. The registry contract test and golden test pick it up automatically.

Nothing in `src/core` or `src/components` needs to change.

## Known modeling caveats

Surfaced in-app (Assumptions & limits panel and each module's narrative), repeated here:

- **Pre-tax by default, with an optional after-tax layer.** Depreciable buy-and-hold modules offer an
  after-tax toggle (straight-line depreciation, marginal-rate income tax, and depreciation-recapture
  plus capital-gains tax at sale). It's a planning estimate with stated simplifications — flat rate,
  passive-loss limits ignored, no 1031/NIIT/AMT — not tax advice. Flips, land, notes/REITs/LP, and
  personal-use property have no toggle by design (different tax regimes).
- **IRR uses modeled cash flows + a modeled sale.** Appreciation and growth are assumptions, not
  forecasts.
- PM, maintenance, and vacancy are fractions of rent/revenue; real costs are lumpy.
- `verify: true` inputs (rates, taxes, HOA, insurance, ADR/occupancy, STR legality) move results the
  most and are **not** authoritative here.

## Tech

React 19 · TypeScript (strict) · Vite · Tailwind v4 · Vitest · SheetJS (`xlsx`) · jsPDF +
jspdf-autotable. See `DECISIONS.md` for non-obvious choices and `prompts/` for the AI-dev trail.
