import { describeCameraError } from '@/capture/cameraErrors';
import { diagnosticState, ema, landmarkSummary } from '@/capture/diagnostics';

describe('describeCameraError', () => {
  it('explains the OS restriction and what to do, instead of hiding it', () => {
    const p = describeCameraError('system/camera-is-restricted', 'Camera functionality is not available because it has been restricted by the operating system, possibly due to a device policy.');
    expect(p.blocking).toBe(true);
    expect(p.retry).toBe(true);
    expect(p.settings).toBe(true);
    expect(p.title).toMatch(/turned the camera off/i);
    expect(p.steps.join(' ')).toMatch(/Camera access/);
    expect(p.steps.join(' ')).toMatch(/policy/);
    expect(p.detail).toMatch(/cannot switch it on/);
  });

  it('knows the permission, in-use and settings errors', () => {
    expect(describeCameraError('permission/camera-permission-denied', '').settings).toBe(true);
    expect(describeCameraError('device/camera-already-in-use', '').title).toMatch(/Another app/);
    expect(describeCameraError('format/invalid-fps', '').steps[0]).toMatch(/lower frame rate/);
    const storage = describeCameraError('capture/insufficient-storage', '');
    expect(storage.blocking).toBe(false);
    expect(storage.retry).toBe(true);
  });

  it('keeps the original message for a code it does not know', () => {
    const p = describeCameraError('something/new', 'Odd failure 42');
    expect(p.detail).toBe('Odd failure 42');
    expect(p.blocking).toBe(false);
    expect(describeCameraError('x', '').detail).toBeTruthy();
  });
});

describe('diagnosticState', () => {
  const ok = { cameraError: false, cameraReady: true, model: 'ready' as const, orientationReady: true, analysedFrames: 10, peopleInView: 1, tracking: 'tracking' as const };

  it('reports tracking only when the bowler is followed', () => {
    expect(diagnosticState(ok)).toBe('TRACKING');
    expect(diagnosticState({ ...ok, tracking: 'low-confidence' })).toBe('TRACKING');
    expect(diagnosticState({ ...ok, tracking: 'searching' })).toBe('READY');
    expect(diagnosticState({ ...ok, tracking: 'lost' })).toBe('READY');
  });

  it('reports no person when the model runs and finds no one', () => {
    expect(diagnosticState({ ...ok, peopleInView: 0 })).toBe('NO_PERSON_DETECTED');
    expect(diagnosticState({ ...ok, orientationReady: false, peopleInView: 0 })).toBe('NO_PERSON_DETECTED');
  });

  it('puts errors first, camera before model', () => {
    expect(diagnosticState({ ...ok, model: 'error' })).toBe('MODEL_ERROR');
    expect(diagnosticState({ ...ok, cameraError: true, model: 'error' })).toBe('CAMERA_ERROR');
  });

  it('is initializing until the camera and model are both ready', () => {
    expect(diagnosticState({ ...ok, cameraReady: false })).toBe('INITIALIZING');
    expect(diagnosticState({ ...ok, model: 'loading' })).toBe('INITIALIZING');
    expect(diagnosticState({ ...ok, analysedFrames: 0 })).toBe('READY');
  });
});

describe('helpers', () => {
  it('averages with more weight on the latest value', () => {
    expect(ema(null, 10)).toBe(10);
    expect(ema(10, 20, 0.5)).toBe(15);
  });
  it('counts only landmarks the model is sure of', () => {
    expect(landmarkSummary([0.9, 0.5, 0.29, 0.1])).toEqual({ count: 2, meanScore: 0.7 });
    expect(landmarkSummary([0.1])).toEqual({ count: 0, meanScore: null });
    expect(landmarkSummary([])).toEqual({ count: 0, meanScore: null });
  });
});
