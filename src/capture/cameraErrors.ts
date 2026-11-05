/**
 * Turns a camera error code from Vision Camera into words a person can act on.
 *
 * The codes are the `code` field of Vision Camera's CameraRuntimeError, for example
 * 'system/camera-is-restricted'. `blocking` means the camera cannot be used until something
 * outside the app changes; the screen then shows the steps and a Try again button. A message
 * is never hidden: when a code is not known, the original text is shown with it.
 */
export interface CameraProblem {
  title: string;
  detail: string;
  /** What the person can do, in order. */
  steps: string[];
  /** True if the camera cannot work until the person does one of the steps. */
  blocking: boolean;
  /** True if "Try again" is worth offering. */
  retry: boolean;
  /** True if the phone settings are the place to fix it. */
  settings: boolean;
}

export function describeCameraError(code: string, message: string): CameraProblem {
  switch (code) {
    case 'system/camera-is-restricted':
      return {
        title: 'Android has turned the camera off',
        detail:
          'Android reported the camera as disabled. The app cannot switch it on. This happens when the camera privacy switch is off, when a work or school profile or a device policy blocks the camera, or when parental controls or another app have taken it.',
        steps: [
          'Pull down the quick settings and make sure "Camera access" is on.',
          'In Settings, open Privacy, then Permission manager, then Camera, and allow SSwinGG Ball Action.',
          'Close any app that may be using the camera: screen recorders, video calls, other camera apps.',
          'If this phone belongs to a school or employer, the camera may be blocked by their policy. Ask them, or use another phone.',
        ],
        blocking: true,
        retry: true,
        settings: true,
      };
    case 'permission/camera-permission-denied':
      return {
        title: 'Camera permission is off',
        detail: 'The app needs the camera to record and to find the bowler.',
        steps: ['Open the phone settings for this app and allow Camera.'],
        blocking: true,
        retry: true,
        settings: true,
      };
    case 'device/camera-already-in-use':
    case 'system/max-cameras-in-use':
      return {
        title: 'Another app is using the camera',
        detail: 'Only one app can use the camera at a time.',
        steps: ['Close the other app (a call, a screen recorder, another camera app), then try again.'],
        blocking: true,
        retry: true,
        settings: false,
      };
    case 'system/do-not-disturb-bug':
      return {
        title: 'Do not disturb is blocking the camera',
        detail: 'Android 9 has a bug that stops the camera opening while Do not disturb is on.',
        steps: ['Turn off Do not disturb, then try again.'],
        blocking: true,
        retry: true,
        settings: false,
      };
    case 'device/no-device':
    case 'device/invalid-device':
      return {
        title: 'No camera found',
        detail: 'This phone did not report a usable back camera.',
        steps: ['Restart the phone and try again.'],
        blocking: true,
        retry: true,
        settings: false,
      };
    case 'format/invalid-fps':
    case 'format/invalid-format':
    case 'parameter/invalid-combination':
    case 'session/hardware-cost-too-high':
    case 'device/configuration-error':
      return {
        title: 'The camera could not start with these settings',
        detail: 'The phone refused this frame rate and size together.',
        steps: ['Go back and choose a lower frame rate, such as 30.'],
        blocking: true,
        retry: false,
        settings: false,
      };
    case 'capture/insufficient-storage':
    case 'capture/file-io-error':
    case 'capture/create-temp-file-error':
      return {
        title: 'The video could not be saved',
        detail: 'The phone ran out of space or could not write the file.',
        steps: ['Free some storage space, then record again.'],
        blocking: false,
        retry: true,
        settings: false,
      };
    default:
      return {
        title: 'Camera problem',
        detail: message || 'The camera reported an error.',
        steps: ['Try again. If it keeps happening, close the app and open it again.'],
        blocking: false,
        retry: true,
        settings: false,
      };
  }
}
