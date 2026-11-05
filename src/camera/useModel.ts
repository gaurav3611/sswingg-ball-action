import { useEffect, useState } from 'react';
import { Asset } from 'expo-asset';
import { loadTensorflowModel, type TensorflowPlugin } from 'react-native-fast-tflite';

/**
 * Loads the bundled pose model.
 *
 * react-native-fast-tflite reads a model with `java.net.URL(path).readBytes()` on Android, so it
 * needs a real URL. In a release build `require('model.tflite')` gives only a bare resource name
 * ("assets_models_movenet_..."), which is not a URL and failed with MalformedURLException.
 * `Asset.downloadAsync` copies the bundled resource into the app's cache and returns its
 * `file://` URI, which the loader can read. In a development build it downloads from the dev
 * server the same way.
 */
export function useModel(source: number): TensorflowPlugin & { path: string | null } {
  const [state, setState] = useState<TensorflowPlugin & { path: string | null }>({ model: undefined, state: 'loading', path: null });

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const asset = await Asset.fromModule(source).downloadAsync();
        const uri = asset.localUri ?? asset.uri;
        const model = await loadTensorflowModel({ url: uri }, []);
        if (live) setState({ model, state: 'loaded', path: uri });
      } catch (e) {
        if (live) setState({ model: undefined, state: 'error', error: e instanceof Error ? e : new Error(String(e)), path: null });
      }
    })();
    return () => {
      live = false;
    };
  }, [source]);

  return state;
}
