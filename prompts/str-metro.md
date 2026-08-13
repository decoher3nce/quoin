# str-metro — Short-Term Rental, Metro

**Intent:** prove the interface for a **revenue-from-occupancy** hospitality model with heavy opex
and up-front capex — the "Airbnb question" in its base form.

**Math shape:** gross revenue = ADR × 365 × occupancy, minus a host-side platform fee. Operating
expenses split into **fixed** (property tax, STR insurance, HOA, all utilities — the host pays these
now) and **variable** (supplies, management/co-host, maintenance, each a % of gross revenue). NOI =
effective revenue − opex; year-1 cash flow subtracts annual debt service. Cash invested includes
**furnishing capex** and an **operating reserve** on top of down payment and closing.

**Core metrics:** all seven.

**Module-specific metrics:**
- `breakEvenOccupancy` — solve cash-flow-zero for occupancy:
  `revNeeded = (fixedOpex + debtService) / (1 − platformFee − variablePct)`, then
  `occ* = revNeeded / (ADR × 365)`. The signature output: how far demand can fall before the deal
  bleeds.
- `revPAN` — revenue per available night (ADR × occupancy), the blended nightly yield.

**Warnings:** break-even occupancy > 80%, modeled occupancy below break-even (loses money), DSCR
< 1.20, negative year-1 cash flow.

**Narrative stance:** it is a hospitality *business*, not passive real estate — labor, reviews,
turnover. Regulatory risk is dominant and stated first: cities can restrict, cap, or ban STRs with
little notice, which can zero the model.

**`verify` inputs:** purchase price, interest rate, ADR, occupancy (the most over-optimistic input in
most pro-formas), STR insurance, management %.

**Simplifications:** occupancy is a single blended annual figure (no seasonality curve); cleaning
modeled inside the variable-% bucket rather than per-turn.
