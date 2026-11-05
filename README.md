# SSwinGG Ball Action

Understand your action. Control your delivery. Improve your game.

An Android app that films a bowling session, follows the bowler with an on-device pose model, and shows a skeleton and joint-angle estimates on a slow-motion, frame-by-frame replay. Every number is labelled as measured, estimated, entered by hand, or unavailable.

Built from `SSwinGG_Ball_Action_Master_App_Specification.pdf`. This is **Phase 1 and the first version of Phase 2**. See [What works](#what-works) and [Known limitations](#known-limitations).

## What works

| Feature | Status |
|---|---|
| Onboarding, local sign-in, bowler profiles (several per account, optional details) | Working |
| Camera preview, camera permission handling, recording | Working |
| Frame rates 30, 60, 120, 240 offered only where the phone reports them; delivered rate counted and stored | Working |
| Session storage, history, replay, slow motion (0.25x, 0.5x), frame step, clip ranges, retake | Working |
| Settings and privacy: retention, export, delete session, delete everything, one-video-at-a-time share | Working |
| Analyse a video from the phone: frame-by-frame skeleton and angles, no camera needed | Experimental |
| Bowler tracking and skeleton overlay (MoveNet, 17 points, stable track ids, tap to choose the bowler) | Experimental |
| Joint angle estimates with confidence and reason when unavailable | Experimental |
| Phase detection, biomechanics, run-up, speed, ball tracking, classification, coaching, coach access | Not built (Phases 3 to 6) |

"Working" means implemented and covered by tests listed in [docs/TESTING.md](docs/TESTING.md). "Experimental" means it runs but has not been checked against real cricket measurements ([docs/VALIDATION.md](docs/VALIDATION.md)).

## Install

A release APK is built with:

```bash
export ANDROID_HOME=$HOME/Library/Android/sdk
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
npm install
npx expo prebuild --platform android --no-install
cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
# android/app/build/outputs/apk/release/app-release.apk
```

It is signed with the debug key, so it installs on any phone but is not for the Play Store. Allow installs from unknown sources, then open the file. `arm64-v8a` covers nearly all current phones.

Needs Node 20 or newer, JDK 21, Android SDK with the NDK. If the Gradle download times out in Java, download the zip named in `android/gradle/wrapper/gradle-wrapper.properties` with curl and point `distributionUrl` at the local file.

## Develop

```bash
npm run verify        # typecheck and all tests
npx expo start --dev-client    # after installing a development build
```

There are no environment variables. The app talks to no server.

## Use

1. Create an account and a bowler profile.
2. Analyse, then Start new session: bowler, session type, camera view, frame rate, intended delivery.
3. Read the camera setup guide, allow the camera, open it. Stand in view for a moment: the app checks how the camera is turned.
4. Record. Mark each delivery with the flag button. Pause, resume, stop.
5. The session screen replays the video with the skeleton, angles at the current moment, and how it was recorded.

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Metric definitions and limits: [docs/METRICS.md](docs/METRICS.md). Backend and database design (not built): [docs/API.md](docs/API.md), [docs/schema.sql](docs/schema.sql).

## Known limitations

- **Android only.** iOS is not built or tested.
- **Not run on a physical phone here.** See docs/TESTING.md for what was run (unit tests, real-model fixtures, an Android build, an emulator with a virtual camera) and what was not.
- **One camera view gives a flat picture.** All angles are projected image angles, not 3D joint angles. Hip and shoulder separation, forearm rotation and wrist angles are not computed.
- **The pose model is general purpose.** MoveNet was not trained for cricket. On a real cricket photograph in the tests it found the bowler with a person score of only 0.20. Expect misses in fast, blurred or crowded footage. Accuracy on cricket video is not measured yet.
- **No heel or foot points.** MoveNet has 17 points and none are on the feet.
- **The skeleton is sampled about 10 times a second**, not on every video frame, whatever the video frame rate is. Overlay timing has an estimated offset (adjustable) and can drift up to 0.1 s per pause.
- **The whole frame is squashed to a 256 by 256 square** for the model, which lowers accuracy compared with padding.
- **Deliveries are marked by hand.** Phase detection is Phase 3.
- **Ball speed, spin, swing, line, length, momentum and distance are not measured.** There is no calibration step yet.
- **Local sign-in only.** It separates people on a shared phone and hashes passwords with a salt, but it is not server authentication. There is no password reset.
- **120 and 240 fps** are offered if the phone reports them. Whether the pipeline keeps up is shown after recording (requested against delivered rate), not assumed.
- **Pose tracking can be switched off** in Settings. If the camera screen ever stops the app, tracking is turned off automatically at the next start so that recording keeps working. Without tracking there is no skeleton and no delivered-frame-rate count.
- Phone turned during a recording: the skeleton is hidden if the video and pose track shapes differ.

## Licences

MoveNet: Apache 2.0 (Google). Lucide icons: ISC. Inter and Source Serif 4: SIL Open Font License. `flutter_blue_plus` is not used here. Test fixtures are numbers produced from two public domain photographs; the photographs are not stored (credits in `src/__tests__/fixtures/movenet-real-output.json`).
