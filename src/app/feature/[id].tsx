import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/screen';
import { Button, Card, Chip, EmptyState, SectionTitle, Txt } from '@/components/ui';
import { STATUS_LABEL, featureById } from '@/features';

const tone = { working: 'good', experimental: 'estimate', planned: 'neutral' } as const;

export default function FeaturePage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const f = featureById(id);
  if (!f) {
    return (
      <Screen title="Not found" back>
        <EmptyState icon="info" title="Unknown feature" detail="This page does not exist." />
      </Screen>
    );
  }
  return (
    <Screen title={f.title} back>
      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
        <Chip label={STATUS_LABEL[f.status]} tone={tone[f.status]} />
        <Chip label={`Phase ${f.phase}`} />
      </View>
      <Card>
        <SectionTitle icon="info">{f.status === 'planned' ? 'What it will do' : 'What it does now'}</SectionTitle>
        <Txt variant="body">{f.summary}</Txt>
      </Card>
      {f.needs ? (
        <Card>
          <SectionTitle icon="ruler">What it needs first</SectionTitle>
          <Txt variant="body">{f.needs}</Txt>
        </Card>
      ) : null}
      {f.status === 'planned' ? (
        <Txt variant="small" tone="muted">
          No numbers are shown here because none are measured. They will appear when the feature is built and tested.
        </Txt>
      ) : null}
      <Button label="Back" variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}
