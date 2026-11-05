import * as Sharing from 'expo-sharing';
import { writeCacheFile } from './storage';
import type { Account, BowlerProfile, Session, Settings } from './types';

/**
 * Everything the app keeps about a person, as one readable file.
 * The video and the pose tracks stay on the phone and are not included: video is shared one
 * session at a time, by the person, with the share button on the replay screen.
 */
export function buildExport(args: { account: Account; bowlers: BowlerProfile[]; sessions: Session[]; settings: Settings }) {
  return {
    exportedAt: new Date().toISOString(),
    app: 'SSwinGG Ball Action',
    note: 'Video files and pose tracks are not included. They stay on this phone.',
    account: args.account,
    settings: args.settings,
    bowlers: args.bowlers.filter((b) => b.ownerId === args.account.id),
    sessions: args.sessions,
  };
}

/** Writes the export and opens the share sheet. Returns false if sharing is not available. */
export async function shareExport(data: ReturnType<typeof buildExport>): Promise<boolean> {
  if (!(await Sharing.isAvailableAsync())) return false;
  const uri = await writeCacheFile('sswingg-ball-action-export.json', JSON.stringify(data, null, 2));
  await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: 'Export your SSwinGG data' });
  return true;
}
