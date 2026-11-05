# Metrics: definitions, assumptions, limits

**Coordinate system.** The camera frame turned upright. x to the right, y down. Angles are computed in pixels (x times frame width, y times frame height) because the model's 0 to 1 units stretch the two axes by different amounts and would bend every angle.

**Kind.** Every pose metric is `estimated`. It is the angle as projected onto the image by one camera. A joint bending towards or away from the lens looks straighter than it is. No 3D joint angle is claimed.

**Confidence** is the lowest model score among the points used, 0 to 1. It says how far the inputs can be trusted, not how accurate the number is. Shown as high (0.70 or more), medium (0.45), low. A metric is `unavailable`, with the named joint in the reason, if any point scores under 0.30.

| Metric | Formula | Views | Limits |
|---|---|---|---|
| Elbow angle (bowling, other) | angle at elbow between elbow→shoulder and elbow→wrist, 0 to 180, 180 straight | all | Foreshortened when the arm points at the camera. Not a legal-action measure. |
| Bowling arm elevation | angle at shoulder between shoulder→elbow and shoulder→hip, 0 hanging, 90 level, 180 overhead | all | Same projection limit. |
| Knee angle (left, right) | angle at knee between knee→hip and knee→ankle | all | The model's knee points are often under 0.3 in loose clothing, so this is often unavailable. |
| Trunk tilt | lean of mid-hip→mid-shoulder away from vertical, positive to image right | all | In side view it is forward or back lean, in front or rear view lateral lean. Which way is "forward" depends on bowler direction, not known until Phase 3. |
| Shoulder line tilt, hip line tilt | tilt of the line through both points from horizontal, positive when image right is lower | front, rear | Frontal-plane roll only. |

**Not computed, on purpose.** Hip and shoulder separation and forearm pronation or supination are rotations about the body's long axis. They cannot be read from a 2D image line, and MoveNet has no hand or foot points. Wrist angles need a hand model. Stride length, bound distance, release height and run-up speed need distance calibration. Ball speed needs ball tracking, calibration and 120 fps or faster. None are shown.

**Momentum** (Phase 4) will be p = m times v with m typed in and v from calibrated tracking. It is a whole-body proxy, not ground reaction force, impulse or energy transfer.

**Frame timing.** `deliveredFps` = (frames counted minus 1) / seconds between first and last frame, measured in the frame processor. Dropped frames are an estimate: frames expected at the requested rate minus frames counted. Timestamps over 100,000 units per frame are read as nanoseconds.
