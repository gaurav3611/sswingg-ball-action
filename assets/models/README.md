# Pose model

`movenet_multipose_lightning_256.tflite` is Google's MoveNet MultiPose Lightning (float16),
Apache License 2.0, from TensorFlow Hub:
`https://tfhub.dev/google/lite-model/movenet/multipose/lightning/tflite/float16/1`.

It finds up to 6 people and 17 body points each. It has no heel or foot points.

Google ships it with a placeholder input size of 1 by 1. `react-native-fast-tflite` does not resize
inputs, so `tools/patch_movenet_input.py` rewrites the two dimensions to 256 by 256 and then checks that
the patched model gives bit-identical output to the original on random frames.

| File | SHA-256 |
|---|---|
| Original download | `d4489f89e6bd6777a8b9a1a16189832131f84ff90d82fae729e670b84d7948dd` |
| `movenet_multipose_lightning_256.tflite` | `17d2e02acdc556e0053aa88e17226f7716cdde69a59ad4659d89a14b983bfca0` |

To rebuild: download the original, then
`python tools/patch_movenet_input.py original.tflite assets/models/movenet_multipose_lightning_256.tflite`
(needs `pip install ai-edge-litert numpy tflite`).

Input: `uint8` RGB, `[1, 256, 256, 3]`. Output: `float32` `[1, 6, 56]`. Per person: 17 points of
(y, x, score), then the box (ymin, xmin, ymax, xmax) and a person score. See `src/pose/decode.ts`.
