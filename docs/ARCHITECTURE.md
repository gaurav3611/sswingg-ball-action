# Architecture

```
 Camera (Vision Camera 4)            JavaScript thread
 ┌──────────────────────┐   336 numbers + timestamp   ┌──────────────────────────────┐
 │ frame processor      │ ──────────────────────────► │ PoseEngine                    │
 │  count every frame   │                             │  decode → track → smooth      │
 │  ~10 Hz: crop whole  │                             │  → choose bowler → status     │
 │  frame, rotate,      │                             │  → keep frames while recording│
 │  resize 256x256,     │                             └───────────────┬──────────────┘
 │  MoveNet (fast-tflite)│                                            │ people, status
 └──────────┬───────────┘                                             ▼
            │ H.264 mp4                                    Live screen: overlay, HUD
            ▼
   adoptVideo()  +  pose.json  ──►  <documents>/sessions/<id>/       AsyncStorage: bowlers, sessions, settings
                                                                      Secure store: password hashes
            Session screen: expo-video replay + pose track (frameAt) + computeAngles + AngleChart
```

## Layers

| Layer | Folder | Depends on |
|---|---|---|
| Presentation | `src/app`, `src/components`, `src/theme` | everything below |
| Camera | `src/camera` | pose, capture, data |
| Pose estimation | `src/pose` | nothing (pure) |
| Biomechanics | `src/biomechanics` | pose (pure) |
| Capture analytics | `src/capture` | nothing (pure) |
| Storage, auth, API | `src/data`, `src/state` | expo modules |

The pure layers have no React or native imports, so the whole path from model output to saved pose track and angle is tested on a laptop. API and cloud processing are designed ([API.md](API.md)) but not built; the app is on-device first and works offline.

## Pipeline against the spec (section 14)

| Step | Status |
|---|---|
| Video decoding | Replay by expo-video. Pose is computed live from the camera, not from decoded video. |
| Camera metadata | Requested and delivered fps, resolution, format maximum, device, OS, app version stored |
| Bowler detection and tracking | MoveNet multi-person plus box matching (`tracker.ts`), tap to choose, auto choose largest |
| Pose estimation | MoveNet MultiPose Lightning, 17 points, behind the `Keypoint` type so another model can replace it |
| Temporal smoothing | One Euro filter per point |
| Phase detection, ball tracking, calibration, classification, coaching | Not built |
| Joint angles | Elbow, arm elevation, knees, trunk tilt, shoulder and hip line tilt (2D) |
| Metric confidence | Weakest joint score; three bands in the UI |

## Frame orientation

The camera frame is turned differently depending on how the phone is held. Instead of assuming a mapping, the app runs the model on all four turns for about a second and picks the one that shows an upright person (`chooseRotation`, tested on real model output). The result is remembered per frame orientation name and can be reset in Settings.

## Timing

The frame processor counts every frame (so the real frame rate is known) and runs the model about 10 times a second. The pose track starts when counting starts; the video starts slightly later. The offset is estimated as (counted span minus video duration), clamped, stored per session and adjustable. Pauses are kept out of both.

## Data model on the phone

`Account`, `BowlerProfile`, `Session { capture, pose, deliveries, clips }`, `Settings`: see `src/data/types.ts`. The server version is in [schema.sql](schema.sql).
