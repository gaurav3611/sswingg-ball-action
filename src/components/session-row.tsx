import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Icon } from './icon';
import { Chip, Txt } from './ui';
import { formatDate, formatDuration } from '@/data/summary';
import type { BowlerProfile, Session } from '@/data/types';
import { colors, space } from '@/theme/tokens';

const TYPE_LABEL = { nets: 'Nets', target: 'Target practice', drill: 'Drill' } as const;

export function SessionRow({ session, bowler }: { session: Session; bowler?: BowlerProfile }) {
  const n = session.deliveries.length;
  const pose = session.pose.status === 'ok' ? `Bowler followed ${Math.round((session.pose.bowlerCoverage ?? 0) * 100)}%` : 'No pose track';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Session ${formatDate(session.createdAt)}, ${n} deliveries marked`}
      onPress={() => router.push(`/session/${session.id}`)}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        minHeight: 64,
        paddingVertical: space.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: pressed ? colors.surface2 : 'transparent',
      })}
    >
      <View style={{ flex: 1, gap: 4 }}>
        <Txt variant="body" style={{ fontFamily: 'Inter_600SemiBold' }}>
          {formatDate(session.createdAt)}
        </Txt>
        <Txt variant="small" tone="muted">
          {bowler ? `${bowler.name}, ` : ''}
          {TYPE_LABEL[session.sessionType]}, {formatDuration(session.capture.durationMs)}, {n} {n === 1 ? 'delivery' : 'deliveries'} marked
        </Txt>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          <Chip label={session.capture.source === 'imported' ? 'Imported video' : `${session.capture.deliveredFps ? Math.round(session.capture.deliveredFps) : session.capture.requestedFps} fps`} tone="neutral" />
          <Chip label={pose} tone={session.pose.status === 'ok' ? 'estimate' : 'neutral'} />
        </View>
      </View>
      <Icon name="chevron-right" size={20} color={colors.muted} />
    </Pressable>
  );
}
