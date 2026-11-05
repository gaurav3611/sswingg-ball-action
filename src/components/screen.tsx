import { type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Icon } from './icon';
import { IconButton, Txt } from './ui';
import { colors, space } from '@/theme/tokens';

/** The brand mark of the web app: a forest square with the bat, and SSwinGG with the GG in forest. */
export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={styles.logoBox}>
        <Icon name="bat" size={compact ? 18 : 22} color={colors.onAccent} />
      </View>
      <View>
        <Txt variant="title" style={{ fontSize: compact ? 19 : 22, lineHeight: compact ? 22 : 26, letterSpacing: 1 }}>
          SSwin<Txt variant="title" tone="accent" style={{ fontSize: compact ? 19 : 22, lineHeight: compact ? 22 : 26, letterSpacing: 1 }}>GG</Txt>
        </Txt>
        {compact ? null : (
          <Txt variant="label" tone="muted" style={{ marginTop: -2 }}>
            Ball Action
          </Txt>
        )}
      </View>
    </View>
  );
}

/** Two thin rules, like the popping and batting creases on a pitch. */
export function CreaseRule() {
  return (
    <View>
      <View style={{ height: 1, backgroundColor: colors.line }} />
      <View style={{ height: 2 }} />
      <View style={{ height: 1, backgroundColor: colors.line }} />
    </View>
  );
}

export function Screen({
  title,
  subtitle,
  back,
  right,
  children,
  scroll = true,
  brand = false,
}: {
  title?: string;
  subtitle?: string;
  back?: boolean | (() => void);
  right?: ReactNode;
  children: ReactNode;
  scroll?: boolean;
  /** Show the brand mark in the header instead of a title. */
  brand?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const Body = scroll ? ScrollView : View;
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          {back ? (
            <IconButton icon="arrow-left" label="Back" onPress={typeof back === 'function' ? back : () => router.back()} />
          ) : null}
          <View style={{ flex: 1, minWidth: 0 }}>
            {brand ? (
              <BrandMark compact />
            ) : (
              <>
                <Txt variant="title" numberOfLines={1} accessibilityRole="header">
                  {title}
                </Txt>
                {subtitle ? (
                  <Txt variant="small" tone="muted" numberOfLines={1}>
                    {subtitle}
                  </Txt>
                ) : null}
              </>
            )}
          </View>
          {right}
        </View>
      </View>
      <CreaseRule />
      <Body
        style={{ flex: 1 }}
        {...(scroll
          ? { contentContainerStyle: [styles.content, { paddingBottom: insets.bottom + space.xxl }], keyboardShouldPersistTaps: 'handled' as const }
          : {})}
      >
        {scroll ? children : <View style={[styles.content, { flex: 1 }]}>{children}</View>}
      </Body>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { backgroundColor: colors.surface, paddingHorizontal: space.lg, paddingVertical: space.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 48 },
  content: { padding: space.lg, gap: space.lg, width: '100%', maxWidth: 720, alignSelf: 'center' },
  logoBox: {
    width: 36,
    height: 36,
    borderRadius: 6,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
