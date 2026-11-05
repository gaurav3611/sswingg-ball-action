import { StyleSheet, View } from 'react-native';
import { Chip, Txt } from './ui';
import { KIND_LABEL, confidenceBand, formatValue, type Measurement, type MeasurementKind } from '@/core/measurement';
import { colors, space } from '@/theme/tokens';

const kindTone = { measured: 'accent', estimated: 'estimate', manual: 'manual', unavailable: 'neutral' } as const;

/** The label that says where a number came from. */
export function KindChip({ kind }: { kind: MeasurementKind }) {
  return <Chip label={KIND_LABEL[kind]} tone={kindTone[kind]} />;
}

/**
 * One metric: its name, the value with its unit, how it was obtained, and how far to trust it.
 * When there is no value, the reason is shown in its place. Never a zero.
 */
export function MetricRow({ label, m, digits = 0, meaning }: { label: string; m: Measurement; digits?: number; meaning?: string }) {
  const band = confidenceBand(m.confidence);
  return (
    <View style={styles.row} accessible accessibilityLabel={`${label}. ${m.value === null ? `Unavailable. ${m.reason ?? ''}` : `${formatValue(m, digits)} ${m.unit}. ${KIND_LABEL[m.kind]}, ${band} confidence.`}`}>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="body" style={{ fontFamily: 'Inter_500Medium' }}>
          {label}
        </Txt>
        {meaning ? (
          <Txt variant="small" tone="muted">
            {meaning}
          </Txt>
        ) : null}
        {m.value === null ? (
          <Txt variant="small" tone="muted">
            {m.reason}
          </Txt>
        ) : null}
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
          <Txt variant="figure" style={{ fontSize: 24, lineHeight: 28 }}>
            {formatValue(m, digits)}
          </Txt>
          <Txt variant="small" tone="muted">
            {m.value === null ? '' : m.unit === 'deg' ? 'deg' : m.unit}
          </Txt>
        </View>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          <KindChip kind={m.kind} />
          {m.value !== null ? <Chip label={`${band} confidence`} tone={band === 'high' ? 'good' : band === 'medium' ? 'estimate' : 'bad'} /> : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
});
