# Testing: what was run, and what was not

## Run (all pass: `npm run verify`)
| What | How | Count |
|---|---|---|
| Pose decode, tracker, smoothing, bowler engine, pausing, tracking status | Jest, synthetic tensors | `src/__tests__/pose.test.ts`, `engine.test.ts` |
| Decoder, angles and rotation choice on real model output | Jest, fixture from the real model on two public domain photos | `real-model.test.ts` |
| Joint angle formulas, angle series | Jest, known geometry | `biomechanics.test.ts` |
| Frame rate capabilities, frame timing (gaps, nanoseconds, pauses), geometry | Jest | `capture.test.ts` |
| Pose file round trip, validation, retention, session parameters | Jest | `data.test.ts` |
| Every screen without a camera renders; unmeasured values show `--` and a reason | Jest + Testing Library | `screens.test.tsx` |
| Design rules (no emoji, dashes, exclamation, purple, gradients, pills, animation libs) | Jest, scans the source | `design-rules.test.ts` |
| Types | `tsc --noEmit` strict | |
| Android build | `assembleRelease`, arm64, Vision Camera, worklets, TFLite, Nitro, resize plugin on React Native 0.88 | built, 56 MB |
| App launches | Release APK installed on an Android 16 arm64 emulator: the splash, fonts and onboarding screen rendered in the Ground theme, the app process stayed alive, no crash from the app in the log | one launch |

The tests were checked by deliberately breaking the code (pixel to unit conversion, trunk sign, bowler ordering, auto-lock threshold) and confirming a test failed each time. Two weak tests found this way were fixed.

The model: patched model equals the original bit for bit on random frames (`tools/patch_movenet_input.py`).

## Not run
- **No physical phone.** Camera preview, recording, pose on live frames, replay, and the frame processor have never run on a camera here. The emulator's own system processes kept timing out (software rendering), so I could not drive past the first screen.
- **Orientation check, overlay alignment, timing offset** and the **delivered frame rate** are untested on hardware. The orientation check is there because I could not verify the frame rotation mapping without a device.
- **120 and 240 fps**: whether the recording pipeline sustains them is unknown until a phone reports it.
- **Pose accuracy on cricket video**: not measured (docs/VALIDATION.md).
- **Android permission denial and revocation paths, offline use, process kills mid recording, storage full**: written, not exercised.
- **iOS**: not built, by request.
- **Accessibility** (TalkBack): labels and roles are set, not checked with a screen reader.

## First thing to do on a phone
Install the APK, create an account and bowler, start a session, stand in view and wait for "Camera orientation found". Record 10 seconds with a delivery mark, open the session, and check: the skeleton sits on the body, stepping one frame moves it, and "How this was recorded" shows a delivered rate near the requested one. Report anything that differs.
