/**
 * How every number in the app says where it came from.
 *
 *   measured     read directly from a calibrated sensor or a validated method
 *   estimated    computed from what the camera sees, with the limits of that method
 *   manual       typed in by the user, for example a radar-gun speed
 *   unavailable  could not be worked out, and `reason` says why
 *
 * Nothing in this version is "measured": every pose metric is an estimate from a single 2D
 * view. The kind exists so that a later phase can add measured values without changing screens.
 */
export type MeasurementKind = 'measured' | 'estimated' | 'manual' | 'unavailable';

export interface Measurement {
  /** The number, or null when it is unavailable. */
  value: number | null;
  unit: string;
  kind: MeasurementKind;
  /** 0 to 1. How far the inputs can be trusted, not how accurate the number is. Null when unavailable. */
  confidence: number | null;
  /** Why the value is missing, or the main limit of an estimate. */
  reason?: string;
}

export function estimated(value: number, unit: string, confidence: number, reason?: string): Measurement {
  return { value, unit, kind: 'estimated', confidence, reason };
}

export function unavailable(unit: string, reason: string): Measurement {
  return { value: null, unit, kind: 'unavailable', confidence: null, reason };
}

export const KIND_LABEL: Record<MeasurementKind, string> = {
  measured: 'Measured',
  estimated: 'Estimated',
  manual: 'Entered by hand',
  unavailable: 'Unavailable',
};

/** A value for display. Unavailable values show "--", never zero. */
export function formatValue(m: Measurement, digits = 0): string {
  return m.value === null ? '--' : m.value.toFixed(digits);
}

/** The words for a confidence: three bands, so that no one reads precision into a decimal. */
export function confidenceBand(c: number | null): 'high' | 'medium' | 'low' | 'none' {
  if (c === null) return 'none';
  if (c >= 0.7) return 'high';
  if (c >= 0.45) return 'medium';
  return 'low';
}
