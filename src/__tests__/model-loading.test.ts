/**
 * The pose model failed to load in the first release build because a bare resource name was
 * passed to a loader that only accepts URLs. These tests pin the fix: the loader must get the
 * file URL that expo-asset produces, never the bare name.
 */
import { renderHook, waitFor } from '@testing-library/react-native';

const mockDownload = jest.fn();
const mockLoad = jest.fn();
jest.mock('expo-asset', () => ({ Asset: { fromModule: () => ({ downloadAsync: mockDownload }) } }));
jest.mock('react-native-fast-tflite', () => ({ loadTensorflowModel: (...a: unknown[]) => mockLoad(...a) }));

import { useModel } from '@/camera/useModel';

beforeEach(() => {
  mockDownload.mockReset();
  mockLoad.mockReset();
});

describe('useModel', () => {
  it('loads the model from the cached file URL, not from the bare resource name', async () => {
    mockDownload.mockResolvedValue({ localUri: 'file:///data/user/0/app/cache/ExponentAsset-abc.tflite', uri: 'assets_models_movenet_multipose_lightning_256' });
    mockLoad.mockResolvedValue({ fake: 'model' });
    const { result } = await renderHook(() => useModel(1));
    await waitFor(() => expect(result.current.state).toBe('loaded'));
    expect(mockLoad).toHaveBeenCalledWith({ url: 'file:///data/user/0/app/cache/ExponentAsset-abc.tflite' }, []);
    expect(result.current.model).toEqual({ fake: 'model' });
  });

  it('falls back to the asset uri when there is no local copy (a development build)', async () => {
    mockDownload.mockResolvedValue({ localUri: null, uri: 'http://192.168.1.5:8081/assets/model.tflite' });
    mockLoad.mockResolvedValue({});
    const { result } = await renderHook(() => useModel(1));
    await waitFor(() => expect(result.current.state).toBe('loaded'));
    expect(mockLoad).toHaveBeenCalledWith({ url: 'http://192.168.1.5:8081/assets/model.tflite' }, []);
  });

  it('reports an error, with the message, when the file cannot be copied or read', async () => {
    mockDownload.mockRejectedValue(new Error('Resource not found'));
    const { result } = await renderHook(() => useModel(1));
    await waitFor(() => expect(result.current.state).toBe('error'));
    expect(result.current.state === 'error' && result.current.error.message).toBe('Resource not found');
    expect(mockLoad).not.toHaveBeenCalled();
  });

  it('reports an error when the loader rejects, even with a non-Error value', async () => {
    mockDownload.mockResolvedValue({ localUri: 'file:///x.tflite', uri: 'x' });
    mockLoad.mockRejectedValue('bad model');
    const { result } = await renderHook(() => useModel(1));
    await waitFor(() => expect(result.current.state).toBe('error'));
    expect(result.current.state === 'error' && result.current.error.message).toBe('bad model');
  });
});
