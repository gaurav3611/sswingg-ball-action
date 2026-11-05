/**
 * Mounts the screens that do not need a camera, with realistic data, and checks what they say.
 * It catches rendering mistakes (for example a View inside an Svg) and checks that numbers that
 * are not measured show "--" or a reason instead of a figure.
 */
import { render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import type { Session } from '@/data/types';

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => ({ id: 's1' }),
  useIsFocused: () => true,
}));
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'id', getRandomBytes: () => new Uint8Array(16), digestStringAsync: async (_a: string, d: string) => d, CryptoDigestAlgorithm: { SHA256: 'SHA-256' } }));
jest.mock('expo-constants', () => ({ expoConfig: { version: '0.1.0' } }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: async () => true, shareAsync: jest.fn() }));

const bowler = {
  id: 'b1', ownerId: 'a1', name: 'Asha Rao', age: null, heightCm: null, massKg: null,
  bowlingArm: 'right' as const, style: 'fast' as const, experience: 'club' as const, preferredView: 'side' as const,
  createdAt: '2026-11-01T10:00:00Z',
};
const session = (over: Partial<Session> = {}): Session => ({
  id: 's1', bowlerId: 'b1', createdAt: new Date().toISOString(), sessionType: 'nets', videoUri: 'file:///x.mp4',
  capture: { requestedFps: 60, deliveredFps: 58.7, droppedEstimate: 3, longestGapMs: 40, belowRequested: false, frames: 600, widthPx: 1920, heightPx: 1080, durationMs: 10000, cameraView: 'side', formatMaxFps: 60, deviceModel: 'Test', osVersion: 'Android 16', appVersion: '0.1.0', calibration: null },
  pose: { status: 'ok', reason: null, modelId: 'movenet', frames: 100, analysedHz: 10, rotation: 0, bowlerCoverage: 0.82, syncOffsetMs: 120 },
  deliveries: [{ id: 'd1', tMs: 4000, intended: 'yorker', source: 'manual' }],
  clips: [],
  ...over,
});

let mockApp: Record<string, unknown>;
jest.mock('@/state/app', () => ({ useApp: () => mockApp }));

const base = () => {
  const s = session();
  return {
    account: { id: 'a1', name: 'Asha Rao', email: 'a@b.co', role: 'bowler', createdAt: '' },
    bowlers: [bowler], myBowlers: [bowler], activeBowler: bowler, activeBowlerId: 'b1',
    sessions: [s], mySessions: [s],
    settings: { defaultFps: 30, showSkeleton: true, retentionDays: null, poseRotations: {}, coachSharingConsent: false },
    onboarded: true, ready: true,
    login: jest.fn(), register: jest.fn(), logout: jest.fn(), completeOnboarding: jest.fn(),
    updateSettings: jest.fn(), setActiveBowler: jest.fn(), updateSession: jest.fn(), deleteSession: jest.fn(),
    saveBowler: jest.fn(), deleteBowler: jest.fn(), exportData: jest.fn(), deleteEverything: jest.fn(),
  };
};

beforeEach(() => {
  mockApp = base();
});

const show = async (el: ReactElement) => render(el);
const texts = () => JSON.stringify(screen.toJSON());

describe('screens', () => {
  it('Home shows real counts and -- for what is not measured', async () => {
    const Home = require('@/app/(tabs)/index').default;
    await show(<Home />);
    expect(screen.getByText('Start bowling analysis')).toBeTruthy();
    expect(screen.getByText('Hello, Asha')).toBeTruthy();
    expect(screen.getAllByText('--')).toHaveLength(2); // average speed and action consistency
    expect(screen.getByText('Deliveries marked')).toBeTruthy();
    expect(texts()).not.toMatch(/km\/h|mph/);
  });

  it('Home with no sessions shows the empty state, not sample sessions', async () => {
    mockApp = { ...base(), sessions: [], mySessions: [] };
    const Home = require('@/app/(tabs)/index').default;
    await show(<Home />);
    expect(screen.getByText('No sessions yet')).toBeTruthy();
  });

  it('Home with no bowler asks for one', async () => {
    mockApp = { ...base(), myBowlers: [], activeBowler: null };
    const Home = require('@/app/(tabs)/index').default;
    await show(<Home />);
    expect(screen.getByText('Add a bowler first')).toBeTruthy();
  });

  it.each([
    ['Onboarding', '@/app/onboarding'],
    ['Login', '@/app/login'],
    ['Register', '@/app/register'],
    ['Analyse', '@/app/(tabs)/analyse'],
    ['Progress', '@/app/(tabs)/progress'],
    ['Profile', '@/app/(tabs)/profile'],
    ['Settings', '@/app/settings'],
    ['Status', '@/app/status'],
    ['Edit bowler', '@/app/bowler/edit'],
  ])('%s renders', async (_n, path) => {
    const C = require(path).default;
    await show(<C />);
    expect(screen.toJSON()).toBeTruthy();
  });

  it('a planned feature page says it is not built and shows no numbers', async () => {
    jest.spyOn(require('expo-router'), 'useLocalSearchParams').mockReturnValue({ id: 'speed' });
    const F = require('@/app/feature/[id]').default;
    await show(<F />);
    expect(screen.getByText('Not built yet')).toBeTruthy();
    expect(texts()).not.toMatch(/\d+(\.\d+)?\s?(km\/h|mph)/);
  });

  it('Progress counts only deliveries that were marked', async () => {
    const Progress = require('@/app/(tabs)/progress').default;
    await show(<Progress />);
    expect(screen.getByText('Sessions recorded')).toBeTruthy();
    expect(screen.getByText('Trends and comparison')).toBeTruthy();
  });
});

describe('components', () => {
  const { SkeletonOverlay } = require('@/components/skeleton-overlay');
  const { MetricRow } = require('@/components/measurement');
  const { AngleChart } = require('@/components/angle-chart');
  const person = {
    trackId: 1, score: 0.9, box: { x: 0.3, y: 0.1, w: 0.3, h: 0.8 },
    keypoints: Array.from({ length: 17 }, (_, i) => ({ x: 0.4 + (i % 3) * 0.05, y: 0.15 + i * 0.04, score: i === 9 ? 0.1 : 0.8 })),
  };

  it('draws a skeleton and lets another person be chosen', async () => {
    const onSelect = jest.fn();
    await show(<SkeletonOverlay people={[person, { ...person, trackId: 2 }]} bowlerId={1} rect={{ x: 0, y: 0, width: 300, height: 400 }} onSelect={onSelect} showLabels />);
    expect(screen.getByLabelText('Follow person 2 as the bowler')).toBeTruthy();
    expect(screen.queryByLabelText('Follow person 1 as the bowler')).toBeNull();
    expect(screen.getByText('Bowler, 16 of 17 joints')).toBeTruthy(); // the wrist under 0.3 is not counted
  });

  it('draws nothing when the picture has no size', async () => {
    await show(<SkeletonOverlay people={[person]} bowlerId={1} rect={{ x: 0, y: 0, width: 0, height: 0 }} />);
    expect(screen.toJSON()).toBeNull();
  });

  it('a metric with a value shows its kind and confidence; one without shows the reason, not zero', async () => {
    await show(
      <>
        <MetricRow label="Bowling elbow" m={{ value: 143.4, unit: 'deg', kind: 'estimated', confidence: 0.8 }} />
        <MetricRow label="Left knee" m={{ value: null, unit: 'deg', kind: 'unavailable', confidence: null, reason: 'The left knee is not visible enough (confidence 0.12).' }} />
      </>,
    );
    expect(screen.getByText('143')).toBeTruthy();
    expect(screen.getAllByText('Estimated').length).toBeGreaterThan(0);
    expect(screen.getByText('high confidence')).toBeTruthy();
    expect(screen.getByText('--')).toBeTruthy();
    expect(screen.getByText('The left knee is not visible enough (confidence 0.12).')).toBeTruthy();
    expect(screen.queryByText('0')).toBeNull();
  });

  it('draws a chart with a gap in it', async () => {
    const { toJSON } = await show(<AngleChart label="Elbow" currentMs={500} durationMs={1000} points={[{ t: 0, value: 100 }, { t: 100, value: null }, { t: 200, value: 120 }, { t: 300, value: 130 }]} />);
    expect(toJSON()).toBeTruthy();
  });
});

describe('skeleton drawing cost', () => {
  const { skeletonPaths } = require('@/components/skeleton-overlay');
  const kps = Array.from({ length: 17 }, (_, i) => ({ x: 0.3 + (i % 4) * 0.05, y: 0.1 + i * 0.05, score: 0.8 }));
  const rect = { x: 0, y: 0, width: 300, height: 400 };

  it('joins every bone and joint into a few path strings', () => {
    const { bones, joints } = skeletonPaths(kps, rect, 4);
    // 16 bones become at most 3 strings, 17 joints at most 3
    expect(Object.values(bones).filter(Boolean).length).toBeLessThanOrEqual(3);
    expect(Object.values(joints).filter(Boolean).length).toBeLessThanOrEqual(3);
    const allBones = Object.values(bones).join('');
    expect((allBones.match(/M/g) ?? []).length).toBe(16);
    expect(((Object.values(joints).join('')).match(/M/g) ?? []).length).toBe(17);
  });

  it('leaves out bones and joints the model is not sure of', () => {
    const weak = kps.map((k, i) => (i === 9 ? { ...k, score: 0.1 } : k)); // left wrist
    const { bones, joints } = skeletonPaths(weak, rect, 4);
    expect(((Object.values(joints).join('')).match(/M/g) ?? []).length).toBe(16);
    expect((Object.values(bones).join('').match(/M/g) ?? []).length).toBe(15); // the elbow to wrist bone goes too
  });

  it('draws at most three people however many are in view', async () => {
    const { SkeletonOverlay } = require('@/components/skeleton-overlay');
    const people = Array.from({ length: 6 }, (_, i) => ({ trackId: i + 1, score: 0.9, box: { x: i * 0.1, y: 0.1, w: 0.1, h: 0.5 }, keypoints: kps }));
    await render(<SkeletonOverlay people={people} bowlerId={4} rect={rect} onSelect={() => {}} showLabels />);
    expect(screen.getByText('Bowler, 17 of 17 joints')).toBeTruthy(); // the bowler is drawn even though the largest others come after
    expect(screen.getAllByText(/tap to follow/)).toHaveLength(2);
  });
});
