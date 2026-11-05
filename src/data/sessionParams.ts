import { FPS_CHOICES } from '@/capture/capabilities';
import type { CameraView } from '@/pose/types';
import { DELIVERY_TYPES, type DeliveryType, type SessionType } from './types';

export interface SessionParams {
  type: SessionType;
  view: CameraView;
  fps: number;
  intended: DeliveryType;
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * Reads the session choices that travel between screens as route parameters.
 * Anything missing or not one of the allowed values falls back to a default, so a bad link
 * cannot put the camera into a state the app does not offer.
 */
export function parseSessionParams(raw: Record<string, string | string[] | undefined>): SessionParams {
  const type = first(raw.type);
  const view = first(raw.view);
  const fps = Number(first(raw.fps));
  const intended = first(raw.intended);
  return {
    type: type === 'target' || type === 'drill' ? type : 'nets',
    view: view === 'front' || view === 'rear' ? view : 'side',
    fps: (FPS_CHOICES as readonly number[]).includes(fps) ? fps : 30,
    intended: (DELIVERY_TYPES as readonly string[]).includes(intended ?? '') ? (intended as DeliveryType) : 'stock',
  };
}

/** The largest offered rate that is not above the wanted one, else the smallest offered. */
export function clampFps(wanted: number, offered: number[]): number {
  if (offered.length === 0) return wanted;
  const sorted = [...offered].sort((a, b) => a - b);
  const under = sorted.filter((f) => f <= wanted);
  return under.length > 0 ? under[under.length - 1]! : sorted[0]!;
}
