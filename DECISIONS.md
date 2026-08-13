# Decisions

Non-obvious choices made building Quoin. Newest first.

## After-tax layer: opt-in, gated, and honest about its simplifications

The biggest gap in decision-usefulness was that everything was pre-tax, which makes real
buy-and-holds look worse than they are (depreciation is a non-cash shelter). Added an optional
after-tax layer (`src/core/tax.ts`): straight-line depreciation → marginal-rate income tax during the
hold, then depreciation recapture (§1250, capped 25%) + long-term capital gains on the modeled sale,
and an after-tax IRR.

Design choices:

- **Opt-in per asset, via one central table.** After-tax modeling only fits depreciable *held* real
  property, so it's gated behind a `taxProfile`. Rather than edit 20+ module files, the depreciability
  policy lives in one auditable `TAX_PROFILES` table in `src/modules/index.ts` — you can see at a
  glance which assets are depreciable (27.5-yr residential / 39-yr commercial) and, by their absence,
  which are deliberately excluded: flips (ordinary income / dealer), raw land & land leases (no
  depreciation), notes/REITs/LP (different regimes), and personal-use property (vacation-home rules).
  Modules stay pure; they don't know about tax.
- **`interest` added to `YearRow`, computed once in `buildProjection`.** Taxable income needs the
  deductible-interest portion of debt service. Computing it in the shared projection builder means
  every hold module gets it for free with zero per-module edits, and it doesn't change any pre-tax
  metric (fixtures unaffected).
- **Correctness first.** The tax math is where sign/unit errors hide, so `computeAfterTax` is unit
  tested against a fully hand-worked example (depreciation, taxable income, the recapture/cap-gains
  split, and after-tax sale proceeds all checked by hand).
- **Simplifications surfaced, not hidden.** Flat marginal rate, passive-activity-loss limits ignored
  (losses assumed usable in-year), basis = purchase price, no 1031/NIIT/AMT/state — all stated in the
  panel and glossary, framed as a planning estimate, not tax advice. Global toggle + editable rates so
  the user owns the assumptions.

## Backfilling all 51 modules: four archetypes + parallel authoring

After the skeleton was approved, the remaining ~48 modules were built by (a) factoring the recurring
math into four archetypes in `src/modules/_shapes.ts` — `computeHold`, `computeFlip`,
`computeIncomeStream`, plus bespoke — so no module re-derives the core-metric assembly, and (b)
authoring the categories in parallel, then integrating centrally: one registry edit, one fixture
generation pass, one typecheck, one test run. The contract test (`assertCoreMetrics` + metric-spec
symmetry + "every module has a fixture") is what makes parallel authoring safe — a mis-wired module
fails the suite rather than silently shipping.

Integration caught exactly the class of issues you'd expect: three `noUnusedLocals` violations, and a
handful of modules whose *defaults* were too rosy. Fixes made in the spirit of "realistic, not
flattering":

- **str-cohosting**: capital-based returns (cash-on-cash, IRR) were astronomically high only because
  the capital base is trivial — it's a labor business. Those core metrics are now suppressed to `NaN`
  (render `—`) with a warning; `effectiveHourlyRate` and `roicOnSetup` carry the real signal. This is
  a *structural* honesty fix, not a default tweak.
- **solar-land-lease** (land price was inconsistent with the lease rate → 55% yield), **glamping-rv**
  (occupancy/opex too optimistic → 64% IRR), **adaptive-reuse** (stabilized value below total cost →
  a broken, money-losing default): defaults corrected to land these in realistic ranges.

Flip and income-stream modules deliberately return `NaN` for operating-hold metrics that don't apply
(a flip has no cap rate or DSCR); the UI renders `—` and the comparison view leaves them unhighlighted
— which is the honest answer, not a gap.

## Walking skeleton, three modules, then stop

The brief (§13) mandates a walking skeleton before backfilling ~50 modules. The three chosen
(`metro-condo-ltr`, `raw-land`, `str-metro`) deliberately span three math shapes — amortized NOI,
no-NOI carry, and revenue-from-occupancy — so the plugin interface is proven against real variety,
not three copies of the same shape. Paused here for review per the brief.

## Stack: brief defaults, with jsPDF for PDF

Confirmed the brief's defaults (React + TS strict + Vite + Tailwind + Vitest + SheetJS). For PDF the
brief offered print-CSS/react-to-print vs. jsPDF+autotable; chose **jsPDF + jspdf-autotable** for a
structured, deterministic tabular export that doesn't depend on the browser print dialog. It sits
behind a single `exportPdf(target)` entry point so the renderer stays swappable, as the brief asks.

## Tailwind v4 (not v3)

Tailwind v4 with the `@tailwindcss/vite` plugin and a single `@import "tailwindcss"` — no
`tailwind.config.js`, no PostCSS wiring. Design tokens (stone neutrals + one slate-blue accent) live
in `@theme` in `src/index.css`.

## Percents stored as fractions; edited as whole percents

Internally `0.07` === 7% everywhere (matches the brief's `ParamSpec` note). The input layer converts
to/from whole percents at the boundary (`units.ts` `toEditable`/`fromEditable`) so users type `7`,
not `0.07`, while `compute` and exports see clean fractions.

## `irr5yr` is standardized to a 5-year hold

Modules carry their own `holdYears` (which drives the displayed projection), but the core
`irr5yr` metric is always computed over a fixed 5-year window with a modeled sale. Without a common
horizon, comparing IRRs across modules is apples-to-oranges. `_projection.ts` builds to
`max(holdYears, 5)` so both the user's chosen hold and the standardized 5-year IRR are available from
one projection.

## Shared `_projection.ts`, not per-module amortization

The brief insists no module re-implements amortization. Hold-strategy modules share a
`buildProjection` helper that composes `finance.ts` and takes per-year revenue/expense closures. It
lives in `src/modules/` (not `core/`) because it's a module-authoring convenience, not a primitive.

## Golden fixtures are generated, then eyeballed, then locked

`scripts/gen-fixtures.ts` runs each module on its defaults and writes
`__fixtures__/<id>.json`. The numbers were sanity-checked by hand (e.g. condo PMT, land carry, STR
break-even occupancy) before being committed as regression baselines. JSON can't hold `NaN`, so a
`null` in a fixture encodes an intentionally-`NaN` metric (e.g. land DSCR with no debt).

## Honest defaults over flattering ones

At 2026 metro prices with 25% down and 7%+ rates, all three default configurations show thin or
negative *pre-tax* cash flow. That's real, and the brief explicitly values surfacing simplifications
over hiding them. The Assumptions panel and per-module narratives explain why pre-tax negative is
not the same as a bad deal (amortization, appreciation, and unmodeled tax benefits).

## Export builders split from download

`xlsx.ts` exposes `buildModuleWorkbook` / `buildComparisonWorkbook` (return a workbook) separately
from the `export*` wrappers (call `XLSX.writeFile`). This makes the export logic unit-testable in
Node without a DOM. The PDF path is click-verified in-browser (jsPDF's `save()` needs the browser).

## Dependency-free projection chart

The projection chart is hand-rolled inline SVG (equity area + cumulative-cash-flow line) rather than
a charting library — keeps the bundle lean and the visual language controllable. If charts grow, this
is the seam to revisit.

## Known follow-ups (not blocking the skeleton)

- Production bundle is ~950 kB (SheetJS + jsPDF + html2canvas dragged in by jsPDF). Fine for v1;
  lazy-load the `export/` modules via dynamic `import()` when backfilling.
- Golden fixtures currently cover default inputs only; consider a second fixture per module at a
  non-default configuration when the module count grows.
