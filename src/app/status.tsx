import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/screen';
import { Card, Chip, Txt } from '@/components/ui';
import { FEATURES, STATUS_LABEL } from '@/features';

const tone = { working: 'good', experimental: 'estimate', planned: 'neutral' } as const;

export default function Status() {
  return (
    <Screen title="What works" subtitle="Version of this app" back>
      <Txt variant="body" tone="muted">
        A feature is called working only when it is built and tested. Experimental features run but have not been checked against real cricket measurements. The rest are not built.
      </Txt>
      {FEATURES.map((f) => (
        <Pressable key={f.id} accessibilityRole="button" onPress={() => router.push(`/feature/${f.id}`)}>
          <Card>
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              <Chip label={STATUS_LABEL[f.status]} tone={tone[f.status]} />
              <Chip label={`Phase ${f.phase}`} />
            </View>
            <Txt variant="heading">{f.title}</Txt>
            <Txt variant="small" tone="muted">
              {f.summary}
            </Txt>
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}
