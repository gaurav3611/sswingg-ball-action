/**
 * Checks on app.json that decide which Android permissions the app gets. Once, a plugin option
 * quietly removed the CAMERA permission from the whole app, and the camera screen could never ask
 * for access. These tests keep that from happening again.
 */
import config from '../../app.json';

type Plugin = string | [string, Record<string, unknown>];
const plugins = config.expo.plugins as Plugin[];
const options = (name: string) => {
  const p = plugins.find((x) => (Array.isArray(x) ? x[0] : x) === name);
  return Array.isArray(p) ? p[1] : {};
};

describe('app.json permissions', () => {
  it('lets the camera plugin ask for the camera and never for the microphone', () => {
    expect(plugins.some((p) => (Array.isArray(p) ? p[0] : p) === 'react-native-vision-camera')).toBe(true);
    expect(options('react-native-vision-camera').enableMicrophonePermission).toBe(false);
    expect(String(options('react-native-vision-camera').cameraPermissionText)).toMatch(/camera|film/i);
  });

  it('does not let the video picker block the camera permission for the whole app', () => {
    expect(options('expo-image-picker').cameraPermission).not.toBe(false);
  });

  it('blocks the microphone in the video picker and asks for no photo access', () => {
    expect(options('expo-image-picker').microphonePermission).toBe(false);
    expect(options('expo-image-picker').photosPermission).toBe(false);
  });

  it('blocks the permissions the app never needs, and never blocks the camera', () => {
    const blocked = config.expo.android.blockedPermissions as string[];
    for (const p of ['READ_PHONE_STATE', 'BLUETOOTH_CONNECT', 'BLUETOOTH_SCAN', 'NEARBY_WIFI_DEVICES', 'ACCESS_FINE_LOCATION', 'RECORD_AUDIO']) {
      expect(blocked).toContain(`android.permission.${p}`);
    }
    expect(blocked).not.toContain('android.permission.CAMERA');
  });

  it('declares the Android package and a version code that goes up', () => {
    expect(config.expo.android.package).toBe('com.sswingg.ballaction');
    expect(config.expo.android.versionCode).toBeGreaterThanOrEqual(7);
  });
});
