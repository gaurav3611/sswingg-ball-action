import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

/**
 * Where things are kept, all private to this app:
 *   small records (profiles, session list, settings)  AsyncStorage
 *   video and pose track of a session                 files under <documents>/sessions/<id>/
 *   password hashes                                   the secure store (see auth.ts)
 * Nothing is uploaded. Video leaves the phone only when the user presses a share button.
 */
export const KEYS = {
  bowlers: 'ba.bowlers',
  sessions: 'ba.sessions',
  settings: 'ba.settings',
  onboarded: 'ba.onboarded',
  activeBowler: 'ba.activeBowler',
} as const;

export async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const text = await AsyncStorage.getItem(key);
    return text === null ? fallback : (JSON.parse(text) as T);
  } catch {
    return fallback;
  }
}

export async function writeJson(key: string, value: unknown): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

const sessionDir = (id: string) => new Directory(Paths.document, 'sessions', id);
const unsupported = () => Platform.OS === 'web';

/**
 * Moves a freshly recorded video from the camera's temporary folder into the session's folder,
 * so the system cannot clear it. Returns the new file URI.
 */
export async function adoptVideo(sessionId: string, recordedPath: string): Promise<string> {
  if (unsupported()) throw new Error('Video files are not supported on the web.');
  const dir = sessionDir(sessionId);
  dir.create({ intermediates: true, idempotent: true });
  const from = new File(recordedPath.startsWith('file://') ? recordedPath : `file://${recordedPath}`);
  const to = new File(dir, 'video.mp4');
  if (to.exists) to.delete();
  await from.copy(to);
  from.delete();
  return to.uri;
}

export async function writePoseText(sessionId: string, text: string): Promise<void> {
  if (unsupported()) return;
  const dir = sessionDir(sessionId);
  dir.create({ intermediates: true, idempotent: true });
  const file = new File(dir, 'pose.json');
  if (!file.exists) file.create();
  await file.write(text);
}

export async function readPoseText(sessionId: string): Promise<string | null> {
  if (unsupported()) return null;
  try {
    const file = new File(sessionDir(sessionId), 'pose.json');
    return file.exists ? await file.text() : null;
  } catch {
    return null;
  }
}

export function deleteSessionFiles(sessionId: string): void {
  if (unsupported()) return;
  try {
    const dir = sessionDir(sessionId);
    if (dir.exists) dir.delete();
  } catch {
    // The files are already gone, or cannot be removed: nothing more to do here.
  }
}

export function deleteAllSessionFiles(): void {
  if (unsupported()) return;
  try {
    const dir = new Directory(Paths.document, 'sessions');
    if (dir.exists) dir.delete();
  } catch {
    // Same as above.
  }
}

/** Writes a text file to the cache and returns its URI, for the share sheet. */
export async function writeCacheFile(name: string, text: string): Promise<string> {
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  await file.write(text);
  return file.uri;
}
