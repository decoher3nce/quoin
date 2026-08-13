import type { TaxProfile } from '../core/types';

// Reusable tax profiles for depreciable, held real property. A module attaches
// one ONLY when straight-line depreciation + recapture + capital-gains-at-sale is
// the right model. `basis` returns the depreciable ACQUISITION cost (land +
// improvements); the land fraction is carved out separately (global setting, or a
// per-profile default for land-heavy assets). Residential rental = 27.5-year
// recovery; commercial and transient (STR) property = 39-year.

const n = (i: Record<string, number>, k: string) => i[k] ?? 0;

/** Standard residential rental: 27.5-yr, basis = purchase price. */
export const RESIDENTIAL_TAX: TaxProfile = {
  recoveryYears: 27.5,
  basis: (i) => n(i, 'purchasePrice'),
};

/** Standard commercial / transient property: 39-yr, basis = purchase price. */
export const COMMERCIAL_TAX: TaxProfile = {
  recoveryYears: 39,
  basis: (i) => n(i, 'purchasePrice'),
};

/** BRRRR: cost basis is purchase + rehab (a capital improvement), not ARV. */
export const BRRRR_TAX: TaxProfile = {
  recoveryYears: 27.5,
  basis: (i) => n(i, 'purchasePrice') + n(i, 'rehabBudget'),
};

/** Wildfire-hardened rental: basis includes the hardening retrofit. */
export const WILDFIRE_TAX: TaxProfile = {
  recoveryYears: 27.5,
  basis: (i) => n(i, 'purchasePrice') + n(i, 'hardeningRetrofitCost'),
};

/** ADU: the whole all-in build cost is a depreciable improvement (land already owned). */
export const ADU_TAX: TaxProfile = {
  recoveryYears: 27.5,
  basis: (i) => n(i, 'aduBuildCost') * (1 + n(i, 'softCostsPct')),
  landFractionDefault: 0,
};

/** Purpose-built structure on owned land (experiential / dark-sky cabins): 39-yr. */
export const BUILD_ON_LAND_TAX: TaxProfile = {
  recoveryYears: 39,
  basis: (i) => n(i, 'landCost') + n(i, 'buildCost'),
};

/** Operating hospitality with a renovation (motel, event venue): basis = purchase + reno. */
export const RENOVATED_COMMERCIAL_TAX: TaxProfile = {
  recoveryYears: 39,
  basis: (i) => n(i, 'purchasePrice') + n(i, 'renovationBudget'),
};

/** Land-heavy park (mobile-home park): 39-yr, most of the value is non-depreciable land. */
export const MHP_TAX: TaxProfile = {
  recoveryYears: 39,
  basis: (i) => n(i, 'purchasePrice'),
  landFractionDefault: 0.5,
};

/** Land-heavy campground (glamping / RV): basis = land + site development. */
export const GLAMPING_TAX: TaxProfile = {
  recoveryYears: 39,
  basis: (i) => n(i, 'landCost') + n(i, 'siteDevelopmentCostPerSite') * n(i, 'numberOfSites'),
  landFractionDefault: 0.5,
};
