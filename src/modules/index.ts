import type { InvestmentModule, TaxProfile } from '../core/types';
import {
  RESIDENTIAL_TAX,
  COMMERCIAL_TAX,
  BRRRR_TAX,
  WILDFIRE_TAX,
  ADU_TAX,
  BUILD_ON_LAND_TAX,
  RENOVATED_COMMERCIAL_TAX,
  MHP_TAX,
  GLAMPING_TAX,
} from './_tax-profiles';

// Land & resource
import { rawLand } from './raw-land';
import { entitledLotDev } from './entitled-lot-dev';
import { agLandLease } from './ag-land-lease';
import { timberMineralRights } from './timber-mineral-rights';
import { conservationEasement } from './conservation-easement';

// Residential
import { metroCondoLtr } from './metro-condo-ltr';
import { townhomeLtr } from './townhome-ltr';
import { sfrLtr } from './sfr-ltr';
import { smallMultifamily } from './small-multifamily';
import { largeMultifamilyLp } from './large-multifamily-lp';
import { mountainSecondHome } from './mountain-second-home';
import { fixAndFlip } from './fix-and-flip';
import { brrrr } from './brrrr';

// Commercial & industrial
import { nnnRetail } from './nnn-retail';
import { officeLease } from './office-lease';
import { industrialFlex } from './industrial-flex';
import { medicalOffice } from './medical-office';
import { selfStorage } from './self-storage';
import { mobileHomePark } from './mobile-home-park';

// Hospitality & operational
import { strMetro } from './str-metro';
import { strMountain } from './str-mountain';
import { strOwnerOccupied } from './str-owner-occupied';
import { strArbitrage } from './str-arbitrage';
import { strCohosting } from './str-cohosting';
import { strExperiential } from './str-experiential';
import { midTermRental } from './mid-term-rental';
import { boutiqueMotelConversion } from './boutique-motel-conversion';
import { glampingRv } from './glamping-rv';
import { eventVenue } from './event-venue';

// Paper & passive
import { privateLending } from './private-lending';
import { mortgageNotes } from './mortgage-notes';
import { taxLienDeed } from './tax-lien-deed';
import { groundLease } from './ground-lease';
import { reit } from './reit';
import { syndicationLp } from './syndication-lp';

// Value-add & conversion
import { aduBuild } from './adu-build';
import { adaptiveReuse } from './adaptive-reuse';
import { condoConversion } from './condo-conversion';

// Infrastructure & easement
import { solarLandLease } from './solar-land-lease';
import { cellTowerGroundLease } from './cell-tower-ground-lease';
import { evChargingSite } from './ev-charging-site';
import { billboardEasement } from './billboard-easement';
import { datacenterLand } from './datacenter-land';

// Novel (remote-sensing edge)
import { opticalGroundStation } from './optical-ground-station';
import { insarStableLand } from './insar-stable-land';
import { darkskyAstroStr } from './darksky-astro-str';
import { viewshedEasement } from './viewshed-easement';
import { wildfireHardenedArb } from './wildfire-hardened-arb';
import { snowpackIndexedStr } from './snowpack-indexed-str';
import { latencyMicroparcel } from './latency-microparcel';
import { frostpocketCropland } from './frostpocket-cropland';

// The registry. Adding a new investment type is: implement the module, import it,
// add it here. Nothing else in the core UI or engine needs to change. Ordered by
// category so the tab nav reads top-to-bottom sensibly.
export const MODULES: InvestmentModule[] = [
  // Land & resource
  rawLand,
  entitledLotDev,
  agLandLease,
  timberMineralRights,
  conservationEasement,
  // Residential
  metroCondoLtr,
  townhomeLtr,
  sfrLtr,
  smallMultifamily,
  largeMultifamilyLp,
  mountainSecondHome,
  fixAndFlip,
  brrrr,
  // Commercial & industrial
  nnnRetail,
  officeLease,
  industrialFlex,
  medicalOffice,
  selfStorage,
  mobileHomePark,
  // Hospitality & operational
  strMetro,
  strMountain,
  strOwnerOccupied,
  strArbitrage,
  strCohosting,
  strExperiential,
  midTermRental,
  boutiqueMotelConversion,
  glampingRv,
  eventVenue,
  // Paper & passive
  privateLending,
  mortgageNotes,
  taxLienDeed,
  groundLease,
  reit,
  syndicationLp,
  // Value-add & conversion
  aduBuild,
  adaptiveReuse,
  condoConversion,
  // Infrastructure & easement
  solarLandLease,
  cellTowerGroundLease,
  evChargingSite,
  billboardEasement,
  datacenterLand,
  // Novel
  opticalGroundStation,
  insarStableLand,
  darkskyAstroStr,
  viewshedEasement,
  wildfireHardenedArb,
  snowpackIndexedStr,
  latencyMicroparcel,
  frostpocketCropland,
];

// Depreciability policy in one auditable place. A module gets an after-tax toggle
// ONLY if it appears here — i.e. it holds a depreciable building and produces a
// projection. Deliberately absent: raw land & land leases (no depreciation),
// flips (ordinary income / dealer treatment), notes / REITs / LP interests
// (different regimes), and personal-use property (vacation-home rules).
const TAX_PROFILES: Record<string, TaxProfile> = {
  // Residential rentals — 27.5-year recovery
  'metro-condo-ltr': RESIDENTIAL_TAX,
  'townhome-ltr': RESIDENTIAL_TAX,
  'sfr-ltr': RESIDENTIAL_TAX,
  'small-multifamily': RESIDENTIAL_TAX,
  'mid-term-rental': RESIDENTIAL_TAX,
  brrrr: BRRRR_TAX,
  'adu-build': ADU_TAX,
  'wildfire-hardened-arb': WILDFIRE_TAX,
  // Commercial — 39-year recovery
  'nnn-retail': COMMERCIAL_TAX,
  'office-lease': COMMERCIAL_TAX,
  'industrial-flex': COMMERCIAL_TAX,
  'medical-office': COMMERCIAL_TAX,
  'self-storage': COMMERCIAL_TAX,
  'mobile-home-park': MHP_TAX,
  // Transient / hospitality holds — 39-year recovery
  'str-metro': COMMERCIAL_TAX,
  'str-mountain': COMMERCIAL_TAX,
  'snowpack-indexed-str': COMMERCIAL_TAX,
  'str-experiential': BUILD_ON_LAND_TAX,
  'darksky-astro-str': BUILD_ON_LAND_TAX,
  'boutique-motel-conversion': RENOVATED_COMMERCIAL_TAX,
  'event-venue': RENOVATED_COMMERCIAL_TAX,
  'glamping-rv': GLAMPING_TAX,
};

for (const m of MODULES) {
  const profile = TAX_PROFILES[m.id];
  if (profile) m.taxProfile = profile;
}

export const MODULE_BY_ID: Record<string, InvestmentModule> = Object.fromEntries(
  MODULES.map((m) => [m.id, m]),
);

export function getModule(id: string): InvestmentModule | undefined {
  return MODULE_BY_ID[id];
}
