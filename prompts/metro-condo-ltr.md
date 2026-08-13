# metro-condo-ltr — Metro Condo, Long-Term Rental

**Intent:** the base amortized-rental model, the reference shape every other residential module
varies from.

**Math shape:** financed purchase → scheduled rent with vacancy → operating expenses (property tax
on appreciating value, insurance, HOA, maintenance as % of rent, management as % of collected rent)
→ NOI → subtract annual debt service → year-1 cash flow. Multi-year projection grows rent and
expenses at their own rates, amortizes the loan (`buildProjection` composing `finance.ts`), and the
standardized 5-year IRR adds a modeled net sale in the final year.

**Core metrics:** all seven, computed the ordinary way. `capRate = NOI/price`,
`cashOnCash = year1 cashflow / (down + closing)`, `dscr = NOI / annual debt service`.

**Module-specific metrics:** `grm` (gross rent multiplier, lower is better) and `opexRatio`
(operating expenses / effective revenue).

**Narrative stance:** four return levers (cash flow, amortization, appreciation, unmodeled tax),
condo-specific HOA dependency as the swing variable and dominant risk. Regulatory callout: confirm
the HOA permits long-term rentals.

**`verify` inputs:** purchase price, interest rate, monthly rent, property tax, insurance, HOA dues.

**Simplifications:** management modeled on collected (effective) rent, maintenance on scheduled rent;
property tax tracks appreciating value; no capex reserve line separate from maintenance.
