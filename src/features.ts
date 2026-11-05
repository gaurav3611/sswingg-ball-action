/**
 * What this version of the app can and cannot do, in one list.
 *
 * Screens that are not built yet open a page that says so and names the phase that adds them,
 * instead of showing numbers that were not measured. Keep this list honest: a feature is
 * "working" only when it is implemented and tested (docs/TESTING.md says how each is tested).
 */
export type FeatureStatus = 'working' | 'experimental' | 'planned';

export interface Feature {
  id: string;
  title: string;
  status: FeatureStatus;
  phase: 1 | 2 | 3 | 4 | 5 | 6;
  /** One sentence: what it does now, or what it will do. */
  summary: string;
  /** For planned features: what has to exist first. */
  needs?: string;
}

export const FEATURES: Feature[] = [
  { id: 'camera', title: 'Camera preview and recording', status: 'working', phase: 1,
    summary: 'Records real video with the camera, at a frame rate the phone reports, and stores it on the phone.' },
  { id: 'sessions', title: 'Sessions, history and replay', status: 'working', phase: 1,
    summary: 'Saves each recording with its settings, and plays it back in slow motion, frame by frame, with clip ranges.' },
  { id: 'profiles', title: 'Bowler profiles and local sign-in', status: 'working', phase: 1,
    summary: 'Several bowlers per account, with optional details. Sign-in is local to this phone.' },
  { id: 'privacy', title: 'Privacy, export and deletion', status: 'working', phase: 1,
    summary: 'Video stays on the phone. You can export your records, delete a session, or delete everything.' },
  { id: 'pose', title: 'Bowler tracking and skeleton overlay', status: 'experimental', phase: 2,
    summary: 'Finds people in the video, follows the bowler, and draws 17 body points. Not yet validated on cricket footage.',
    needs: 'Accuracy checked on annotated cricket video (docs/VALIDATION.md).' },
  { id: 'angles', title: 'Joint angle estimates', status: 'experimental', phase: 2,
    summary: 'Elbow, arm elevation, knee, trunk and shoulder line angles from one 2D view, each labelled as an estimate with a confidence.',
    needs: 'Comparison with a reference measurement.' },
  { id: 'phases', title: 'Automatic delivery phases', status: 'planned', phase: 3,
    summary: 'Detects run-up, back and front foot contact, release and follow-through, with a timestamp and confidence for each.',
    needs: 'The pose track from Phase 2, and annotated footage to test against.' },
  { id: 'biomechanics', title: 'Biomechanics analysis', status: 'planned', phase: 3,
    summary: 'Angles across the delivery, hip and shoulder timing, trunk movement and repeatability.',
    needs: 'Phase detection.' },
  { id: 'wrist', title: 'Wrist and arm analysis', status: 'planned', phase: 3,
    summary: 'Arm path and wrist position around release, where the camera can see them.',
    needs: 'Phase detection, and a camera frame rate high enough to see the wrist.' },
  { id: 'runup', title: 'Run-up and momentum', status: 'planned', phase: 4,
    summary: 'Approach speed, stride timing and a body-momentum proxy.',
    needs: 'Spatial calibration with a marker of known distance, and the body mass of the bowler.' },
  { id: 'speed', title: 'Ball speed and trajectory', status: 'planned', phase: 4,
    summary: 'Release speed, bounce and line and length, only where they can be validated. Radar-gun speeds can be typed in.',
    needs: 'Ball tracking, spatial calibration, and 120 fps or faster video.' },
  { id: 'classification', title: 'Delivery classification', status: 'planned', phase: 5,
    summary: 'Compares the delivery you intended with what was observed. It will say "unknown" when the evidence is not enough.',
    needs: 'Ball tracking from Phase 4.' },
  { id: 'comparison', title: 'Session comparison and trends', status: 'planned', phase: 5,
    summary: 'Side by side sessions and progress over weeks.',
    needs: 'Metrics from Phase 3 and 4 to compare.' },
  { id: 'coach', title: 'Coaching feedback', status: 'planned', phase: 6,
    summary: 'Feedback that quotes the metric, compares it with your own baseline, and suggests one drill. It will not invent numbers.',
    needs: 'Measured metrics worth giving feedback on, and coach review.' },
  { id: 'sharing', title: 'Coach access and cloud processing', status: 'planned', phase: 6,
    summary: 'Share sessions with a coach, with your consent, and optionally process video on a server.',
    needs: 'The backend in docs/API.md.' },
];

export const featureById = (id: string) => FEATURES.find((f) => f.id === id);

export const STATUS_LABEL: Record<FeatureStatus, string> = {
  working: 'Working',
  experimental: 'Experimental',
  planned: 'Not built yet',
};
