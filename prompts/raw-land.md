# raw-land — Raw Land, Buy & Hold

**Intent:** prove the interface holds for an asset with **no operating income**, where the standard
ratios go negative and that is the honest answer.

**Math shape:** no revenue. Each year carries property tax (on appreciating value), maintenance /
weed-abatement, and liability insurance; optional financing adds negative-carry debt service. NOI is
negative (carry only); year-1 cash flow is that carry. The whole return lives in the exit — the
5-year IRR is driven entirely by appreciation minus carry and selling costs.

**Core metrics:** all seven. `capRate` and `cashOnCash` are **negative by construction** — a feature,
not a bug: a pure carry asset costs you money to hold. `dscr` is `NaN` when unfinanced (no debt
service; `guardDiv` returns `NaN`, encoded as `null` in the golden fixture).

**Module-specific metrics:** `pricePerAcre` and `breakEvenAppreciation` — the annual appreciation
needed over the hold just to recover cash + carry net of selling costs.

**Narrative stance:** the edge is buying below intrinsic value (mispriced parcel, path-of-growth,
entitlement/utility catalyst) and having the balance sheet to wait. Regulatory callout: zoning,
buildable status, access easements, and water rights drive value far more than housing indices.

**`verify` inputs:** purchase price, land-loan rate, property tax, and — most of all —
**appreciation**, which is the entire thesis and must be checked against parcel comps.

**Simplifications:** maintenance/insurance held flat (not grown); appreciation applied smoothly.
