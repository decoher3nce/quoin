# 00 — Initial brief

The repository was scaffolded from a single self-contained brief ("Quoin — Claude Code Build
Prompt") specifying: a tabbed single-page app where each tab is an investment module (inputs →
computed metrics → narrative), a comparison view over a shared core metric contract, `.xlsx`/`.pdf`
export, a stubbed future geo/time-series `DataSource`, and a plugin architecture where adding an
investment type never touches core UI or engine.

## Decisions taken at kickoff (confirmed with the user before scaffolding)

- **Stack:** the brief's defaults as written — React + TypeScript (strict) + Vite + Tailwind,
  Vitest, SheetJS.
- **PDF renderer:** jsPDF + jspdf-autotable (structured tabular export), behind a swappable
  `exportPdf(target)`.
- **Scope:** build the walking skeleton (brief §13 steps 1–6) — scaffold, tested finance engine,
  three modules spanning different math shapes, comparison view, both exports, `DataSource` stub —
  then **stop** for review before backfilling Appendix A/B modules.

## Build order followed

1. Vite + React + TS + Tailwind scaffold; module registry + generic module view + tab nav.
2. `src/core/finance.ts` + Vitest (PMT, loanBalance, NPV, IRR, ratios) — green before proceeding.
3. Three modules end to end: `metro-condo-ltr`, `raw-land`, `str-metro`.
4. Comparison view against the core metric contract.
5. `.xlsx` then `.pdf` export.
6. `DataSource` stub + `dataHooks` display.

See `DECISIONS.md` for the non-obvious choices made along the way.
