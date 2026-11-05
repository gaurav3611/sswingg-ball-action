# AGENTS.md

Guidance for AI coding agents working in this repository. Humans should start with [README.md](README.md).

## What this is

SSwinGG Ball Action: an Android app (React Native, Expo SDK 58, TypeScript) that films a bowling session, finds and follows the bowler with an on-device pose model, and draws a skeleton and joint-angle estimates on the replay. It is the Phase 1 and first Phase 2 build of `SSwinGG_Ball_Action_Master_App_Specification.pdf`. Android only: iOS is not built or tested.

It uses the "Ground" theme of the SSwinGG web app (`angular-cricket-frontend`): warm ivory page, forest green brand, Inter and Source Serif 4.

## Read this first

1. **Scientific integrity is the product.** Every number is `measured`, `estimated`, `manual` or `unavailable`, and an unavailable one shows `--` and a reason, never zero (`src/core/measurement.ts`). Nothing here is "measured" from pose: all pose metrics are 2D estimates. Never add a figure that was not computed. Never label an action legal or illegal, or diagnose injury.
2. **Features are `working` only if implemented and tested.** `src/features.ts` is the list. Unbuilt screens open a "not built yet" page, with no sample numbers.
3. **The design rules are checked.** `src/__tests__/design-rules.test.ts` fails on emoji, em or en dashes, exclamation marks, purple, gradients, radii over 8, animation libraries. Radii are 4 (chips), 6 (buttons, inputs), 8 (cards). Icons only through `<Icon>`; add one in `tools/icons.mjs` and run it.
4. **Pose maths is pure and tested.** Keep `src/pose`, `src/biomechanics`, `src/capture` free of React and native imports. Angles are computed in pixels, not 0 to 1 units (the test with a diagonal arm guards this).
5. **The model file is patched.** See `assets/models/README.md` before touching it.
6. **Vision Camera is pinned to 4.7.x.** v5 is a different API. `react-native-fast-tflite` objects must be boxed with `NitroModules.box` to be used in a frame processor.
7. **`android/` is generated** by `npx expo prebuild`. Do not edit it by hand.
8. Expo changes every SDK. Check `node_modules/<pkg>/build/*.d.ts` for the real API before using one.

## Commands

```bash
npm run typecheck        # tsc --noEmit
npm test                 # jest: logic, real-model fixtures, screens, design rules
npm run verify           # both
node tools/icons.mjs     # regenerate src/components/icon-data.ts
python tools/make_icons.py   # regenerate launcher icon and splash
npx expo prebuild --platform android --no-install
cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
```

Build needs JDK 21 (`JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home`) and the Android SDK (`ANDROID_HOME=$HOME/Library/Android/sdk`).

## Code map

| Path | Holds |
|---|---|
| `src/app/` | Routes (Expo Router). Camera screens load their code lazily so the web build never imports camera libraries. |
| `src/camera/` | Everything that touches the camera: `usePoseCamera` (frame processor), `live-screen`, `new-session-form`, `setup-guide` |
| `src/pose/` | Decode, tracker, smoothing, bowler engine, tracking status, rotation choice. Pure. |
| `src/biomechanics/` | Joint angles and angle series. Pure. |
| `src/capture/` | Frame rate capabilities and frame timing. Pure. |
| `src/data/` | Types, storage, local auth, pose file format, validation, retention, export |
| `src/state/app.tsx` | App state and actions |
| `src/components/` | UI primitives, replay player, skeleton overlay, chart |
| `src/theme/tokens.ts` | The Ground theme |
| `tools/` | Model patch script, icon generators |
| `docs/` | Architecture, metrics, validation, API and database design, testing |
