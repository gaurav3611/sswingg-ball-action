# Validation: what has and has not been checked

## Checked here
- The patched model matches the original on 5 random frames, bit for bit (`tools/patch_movenet_input.py`).
- The decoder reads the real model's output in the right order on two public domain photographs (standing portrait: head, shoulders, hips, knees, ankles in order; every confident point inside the model's box). `src/__tests__/real-model.test.ts`.
- The rotation chooser picks the upright orientation from real detections for both photographs.
- Angle formulas against known geometry (right angles, straight lines, signs), with deliberate mutations confirmed to fail the tests.
- On a real cricket bowler photograph the model's person score was 0.20, and most joint scores under 0.3, so most angles were correctly reported unavailable.

## Not checked (so everything pose-related is experimental)
Detection precision and recall, keypoint error in pixels, event timing error, ball tracking and speed error: **no annotated cricket video was available**, so none of these were measured. Do not quote any accuracy for this app.

## Plan before calling pose features validated
1. Collect video with permission, covering fast, medium and spin bowlers, side, front and rear views, daylight and shade, different clothing, body types, partial occlusion, and at least three phone models.
2. Annotate 17 points (or 33 for BlazePose) on a sample of frames, and mark phase events (back foot contact, front foot contact, release) frame by frame.
3. Split by bowler and session, not by frame, into train (if any model is trained), validation and held-out test sets, so no bowler appears in two sets.
4. Report: person detection precision and recall at IoU 0.5; per-joint mean error as a fraction of torso length (and OKS); angle error against angles from the annotations; phase event timing error in ms; the same for each phone and each view.
5. Compare MoveNet with MediaPipe Pose Landmarker (33 points, with heels and foot indices) on the same set before choosing. The `Keypoint` type is the seam for swapping the model.
6. For speed: a radar gun or a calibrated two-camera rig as the reference.
