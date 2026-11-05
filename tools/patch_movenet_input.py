"""
Fix the input size of the MoveNet MultiPose Lightning model, so it runs in react-native-fast-tflite.

Google ships the model with a placeholder input shape [1, 1, 1, 3] and expects the caller to
resize it to [1, 256, 256, 3] before the first run. react-native-fast-tflite never resizes, so
this script rewrites the two placeholder dimensions in the file. It then proves the result:
the patched model, run with no resize, must give exactly the same output as the original,
resized at runtime, on random frames.

Usage: python tools/patch_movenet_input.py <original.tflite> <patched.tflite>
Needs: pip install ai-edge-litert numpy tflite
"""
import struct
import sys

import numpy as np
import tflite
from ai_edge_litert.interpreter import Interpreter

SIZE = 256


def patch(original: str, patched: str) -> None:
    data = bytearray(open(original, "rb").read())
    graph = tflite.Model.GetRootAsModel(bytes(data), 0).Subgraphs(0)
    inputs = graph.InputsAsNumpy()
    if len(inputs) != 1:
        sys.exit(f"expected one input tensor, found {len(inputs)}")
    tensor = graph.Tensors(int(inputs[0]))
    if tensor.ShapeAsNumpy().tolist() != [1, 1, 1, 3]:
        sys.exit(f"input shape is {tensor.ShapeAsNumpy().tolist()}, not the placeholder [1, 1, 1, 3]")
    # Offset 4 is the "shape" field of a Tensor; Vector() gives where its first element is.
    first = tensor._tab.Vector(tensor._tab.Offset(4))
    data[first + 4 : first + 12] = struct.pack("<2i", SIZE, SIZE)  # height and width
    open(patched, "wb").write(data)


def run(path: str, frame: np.ndarray, resize: bool) -> np.ndarray:
    it = Interpreter(model_path=path)
    inp = it.get_input_details()[0]
    if resize:
        it.resize_tensor_input(inp["index"], [1, SIZE, SIZE, 3])
    it.allocate_tensors()
    inp = it.get_input_details()[0]
    assert inp["shape"].tolist() == [1, SIZE, SIZE, 3], inp["shape"]
    it.set_tensor(inp["index"], frame.astype(inp["dtype"]))
    it.invoke()
    return it.get_tensor(it.get_output_details()[0]["index"])


def main() -> None:
    original, patched = sys.argv[1], sys.argv[2]
    patch(original, patched)
    rng = np.random.default_rng(7)
    for n in range(5):
        frame = rng.integers(0, 256, size=(1, SIZE, SIZE, 3))
        a = run(original, frame, resize=True)
        b = run(patched, frame, resize=False)
        if not np.array_equal(a, b):
            sys.exit(f"patched model differs from the original on frame {n}")
    print(f"ok: patched model matches the original on 5 random frames, output {b.shape}")


if __name__ == "__main__":
    main()
