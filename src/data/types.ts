import type { Rotation } from '@/pose/geometry';
import type { CameraView, Side } from '@/pose/types';

export type Role = 'bowler' | 'coach';

/** The signed-in person. Local to this phone in this version, see docs/API.md for the server design. */
export interface Account {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: string;
}

export type BowlingStyle = 'fast' | 'medium' | 'swing' | 'seam' | 'spin';
export type Experience = 'junior' | 'club' | 'academy' | 'advanced';

export interface BowlerProfile {
  id: string;
  /** The account that created and owns this profile. */
  ownerId: string;
  name: string;
  /** Optional on purpose: the person decides what to share. */
  age: number | null;
  heightCm: number | null;
  massKg: number | null;
  bowlingArm: Side;
  style: BowlingStyle;
  experience: Experience;
  preferredView: CameraView;
  createdAt: string;
}

export type SessionType = 'nets' | 'target' | 'drill';

export const DELIVERY_TYPES = [
  'stock',
  'outswing',
  'inswing',
  'yorker',
  'bouncer',
  'slower-ball',
  'cutter',
  'cross-seam',
  'leg-spin',
  'off-spin',
  'googly',
  'doosra',
  'top-spin',
  'slider',
  'flipper',
  'arm-ball',
] as const;
export type DeliveryType = (typeof DELIVERY_TYPES)[number];

/**
 * A delivery that the user marked while recording. Marking is manual in this version:
 * detecting a delivery from the pose is Phase 3. Only the intended delivery is stored,
 * because nothing here can observe what the ball actually did.
 */
export interface DeliveryMarker {
  id: string;
  /** Milliseconds from the start of the recording. */
  tMs: number;
  intended: DeliveryType;
  source: 'manual';
}

/** A start and end that the user chose for a part of the recording. The video file is not cut. */
export interface ClipRange {
  id: string;
  startMs: number;
  endMs: number;
  label: string;
}

/** What the camera was set to and what it really delivered. Both are kept, side by side. */
export interface CaptureInfo {
  /** Where the video came from. Missing means recorded with the camera. */
  source?: 'camera' | 'imported';
  requestedFps: number;
  /** Frames per second that really arrived at the camera's frame processor. Null if unknown. */
  deliveredFps: number | null;
  droppedEstimate: number | null;
  longestGapMs: number | null;
  belowRequested: boolean;
  frames: number;
  widthPx: number;
  heightPx: number;
  durationMs: number;
  cameraView: CameraView;
  /** The highest frame rate the chosen camera format reports. */
  formatMaxFps: number;
  deviceModel: string;
  osVersion: string;
  appVersion: string;
  /** Spatial calibration. Always null until Phase 4 adds a calibration step. */
  calibration: null;
}

export interface PoseInfo {
  status: 'ok' | 'unavailable';
  /** Why there is no pose track, when status is unavailable. */
  reason: string | null;
  modelId: string;
  frames: number;
  /** Analysed frames per second of video. This is lower than the camera rate. */
  analysedHz: number | null;
  rotation: Rotation | null;
  /**
   * Pose frame time minus video time, in ms. The pose track starts when the camera's frame
   * processor starts counting, and the video file starts a little later. Estimated when the
   * recording ends, and adjustable on the replay screen.
   */
  syncOffsetMs: number;
  /** Share of analysed frames in which the bowler was followed. */
  bowlerCoverage: number | null;
}

export interface Session {
  id: string;
  bowlerId: string;
  createdAt: string;
  sessionType: SessionType;
  videoUri: string | null;
  capture: CaptureInfo;
  pose: PoseInfo;
  deliveries: DeliveryMarker[];
  clips: ClipRange[];
}

export interface Settings {
  defaultFps: number;
  showSkeleton: boolean;
  /** Delete sessions older than this many days. Null keeps them until the user deletes them. */
  retentionDays: number | null;
  /**
   * The turn that makes the camera frame upright for the pose model, found by the orientation
   * check, for each way the phone has been held. Keyed by the camera frame's orientation name.
   */
  poseRotations: Record<string, Rotation>;
  /**
   * Whether the camera screen finds and follows the bowler. Off records plain video with no
   * model running. It is turned off by itself if the camera screen stopped last time.
   */
  poseTracking: boolean;
  /** True when poseTracking was turned off by the app, not by the person, so Settings can say why. */
  poseAutoDisabled: boolean;
  /** Consent to share a bowler's sessions with a coach. Sharing itself is not built yet. */
  coachSharingConsent: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  defaultFps: 30,
  showSkeleton: true,
  retentionDays: null,
  poseRotations: {},
  poseTracking: true,
  poseAutoDisabled: false,
  coachSharingConsent: false,
};
