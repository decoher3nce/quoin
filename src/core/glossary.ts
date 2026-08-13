// On-site glossary. Definitions are written to match how Quoin uses each term —
// short, plain, and honest about the simplifications. Grouped for browsing;
// the view also searches across term, expansion, and definition.

export type GlossaryCategory =
  | 'Returns & metrics'
  | 'Financing'
  | 'Rental & residential'
  | 'Commercial & industrial'
  | 'Hospitality & operations'
  | 'Paper & passive'
  | 'Land & development'
  | 'Infrastructure & easements'
  | 'Remote-sensing signals'
  | 'Taxes & depreciation'
  | 'General';

export interface GlossaryEntry {
  term: string; // headword, e.g. 'DSCR' or 'Cap rate'
  full?: string; // expansion of an acronym / fuller name
  definition: string;
  category: GlossaryCategory;
  seeAlso?: string[];
}

export const GLOSSARY: GlossaryEntry[] = [
  // ── Returns & metrics ──────────────────────────────────────────────────────
  {
    term: 'NOI',
    full: 'Net Operating Income',
    category: 'Returns & metrics',
    definition:
      'Effective revenue minus operating expenses, before debt service and before income tax. The property-level profit an asset throws off regardless of how it is financed.',
    seeAlso: ['Cap rate', 'DSCR', 'Operating expenses', 'Debt service'],
  },
  {
    term: 'Cap rate',
    full: 'Capitalization rate',
    category: 'Returns & metrics',
    definition:
      'NOI ÷ price. The unlevered yield on the asset — what it returns if you paid all cash, ignoring financing and appreciation. Higher is cheaper per dollar of income; it also moves with market risk and rates.',
    seeAlso: ['NOI', 'Going-in cap rate', 'Cash-on-cash'],
  },
  {
    term: 'Going-in cap rate',
    category: 'Returns & metrics',
    definition:
      "The cap rate at purchase, based on year-1 NOI and the purchase price. Contrast with the exit cap rate assumed at sale, which drives the resale value.",
    seeAlso: ['Cap rate'],
  },
  {
    term: 'Cash-on-cash',
    full: 'Cash-on-cash return',
    category: 'Returns & metrics',
    definition:
      'Year-1 pre-tax cash flow ÷ total cash invested. The current-year return on the actual dollars you put in — unlike cap rate, it reflects leverage.',
    seeAlso: ['Cash flow', 'Total cash invested', 'Cap rate'],
  },
  {
    term: 'DSCR',
    full: 'Debt-Service Coverage Ratio',
    category: 'Returns & metrics',
    definition:
      'NOI ÷ annual debt service. How many times the income covers the loan payments. Lenders typically want ≥ 1.20–1.25; below 1.0 the property cannot pay its own mortgage. Shown as "—" for unlevered deals.',
    seeAlso: ['NOI', 'Debt service', 'LTV'],
  },
  {
    term: 'IRR',
    full: 'Internal Rate of Return',
    category: 'Returns & metrics',
    definition:
      'The annualized discount rate at which a deal\'s cash flows plus its modeled sale net to zero — the time-weighted return over the hold. In Quoin the core "5-yr IRR" is standardized to a 5-year hold so modules compare on the same horizon. It is assumption-driven, not a forecast.',
    seeAlso: ['NPV', 'Discount rate', 'Hold period', 'Equity multiple'],
  },
  {
    term: 'NPV',
    full: 'Net Present Value',
    category: 'Returns & metrics',
    definition:
      'The sum of future cash flows discounted back to today at a chosen discount rate, minus the upfront cost. Positive NPV means the deal beats that discount rate.',
    seeAlso: ['IRR', 'Discount rate'],
  },
  {
    term: 'GRM',
    full: 'Gross Rent Multiplier',
    category: 'Returns & metrics',
    definition:
      'Price ÷ gross annual rent. A quick, expense-blind screen — lower is cheaper per dollar of top-line rent. Useful for a first pass, not a substitute for NOI.',
    seeAlso: ['NOI', 'Cap rate'],
  },
  {
    term: 'Equity multiple',
    category: 'Returns & metrics',
    definition:
      'Total dollars returned ÷ dollars invested (e.g. 1.8×). Unlike IRR it ignores timing — a 2× over 3 years and over 10 years are very different deals.',
    seeAlso: ['IRR', 'Preferred return'],
  },
  {
    term: 'Cash flow',
    category: 'Returns & metrics',
    definition:
      'NOI minus debt service — the pre-tax cash left in your pocket. Quoin models it pre-tax; a real buy-and-hold can be after-tax positive while showing negative pre-tax cash flow.',
    seeAlso: ['NOI', 'Debt service', 'Depreciation'],
  },
  {
    term: 'Yield on cost',
    category: 'Returns & metrics',
    definition:
      'Stabilized NOI (or incremental NOI) ÷ total project cost. For value-add and development, the yield you create by building — compared against the market cap rate you could buy at.',
    seeAlso: ['Cap rate', 'Value-add'],
  },
  {
    term: 'ROI',
    full: 'Return on Investment',
    category: 'Returns & metrics',
    definition:
      'Profit ÷ cash invested over the life of a project. For flips Quoin also reports annualized ROI, which scales a short-project ROI to a yearly rate for comparison.',
    seeAlso: ['IRR', 'Margin of safety'],
  },
  {
    term: 'Break-even occupancy',
    category: 'Returns & metrics',
    definition:
      'The occupancy (or event count) at which cash flow is exactly zero. Below it the deal loses money. The single best gauge of how much demand cushion a hospitality deal has.',
    seeAlso: ['Occupancy', 'RevPAR', 'ADR'],
  },
  {
    term: 'Total cash invested',
    category: 'Returns & metrics',
    definition:
      'All equity out of pocket: down payment, closing costs, rehab, furnishing, and reserves. The denominator for cash-on-cash. Marked "neutral" in comparisons — lower is not automatically better.',
    seeAlso: ['Cash-on-cash', 'Closing costs'],
  },
  {
    term: 'Hold period',
    category: 'Returns & metrics',
    definition:
      'How long you own the asset before selling — the horizon over which cash flows and the exit are modeled. Quoin lets you set it per module, but standardizes the core IRR to a 5-year hold so modules compare on the same footing.',
    seeAlso: ['IRR', 'Terminal value'],
  },
  {
    term: 'Discount rate',
    category: 'Returns & metrics',
    definition:
      'The annual rate used to translate future dollars into today\'s dollars in an NPV. Higher rates penalize distant cash flows more, reflecting risk and opportunity cost.',
    seeAlso: ['NPV', 'Opportunity cost'],
  },
  {
    term: 'Terminal value',
    full: 'Reversion',
    category: 'Returns & metrics',
    definition:
      'The modeled net proceeds when the asset is sold (or the lease reverts) at the end of the hold. Often the largest single cash flow in an IRR, and highly sensitive to the exit assumption.',
    seeAlso: ['IRR', 'Selling costs'],
  },

  // ── Financing ──────────────────────────────────────────────────────────────
  {
    term: 'Amortization',
    category: 'Financing',
    definition:
      'The scheduled paydown of loan principal through fixed payments. Each payment is part interest, part principal; over time the tenant effectively retires your loan, building equity even in a flat market.',
    seeAlso: ['PMT', 'Debt service', 'LTV'],
  },
  {
    term: 'PMT',
    full: 'Payment',
    category: 'Financing',
    definition:
      'The fixed periodic payment that fully amortizes a loan over its term. Quoin\'s engine computes it once and every hold module composes it — no module re-derives amortization.',
    seeAlso: ['Amortization', 'Debt service'],
  },
  {
    term: 'Debt service',
    category: 'Financing',
    definition: 'The total annual loan payments (principal + interest). NOI minus debt service is cash flow.',
    seeAlso: ['PMT', 'DSCR', 'Cash flow'],
  },
  {
    term: 'LTV',
    full: 'Loan-to-Value',
    category: 'Financing',
    definition:
      'Loan amount ÷ property value, as a percent. Higher LTV means more leverage — amplified returns and amplified risk. In a refinance it sets how much capital you can pull back out.',
    seeAlso: ['BRRRR', 'DSCR'],
  },
  {
    term: 'Points',
    category: 'Financing',
    definition:
      'Upfront loan fees, each point = 1% of the loan. Common on hard-money and private loans; for a lender they are front-loaded yield, for a borrower they raise the true cost of capital.',
    seeAlso: ['Hard money', 'Private lending'],
  },
  {
    term: 'Hard money',
    category: 'Financing',
    definition:
      'Short-term, asset-based financing at high rates and points, used for flips and rehabs when speed matters more than cost. The interest clock is a primary risk on any held project.',
    seeAlso: ['Points', 'Fix and flip', 'BRRRR'],
  },
  {
    term: 'Closing costs',
    category: 'Financing',
    definition:
      'Transaction fees at purchase — title, escrow, lender, transfer taxes, inspections. Modeled as a percent of price and added to total cash invested.',
    seeAlso: ['Total cash invested', 'Selling costs'],
  },
  {
    term: 'Selling costs',
    category: 'Financing',
    definition:
      'Costs to sell — brokerage commission, transfer taxes, closing. Subtracted from the sale price to get net proceeds at exit. Land and specialty assets often carry higher rates than housing.',
    seeAlso: ['Terminal value', 'Closing costs'],
  },

  // ── Rental & residential ───────────────────────────────────────────────────
  {
    term: 'LTR',
    full: 'Long-Term Rental',
    category: 'Rental & residential',
    definition: 'A property leased on a standard 12-month (or longer) lease. The base buy-and-hold rental model.',
    seeAlso: ['STR', 'MTR', 'Vacancy'],
  },
  {
    term: 'SFR',
    full: 'Single-Family Rental / Residence',
    category: 'Rental & residential',
    definition:
      'A detached single-family house held as a rental. Broadest tenant pool and full control, but you own all the capex and a single vacancy is 100% vacancy.',
    seeAlso: ['LTR', 'HOA'],
  },
  {
    term: 'HOA',
    full: 'Homeowners / Community Association',
    category: 'Rental & residential',
    definition:
      'The entity that governs and bills a condo or planned community. Dues cover shared upkeep; a special assessment can levy a large one-time charge that erases a year of cash flow. HOAs may also restrict or cap rentals.',
    seeAlso: ['Special assessment'],
  },
  {
    term: 'Special assessment',
    category: 'Rental & residential',
    definition:
      'A one-time charge an HOA levies for a major repair or shortfall (roof, elevator, litigation) on top of regular dues. The swing risk in condo economics.',
    seeAlso: ['HOA'],
  },
  {
    term: 'Vacancy',
    category: 'Rental & residential',
    definition:
      'The fraction of potential rent lost to empty units and turnover. Modeled as a percent of scheduled rent; real vacancy is lumpy and tied to the local market.',
    seeAlso: ['Occupancy', 'LTR'],
  },
  {
    term: 'House hack',
    category: 'Rental & residential',
    definition:
      'Owner-occupying one unit of a small multifamily while renting the others. Reduces rentable income by a unit but unlocks owner-occupant financing (lower down payment).',
    seeAlso: ['SFR', 'LTV'],
  },
  {
    term: 'ADU',
    full: 'Accessory Dwelling Unit',
    category: 'Rental & residential',
    definition:
      'A secondary unit added to an existing lot (garage conversion, backyard cottage). High yield-on-cost where legal, but ADU rules vary enormously by jurisdiction.',
    seeAlso: ['Yield on cost', 'Value-add'],
  },
  {
    term: 'Fix and flip',
    category: 'Rental & residential',
    definition:
      'Buy, renovate, and resell for profit over a short hold. Return is ROI and its annualization; there is no stabilized NOI, so cap rate and DSCR do not apply (shown as "—").',
    seeAlso: ['ARV', 'Margin of safety', 'Hard money'],
  },
  {
    term: 'ARV',
    full: 'After-Repair Value',
    category: 'Rental & residential',
    definition:
      'The projected market value once renovations are complete. The linchpin of any flip or BRRRR — the whole deal rests on this estimate being right.',
    seeAlso: ['Fix and flip', 'BRRRR', 'Margin of safety'],
  },
  {
    term: 'Margin of safety',
    category: 'Rental & residential',
    definition:
      'How far the exit value (ARV / stabilized value) can fall before the project breaks even. The cushion against a soft market or a rehab overrun.',
    seeAlso: ['ARV', 'Fix and flip'],
  },
  {
    term: 'BRRRR',
    full: 'Buy, Rehab, Rent, Refinance, Repeat',
    category: 'Rental & residential',
    definition:
      'Buy and rehab a property, refinance at the higher stabilized value to pull most of your capital back out, then hold it as a rental and recycle the capital. If the cash-out exceeds what you put in, cash left in is ≤ 0 and returns are effectively infinite (Quoin flags this rather than printing a nonsense number).',
    seeAlso: ['ARV', 'LTV', 'Cash-on-cash'],
  },
  {
    term: 'MTR',
    full: 'Mid-Term Rental',
    category: 'Rental & residential',
    definition:
      'A furnished rental let for 30+ days (traveling nurses, relocation, insurance housing). Higher rent than unfurnished, lower turnover than nightly, and usually outside short-term-rental regulation.',
    seeAlso: ['LTR', 'STR'],
  },
  {
    term: 'Opportunity cost',
    category: 'Rental & residential',
    definition:
      'The return your capital could earn elsewhere. Relevant for lifestyle assets like a second home, where tied-up equity has a real cost even if the property is enjoyable.',
    seeAlso: ['Discount rate'],
  },

  // ── Commercial & industrial ────────────────────────────────────────────────
  {
    term: 'NNN',
    full: 'Triple Net (lease)',
    category: 'Commercial & industrial',
    definition:
      'A lease where the tenant pays property taxes, insurance, and maintenance on top of rent, leaving the owner near-passive income. Value hinges on tenant credit and remaining lease term.',
    seeAlso: ['Cap rate', 'Rollover'],
  },
  {
    term: 'TI / LC',
    full: 'Tenant Improvements / Leasing Commissions',
    category: 'Commercial & industrial',
    definition:
      'Capital paid to build out space for a tenant (TI) and to brokers to sign the lease (LC). A recurring drag on commercial returns at every rollover — heaviest in office and medical office.',
    seeAlso: ['Rollover', 'MOB'],
  },
  {
    term: 'Rollover',
    category: 'Commercial & industrial',
    definition:
      'A lease expiring and the space needing to be re-leased, triggering downtime, TI, and LC. Modeled as an annual rollover percentage of the space.',
    seeAlso: ['TI / LC', 'NNN'],
  },
  {
    term: 'MOB',
    full: 'Medical Office Building',
    category: 'Commercial & industrial',
    definition:
      'Office space built for healthcare tenants. Sticky, credit-worthy tenants and a demographic tailwind, but very high tenant-improvement build-out cost.',
    seeAlso: ['TI / LC', 'NNN'],
  },
  {
    term: 'EGI',
    full: 'Effective Gross Income',
    category: 'Commercial & industrial',
    definition:
      'Potential gross income minus vacancy and collection loss, plus other income. The realistic top line that operating expenses are measured against.',
    seeAlso: ['NOI', 'Expense ratio', 'Economic occupancy'],
  },
  {
    term: 'Expense ratio',
    category: 'Commercial & industrial',
    definition:
      'Operating expenses ÷ effective gross income. A quick read on operating efficiency; used directly to model opex for storage and mobile-home parks.',
    seeAlso: ['EGI', 'NOI'],
  },
  {
    term: 'Economic occupancy',
    category: 'Commercial & industrial',
    definition:
      'Physical occupancy adjusted for delinquency, concessions, and discounts — the rent actually collected vs. the rent theoretically due. Always ≤ physical occupancy.',
    seeAlso: ['Occupancy', 'EGI'],
  },
  {
    term: 'MHP',
    full: 'Mobile Home Park',
    category: 'Commercial & industrial',
    definition:
      'Land leased as pads to owners of manufactured homes (plus any park-owned homes). Tenant-owned homes make occupancy extremely sticky; private water/sewer infrastructure is the capex risk.',
    seeAlso: ['Pad rent', 'Expense ratio'],
  },
  {
    term: 'Pad rent',
    category: 'Commercial & industrial',
    definition:
      'The monthly lot rent a mobile-home-park tenant pays to place their home on a pad. Low turnover because moving a home is expensive; often subject to rent regulation.',
    seeAlso: ['MHP'],
  },

  // ── Hospitality & operations ───────────────────────────────────────────────
  {
    term: 'STR',
    full: 'Short-Term Rental',
    category: 'Hospitality & operations',
    definition:
      'A furnished unit rented nightly (Airbnb/Vrbo style). Revenue = ADR × 365 × occupancy. A hospitality business, not passive real estate — heavy opex, furnishing capex, and dominant regulatory risk.',
    seeAlso: ['ADR', 'Occupancy', 'Break-even occupancy', 'RevPAR'],
  },
  {
    term: 'ADR',
    full: 'Average Daily Rate',
    category: 'Hospitality & operations',
    definition:
      'The average nightly price a short-term rental collects. Along with occupancy, the most over-optimistic input in most STR pro-formas — verify against real booked comps.',
    seeAlso: ['STR', 'RevPAR', 'Occupancy'],
  },
  {
    term: 'Occupancy',
    category: 'Hospitality & operations',
    definition:
      'Nights (or units, or pads) sold ÷ available. For STR it is paid nights ÷ 365. New supply and seasonality compress it.',
    seeAlso: ['ADR', 'Break-even occupancy', 'Vacancy'],
  },
  {
    term: 'RevPAR',
    full: 'Revenue Per Available Room / Night',
    category: 'Hospitality & operations',
    definition:
      'ADR × occupancy — the blended yield per available night, whether or not it was booked. Quoin labels the per-night version RevPAN.',
    seeAlso: ['ADR', 'Occupancy'],
  },
  {
    term: 'Platform fee',
    category: 'Hospitality & operations',
    definition:
      "The host-side share the booking platform (Airbnb/Vrbo) takes off the top of revenue. Modeled as a percent of gross.",
    seeAlso: ['STR'],
  },
  {
    term: 'Rental arbitrage',
    category: 'Hospitality & operations',
    definition:
      'Leasing a unit you do not own and re-letting it nightly for a spread. No ownership means no appreciation and high fragility — the landlord can terminate and most leases forbid subletting. Capital is furnishing plus deposits.',
    seeAlso: ['STR', 'Co-hosting'],
  },
  {
    term: 'Co-hosting',
    category: 'Hospitality & operations',
    definition:
      'Managing other owners\' short-term rentals for a percentage of their revenue. Near-zero capital but labor-bound — it is a job, not passive income, so Quoin judges it by effective hourly rate rather than a capital return.',
    seeAlso: ['STR', 'Rental arbitrage'],
  },

  // ── Paper & passive ────────────────────────────────────────────────────────
  {
    term: 'GP / LP',
    full: 'General Partner / Limited Partner',
    category: 'Paper & passive',
    definition:
      'In a syndication the GP (sponsor) sources, finances, and operates the deal; LPs supply capital and are passive. LPs earn a preferred return plus a share of profits, but bear GP and illiquidity risk.',
    seeAlso: ['Syndication', 'Preferred return', 'Waterfall'],
  },
  {
    term: 'Preferred return',
    full: 'Pref',
    category: 'Paper & passive',
    definition:
      "A minimum annual return LPs receive before the GP shares in profits (e.g. 8%). If cash distributions fall short, the shortfall typically accrues and is paid at exit — if the deal performs.",
    seeAlso: ['GP / LP', 'Waterfall', 'Equity multiple'],
  },
  {
    term: 'Waterfall',
    category: 'Paper & passive',
    definition:
      'The tiered rules that split cash between LPs and GP — return of capital, then preferred return, then a promote split of the upside. Determines who gets what, and when.',
    seeAlso: ['Preferred return', 'Promote', 'GP / LP'],
  },
  {
    term: 'Promote',
    full: 'Carried interest',
    category: 'Paper & passive',
    definition:
      "The GP's outsized share of profits above the preferred return — the sponsor's incentive. A 70/30 split above pref means LPs keep 70% of that tier.",
    seeAlso: ['Waterfall', 'GP / LP'],
  },
  {
    term: 'Syndication',
    category: 'Paper & passive',
    definition:
      'A pooled investment where many LPs fund a deal run by a GP. Passive and access-granting, but illiquid, fee-laden, and dependent on the sponsor. Usually sold under a securities exemption to accredited investors.',
    seeAlso: ['GP / LP', 'PPM', 'Accredited investor'],
  },
  {
    term: 'PPM',
    full: 'Private Placement Memorandum',
    category: 'Paper & passive',
    definition:
      'The offering document for a private syndication — the deal terms, risks, fees, and operating agreement. Read it (especially the fee schedule) before wiring.',
    seeAlso: ['Syndication', 'Accredited investor'],
  },
  {
    term: 'Accredited investor',
    category: 'Paper & passive',
    definition:
      'A person meeting income or net-worth thresholds who may invest in most private (Reg D) offerings. Many syndications are open only to accredited investors.',
    seeAlso: ['Syndication', 'PPM'],
  },
  {
    term: 'REIT',
    full: 'Real Estate Investment Trust',
    category: 'Paper & passive',
    definition:
      'A company that owns income real estate and passes most income through as dividends. Public REITs are liquid and diversified; non-traded REITs can carry high fees and lockups.',
    seeAlso: ['NAV', 'Syndication'],
  },
  {
    term: 'NAV',
    full: 'Net Asset Value',
    category: 'Paper & passive',
    definition:
      "A fund or REIT's assets minus liabilities, per share. Shares can trade at a premium or discount to NAV.",
    seeAlso: ['REIT'],
  },
  {
    term: 'UPB',
    full: 'Unpaid Principal Balance',
    category: 'Paper & passive',
    definition:
      'The principal still owed on a mortgage note. Note investors often buy at a discount to UPB — that discount is the margin of safety.',
    seeAlso: ['YTM', 'Note'],
  },
  {
    term: 'YTM',
    full: 'Yield to Maturity',
    category: 'Paper & passive',
    definition:
      'The IRR of a note or bond held to the end, given its purchase price and remaining payments. For a discounted note, buying below UPB raises YTM above the coupon rate.',
    seeAlso: ['UPB', 'Note', 'IRR'],
  },
  {
    term: 'Note',
    category: 'Paper & passive',
    definition:
      'A mortgage loan as a tradable asset — you own the right to the borrower\'s payments, secured by the property. A performing note pays; a non-performing note is in default and priced for a workout.',
    seeAlso: ['UPB', 'YTM'],
  },
  {
    term: 'Tax lien / tax deed',
    category: 'Paper & passive',
    definition:
      'Buying a claim against a property for unpaid property taxes. A lien earns statutory interest until the owner redeems; if they do not, some states convey the deed — a rare, large upside. Rules are highly state-specific.',
    seeAlso: ['Redemption'],
  },
  {
    term: 'Redemption',
    category: 'Paper & passive',
    definition:
      'The owner paying off a tax lien (with interest and penalties) within a statutory window to reclaim clear title. Most liens redeem; the few that do not can convert to a deed.',
    seeAlso: ['Tax lien / tax deed'],
  },
  {
    term: 'Private lending',
    category: 'Paper & passive',
    definition:
      'Making a loan secured by real estate for interest and points. The collateral and LTV are the real protection — not the borrower\'s promise. Subject to state lending/usury rules.',
    seeAlso: ['Points', 'Hard money', 'LTV'],
  },
  {
    term: 'Ground lease',
    full: 'Leased fee',
    category: 'Paper & passive',
    definition:
      'Owning the land under a building and leasing it long-term to the building owner. Bond-like income with escalators; improvements typically revert to the landowner at lease end.',
    seeAlso: ['Terminal value', 'Escalation'],
  },

  // ── Land & development ─────────────────────────────────────────────────────
  {
    term: 'Entitlement',
    category: 'Land & development',
    definition:
      'The government approvals (zoning, subdivision, permits) that make land legally buildable. Entitlement time and cost — and the risk it fails — dominate land development returns.',
    seeAlso: ['Horizontal development', 'Absorption'],
  },
  {
    term: 'Horizontal development',
    category: 'Land & development',
    definition:
      'The site work that turns raw land into finished lots — grading, roads, and utilities — before any vertical building. Sold to builders or held for vertical development.',
    seeAlso: ['Entitlement', 'Cost to complete'],
  },
  {
    term: 'Cost to complete',
    category: 'Land & development',
    definition:
      'The remaining spend to finish a project. In development the swing risk is that it runs over budget, compressing profit per lot or unit.',
    seeAlso: ['Horizontal development', 'Margin of safety'],
  },
  {
    term: 'Absorption',
    full: 'Sell-through',
    category: 'Land & development',
    definition:
      'The pace at which finished lots or units sell into the market. Slow absorption extends carry and financing costs and can turn a paper profit into a loss.',
    seeAlso: ['Cost to complete', 'Condo conversion'],
  },
  {
    term: 'Basis',
    category: 'Land & development',
    definition:
      'Your cost in an asset for tax and analysis purposes — generally purchase price plus improvements. Relevant to gains, depreciation, and donation strategies.',
    seeAlso: ['Depreciation', 'Conservation easement'],
  },
  {
    term: 'Easement',
    category: 'Land & development',
    definition:
      'A legal right to use (or restrict use of) land you do not fully own — for access, utilities, a view, or advertising. Can be bought, sold, or donated, and can carry real income or tax value.',
    seeAlso: ['Conservation easement', 'Viewshed', 'Ground lease'],
  },
  {
    term: 'Conservation easement',
    category: 'Land & development',
    definition:
      'A permanent restriction donating a property\'s development rights to a qualified organization, in exchange for a tax deduction based on the value given up. Heavily scrutinized by the IRS — not tax advice.',
    seeAlso: ['Easement', 'Basis'],
  },
  {
    term: 'Royalty / depletion',
    category: 'Land & development',
    definition:
      'Timber and mineral rights pay royalties as resources are extracted; the income declines as reserves deplete. Value is the NPV of the extraction schedule, sensitive to commodity prices and reserve estimates.',
    seeAlso: ['NPV'],
  },
  {
    term: 'Cash rent / crop share',
    category: 'Land & development',
    definition:
      'Two ways farmland pays: a fixed cash rent per acre (lower risk to the landowner) or a share of the crop (upside and downside with yields and prices).',
    seeAlso: ['Yield on cost'],
  },

  // ── Value-add & conversion ────────────────────────────────────────────────
  {
    term: 'Value-add',
    category: 'Land & development',
    definition:
      'Forcing appreciation through renovation, repositioning, or operational fixes, rather than waiting for market appreciation. Measured by the yield you create on cost vs. the market cap rate.',
    seeAlso: ['Yield on cost', 'Stabilized value'],
  },
  {
    term: 'Stabilized value',
    category: 'Land & development',
    definition:
      'The value of a property once complete and fully leased or sold at its highest-and-best use. The exit assumption a conversion or value-add deal lives or dies on.',
    seeAlso: ['Adaptive reuse', 'Value-add'],
  },
  {
    term: 'Adaptive reuse',
    category: 'Land & development',
    definition:
      'Converting a building to a higher-and-better use (office→residential, warehouse→lofts). Zoning/entitlement risk is dominant; historic and incentive tax credits can help.',
    seeAlso: ['Stabilized value', 'Entitlement'],
  },
  {
    term: 'Condo conversion',
    category: 'Land & development',
    definition:
      'Legally subdividing an apartment building into individually saleable condos to capture the retail per-door premium. Tenant-protection laws and sell-through pace are the risks.',
    seeAlso: ['Absorption', 'Stabilized value'],
  },

  // ── Infrastructure & easements ─────────────────────────────────────────────
  {
    term: 'Escalation',
    full: 'Escalator',
    category: 'Infrastructure & easements',
    definition:
      'A contractual clause that raises rent over time (a fixed percent per year or periodic bumps). The inflation protection in long-dated ground and infrastructure leases.',
    seeAlso: ['Ground lease', 'Terminal value'],
  },
  {
    term: 'Decommissioning',
    category: 'Infrastructure & easements',
    definition:
      'The obligation to remove equipment and restore the site at the end of an infrastructure lease (solar, cell, EV). Often backed by a bond; a liability to check before signing.',
    seeAlso: ['Escalation'],
  },
  {
    term: 'Interconnection',
    category: 'Infrastructure & easements',
    definition:
      'Connecting a solar or data-center site to the electric grid. The interconnection queue and available power are frequently the scarce asset that gates the whole deal.',
    seeAlso: ['Escalation'],
  },

  // ── Remote-sensing signals ─────────────────────────────────────────────────
  {
    term: 'InSAR',
    full: 'Interferometric Synthetic Aperture Radar',
    category: 'Remote-sensing signals',
    definition:
      'A satellite radar technique that measures ground movement (subsidence or uplift) to the millimeter. Quoin\'s InSAR-stable-land thesis buys geotechnically stable parcels the market discounts for a whole "sinking region."',
    seeAlso: ['Novelty risk'],
  },
  {
    term: 'VIIRS',
    full: 'Visible Infrared Imaging Radiometer Suite',
    category: 'Remote-sensing signals',
    definition:
      'A satellite instrument whose night-lights band measures light pollution. Low radiance = dark skies — the scarce asset behind the dark-sky astro-STR thesis.',
    seeAlso: ['Bortle scale', 'Novelty risk'],
  },
  {
    term: 'Bortle scale',
    full: 'Bortle dark-sky class',
    category: 'Remote-sensing signals',
    definition:
      'A 1–9 scale of night-sky darkness, 1 being pristine wilderness sky. Quantifies the sky quality that a dark-sky rental charges a premium for.',
    seeAlso: ['VIIRS'],
  },
  {
    term: 'SWE',
    full: 'Snow Water Equivalent',
    category: 'Remote-sensing signals',
    definition:
      'The amount of water held in the snowpack. Used as a leading demand signal for ski-town rentals — a low-snow year compresses occupancy directly.',
    seeAlso: ['SNOTEL', 'Novelty risk'],
  },
  {
    term: 'SNOTEL',
    full: 'Snow Telemetry',
    category: 'Remote-sensing signals',
    definition: 'An automated network of high-elevation stations reporting snowpack, precipitation, and temperature. The ground truth behind SWE forecasts.',
    seeAlso: ['SWE'],
  },
  {
    term: 'WUI',
    full: 'Wildland-Urban Interface',
    category: 'Remote-sensing signals',
    definition:
      'Where development meets wildland vegetation — the zone of highest wildfire risk and insurer withdrawal. The wildfire-hardened arbitrage thesis buys discounted WUI homes and retrofits them to stay insurable.',
    seeAlso: ['FAIR plan', 'Novelty risk'],
  },
  {
    term: 'FAIR plan',
    full: 'Fair Access to Insurance Requirements',
    category: 'Remote-sensing signals',
    definition:
      'A state-backed insurer of last resort for properties private carriers will not cover. Its footprint is a signal of where private insurance is withdrawing.',
    seeAlso: ['WUI'],
  },
  {
    term: 'Viewshed',
    category: 'Remote-sensing signals',
    definition:
      'The geographic area visible from (or to) a point, computed from a digital elevation model. Controlling a sightline lets you sell a view easement to the parcel that benefits.',
    seeAlso: ['DEM', 'Easement'],
  },
  {
    term: 'DEM',
    full: 'Digital Elevation Model',
    category: 'Remote-sensing signals',
    definition: 'A gridded terrain-elevation dataset used to compute line-of-sight, viewsheds, and horizon masks.',
    seeAlso: ['Viewshed'],
  },
  {
    term: 'IX',
    full: 'Internet Exchange',
    category: 'Remote-sensing signals',
    definition:
      'A physical hub where networks interconnect. Network distance to fiber and an IX drives the value of a micro-parcel for edge computing — a topology fact, not a real-estate fact.',
    seeAlso: ['Novelty risk'],
  },
  {
    term: 'Novelty risk',
    category: 'Remote-sensing signals',
    definition:
      'The dominant risk on every novel (Appendix B) module: thin comps, uncertain exit liquidity, and the possibility the thesis is simply wrong. These are the highest-variance ideas in Quoin and are labeled as such.',
    seeAlso: ['InSAR', 'VIIRS', 'SWE', 'WUI'],
  },

  // ── General ────────────────────────────────────────────────────────────────
  {
    term: 'Pro forma',
    category: 'General',
    definition:
      'A projected financial statement for a deal — the modeled income, expenses, and returns. Only as good as its assumptions, which is why Quoin flags the inputs that most need verification.',
    seeAlso: ['NOI', 'IRR'],
  },
  {
    term: 'Comps',
    full: 'Comparables',
    category: 'General',
    definition:
      'Recent sales or listings of similar assets used to estimate value, rent, or ADR. Verify the swing inputs against real comps, not aspiration.',
    seeAlso: ['ARV', 'ADR'],
  },
  {
    term: 'Due diligence',
    category: 'General',
    definition:
      'The verification done before committing — inspections, title, leases, financials, zoning. Quoin\'s "verify" badges mark the inputs where diligence matters most.',
    seeAlso: ['Pro forma'],
  },
  {
    term: 'Depreciation',
    category: 'Taxes & depreciation',
    definition:
      'A non-cash tax deduction for the wearing-out of a building (land is not depreciable), taken straight-line over 27.5 years for residential rentals or 39 for commercial/transient. It can make a deal after-tax positive even when pre-tax cash flow is negative. Off by default in Quoin; turn on the after-tax toggle (available on depreciable buy-and-hold modules) to include it.',
    seeAlso: ['Depreciation recapture', 'Adjusted basis', 'MACRS', 'After-tax cash flow'],
  },
  {
    term: 'MACRS',
    full: 'Modified Accelerated Cost Recovery System',
    category: 'Taxes & depreciation',
    definition:
      'The U.S. tax depreciation system. Real property uses straight-line recovery — 27.5 years for residential rental, 39 for commercial. Quoin uses these periods without the mid-month convention.',
    seeAlso: ['Depreciation'],
  },
  {
    term: 'Adjusted basis',
    category: 'Taxes & depreciation',
    definition:
      'Your cost basis reduced by the depreciation you have taken (and increased by capital improvements). Because depreciation lowers basis, it raises the taxable gain at sale — the deferred-tax side of the depreciation benefit.',
    seeAlso: ['Basis', 'Depreciation', 'Depreciation recapture'],
  },
  {
    term: 'Depreciation recapture',
    category: 'Taxes & depreciation',
    definition:
      'At sale, the portion of the gain equal to the depreciation you claimed is taxed as §1250 unrecaptured gain — at your ordinary rate but capped at 25%. It claws back part of the depreciation shelter you enjoyed during the hold.',
    seeAlso: ['Depreciation', 'Capital gains', 'Adjusted basis'],
  },
  {
    term: 'Capital gains',
    category: 'Taxes & depreciation',
    definition:
      'The profit on sale above your adjusted basis. Held over a year, real estate qualifies for long-term capital-gains rates (0/15/20% federal for most). Quoin taxes the gain above recapture at this rate.',
    seeAlso: ['Depreciation recapture', 'Adjusted basis', '1031 exchange'],
  },
  {
    term: 'Marginal tax rate',
    category: 'Taxes & depreciation',
    definition:
      'The rate on your next dollar of ordinary income — applied to rental taxable income (or the benefit of a rental loss) in the after-tax model. Set it to your combined federal + state rate to approximate state tax.',
    seeAlso: ['Passive activity loss', 'After-tax cash flow'],
  },
  {
    term: 'Passive activity loss',
    full: 'PAL rules',
    category: 'Taxes & depreciation',
    definition:
      'Rental real estate is generally passive, and passive losses can usually offset only passive income — not wages — unless you qualify as a real-estate professional or fall under the $25k active-participation allowance. Quoin\'s after-tax model assumes losses are usable in-year; if they are not for you, the benefit is deferred, not lost.',
    seeAlso: ['Marginal tax rate', 'Depreciation'],
  },
  {
    term: '1031 exchange',
    category: 'Taxes & depreciation',
    definition:
      'A like-kind exchange that defers capital-gains and recapture tax by rolling proceeds into a replacement property. Not modeled in Quoin — the after-tax view assumes a fully taxable sale, which is the conservative case.',
    seeAlso: ['Capital gains', 'Depreciation recapture'],
  },
  {
    term: 'After-tax cash flow',
    category: 'Taxes & depreciation',
    definition:
      'Pre-tax cash flow minus the income tax on taxable income (NOI − mortgage interest − depreciation). Because depreciation is a non-cash deduction, after-tax cash flow is often higher than pre-tax — the core reason a "negative" pre-tax rental can still be a good deal.',
    seeAlso: ['Cash flow', 'Depreciation', 'Marginal tax rate'],
  },
  {
    term: 'Appreciation',
    category: 'General',
    definition:
      'The increase in a property\'s value over time. In Quoin it is an assumption you set, not a forecast — and it drives the modeled sale that dominates many IRRs.',
    seeAlso: ['IRR', 'Terminal value'],
  },
  {
    term: 'Sensitivity analysis',
    category: 'General',
    definition:
      'Testing how much an output (IRR, cash-on-cash, cap rate) moves when the inputs move. Because Quoin\'s math is assumption-heavy, it answers the real question: which assumptions actually matter, and how fragile is the deal? Each hold module has a Sensitivity panel.',
    seeAlso: ['Tornado chart', 'Two-way sensitivity grid', 'Pro forma'],
  },
  {
    term: 'Tornado chart',
    category: 'General',
    definition:
      'A ranked bar chart of sensitivity: each input is varied ±a set percentage and the bars, sorted by how far the chosen output swings, form a tornado shape. The top bars are the drivers worth verifying first.',
    seeAlso: ['Sensitivity analysis'],
  },
  {
    term: 'Two-way sensitivity grid',
    category: 'General',
    definition:
      'A table of one output metric evaluated across two inputs at once (e.g. IRR by interest rate × rent). Color-coded against the base case, it shows which combinations of assumptions make or break the deal.',
    seeAlso: ['Sensitivity analysis', 'Tornado chart'],
  },
  {
    term: 'Operating expenses',
    category: 'General',
    definition:
      'The recurring costs to run a property — taxes, insurance, maintenance, management, utilities — excluding debt service and capital items. Revenue minus operating expenses is NOI.',
    seeAlso: ['NOI', 'Expense ratio'],
  },
];
