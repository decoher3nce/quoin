// Future geographic + time-series data layer. v1 ships the INTERFACE only.
// Modules declare the signals they want in narrative.dataHooks; the UI displays
// "future: will pull X". No network calls exist in v1.

export interface GeoTimeSeriesQuery {
  signal: string;
  lat?: number;
  lng?: number;
  region?: string;
}

export interface TimeSeriesPoint {
  t: string; // ISO date
  v: number;
}

export interface DataSource {
  // e.g. signal: 'insar-velocity' | 'viirs-radiance' | 'swe'
  //             | 'fire-perimeter' | 'fiber-distance'
  fetch(q: GeoTimeSeriesQuery): Promise<TimeSeriesPoint[] | null>;
}

/**
 * v1 stub. Always resolves null — no data layer is wired yet. Kept as a concrete
 * class so modules and UI can depend on the interface today and swap in a real
 * source later without touching call sites.
 */
export class NullDataSource implements DataSource {
  async fetch(_q: GeoTimeSeriesQuery): Promise<TimeSeriesPoint[] | null> {
    return null;
  }
}

/** Human-readable descriptions for the dataHooks a module may declare. */
export const SIGNAL_CATALOG: Record<string, string> = {
  'insar-velocity': 'InSAR ground-motion velocity (subsidence / uplift, mm/yr)',
  'viirs-radiance': 'VIIRS night-lights radiance (light pollution / darkness)',
  'bortle-class': 'Bortle dark-sky class (visual sky-quality scale)',
  swe: 'Snow-water-equivalent (snowpack depth as water)',
  snotel: 'SNOTEL automated snowpack station telemetry',
  'fire-perimeter-history': 'Historical wildfire perimeter overlap',
  'insurer-withdrawal': 'Insurer market-withdrawal / non-renewal signal',
  'cloud-cover-climatology': 'Long-run cloud-cover fraction (clear-sky nights)',
  'rf-noise': 'Radio-frequency background noise floor',
  'elevation-horizon-mask': 'Terrain horizon mask (sky-view obstruction)',
  'dem-line-of-sight': 'Digital-elevation-model line-of-sight / viewshed',
  'fiber-distance': 'Distance to nearest lit fiber route',
  'ix-distance': 'Distance to nearest internet exchange (IX)',
  'thermal-imagery': 'Thermal imagery (surface-temperature microclimate)',
  'cold-air-drainage-model': 'Cold-air-drainage / frost-pocket model',
};

/** Look up a friendly label for a signal id, falling back to the id itself. */
export function describeSignal(signal: string): string {
  return SIGNAL_CATALOG[signal] ?? signal;
}
