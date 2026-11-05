import { useState } from 'react';
import { View } from 'react-native';
import { Icon } from '@/components/icon';
import type { IconName } from '@/components/icon-data';
import { BrandMark, Screen } from '@/components/screen';
import { Button, Card, Txt } from '@/components/ui';
import { useApp } from '@/state/app';
import { colors, space } from '@/theme/tokens';

const PAGES: { icon: IconName; title: string; lines: string[] }[] = [
  {
    icon: 'video',
    title: 'Film your bowling',
    lines: [
      'Put the phone on a tripod and record a session. The app finds your body in the video, follows you through the run-up, and draws your joints on the replay.',
      'It shows elbow, knee, arm and trunk angles for each moment you inspect.',
    ],
  },
  {
    icon: 'info',
    title: 'What it cannot tell you',
    lines: [
      'One camera sees a flat picture. Every angle here is an estimate, and each one says so, with a confidence.',
      'This version does not measure ball speed, spin or swing. It does not decide whether an action is legal, and it does not diagnose injuries. A qualified coach should assess those.',
    ],
  },
  {
    icon: 'lock',
    title: 'Your video stays on your phone',
    lines: [
      'Recordings are stored in the app and nowhere else. Nothing is uploaded. You can share one video at a time, delete a session, or delete everything.',
      'The camera permission is asked for when you start your first session. The microphone is never used.',
    ],
  },
];

export default function Onboarding() {
  const app = useApp();
  const [page, setPage] = useState(0);
  const last = page === PAGES.length - 1;
  const p = PAGES[page]!;
  return (
    <Screen brand>
      <View style={{ gap: space.xl, paddingTop: space.lg }}>
        {page === 0 ? (
          <View style={{ gap: space.sm }}>
            <BrandMark />
            <Txt variant="display" style={{ marginTop: space.md }}>
              Understand your action. Control your delivery. Improve your game.
            </Txt>
          </View>
        ) : null}
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <View
              style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}
            >
              <Icon name={p.icon} size={24} color={colors.accent} />
            </View>
            <Txt variant="title" style={{ flex: 1 }} accessibilityRole="header">
              {p.title}
            </Txt>
          </View>
          {p.lines.map((line) => (
            <Txt key={line} variant="body">
              {line}
            </Txt>
          ))}
        </Card>
        <Txt variant="small" tone="muted" accessibilityLabel={`Step ${page + 1} of ${PAGES.length}`}>
          {page + 1} of {PAGES.length}
        </Txt>
        <View style={{ gap: space.sm }}>
          <Button label={last ? 'Get started' : 'Next'} onPress={() => (last ? app.completeOnboarding() : setPage(page + 1))} />
          {page > 0 ? <Button label="Back" variant="ghost" onPress={() => setPage(page - 1)} /> : null}
        </View>
      </View>
    </Screen>
  );
}
