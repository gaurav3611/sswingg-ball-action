import type { Settings } from './types';

/**
 * A guard against a camera screen that keeps stopping the app.
 *
 * Opening the camera screen with pose tracking on sets a flag. The flag is cleared once the screen
 * has worked for a few seconds, or when the person leaves it normally. If the app is stopped
 * while the flag is set (the phone says "app is not responding" and the app is closed), the flag
 * is still there at the next start, and pose tracking is turned off. Recording does not need
 * pose tracking, so it keeps working, and Settings says what happened and how to turn it back on.
 */
export function applyLiveGuard(settings: Settings, guardPresent: boolean): Settings {
  if (!guardPresent || !settings.poseTracking) return settings;
  return { ...settings, poseTracking: false, poseAutoDisabled: true };
}
