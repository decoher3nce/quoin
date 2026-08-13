# Prompts — AI-dev trail

An auditable record of the prompts used to generate or modify this codebase, per the brief's
coding standards (§12). Each substantive module or subsystem gets a file capturing the intent it was
built to satisfy, so a future reader can see *why* the code looks the way it does — not just what it
does.

- `00-initial-brief.md` — the master brief the whole repo was scaffolded from.
- `metro-condo-ltr.md`, `raw-land.md`, `str-metro.md` — per-module authoring intent for the three
  skeleton modules (math shape, inputs, module-specific metrics, narrative stance).
- `appendix-a-b-backfill.md` — how the remaining 48 modules were authored: the four math archetypes,
  the enforced contract, per-category shapes, and the post-integration honesty corrections.

When you add a module, add a sibling file here describing the deal math and the modeling choices you
made, and note any `verify: true` inputs and simplifications.
