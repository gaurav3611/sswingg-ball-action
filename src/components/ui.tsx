import { type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { Icon } from './icon';
import type { IconName } from './icon-data';
import { TOUCH, colors, fonts, radius, space } from '@/theme/tokens';

/* ------------------------------------------------------------------ text */

type TextVariant = 'display' | 'title' | 'heading' | 'body' | 'small' | 'label' | 'figure';
type Tone = 'text' | 'muted' | 'accent' | 'red' | 'onAccent';

const textStyles: Record<TextVariant, TextStyle> = {
  display: { fontFamily: fonts.displayBold, fontSize: 30, lineHeight: 36 },
  title: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30 },
  heading: { fontFamily: fonts.uiSemi, fontSize: 17, lineHeight: 24 },
  body: { fontFamily: fonts.ui, fontSize: 16, lineHeight: 24 },
  small: { fontFamily: fonts.ui, fontSize: 14, lineHeight: 20 },
  label: { fontFamily: fonts.uiSemi, fontSize: 12, lineHeight: 16, letterSpacing: 0.6, textTransform: 'uppercase' },
  // Large numbers: serif, with digits of equal width so a changing value does not jitter.
  figure: { fontFamily: fonts.displayBold, fontSize: 28, lineHeight: 34, fontVariant: ['tabular-nums'] },
};

export function Txt({
  variant = 'body',
  tone = 'text',
  style,
  children,
  ...rest
}: {
  variant?: TextVariant;
  tone?: Tone;
  style?: StyleProp<TextStyle>;
  children?: ReactNode;
} & Omit<React.ComponentProps<typeof Text>, 'style'>) {
  return (
    <Text {...rest} style={[textStyles[variant], { color: colors[tone] }, style]}>
      {children}
    </Text>
  );
}

/* --------------------------------------------------------------- buttons */

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  loading,
  style,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        buttonSurface(variant, pressed),
        off && { opacity: 0.5 },
        style,
      ]}
    >
      {({ pressed }) => {
        const fg = buttonForeground(variant);
        return (
          <>
            {loading ? (
              <ActivityIndicator color={fg} />
            ) : icon ? (
              <Icon name={icon} size={20} color={fg} />
            ) : null}
            <Txt variant="heading" style={{ color: fg, opacity: pressed ? 0.9 : 1 }}>
              {label}
            </Txt>
          </>
        );
      }}
    </Pressable>
  );
}

function buttonSurface(variant: ButtonVariant, pressed: boolean): ViewStyle {
  switch (variant) {
    case 'primary':
      return { backgroundColor: pressed ? colors.accentHover : colors.accent, borderColor: colors.accent };
    case 'danger':
      return { backgroundColor: pressed ? '#8f1c12' : colors.red, borderColor: colors.red };
    case 'secondary':
      return { backgroundColor: pressed ? colors.surface2 : colors.surface, borderColor: colors.line };
    case 'ghost':
      return { backgroundColor: pressed ? colors.surface2 : 'transparent', borderColor: 'transparent' };
  }
}

function buttonForeground(variant: ButtonVariant): string {
  return variant === 'primary' || variant === 'danger' ? colors.onAccent : colors.text;
}

/** A square button that holds one icon. It always needs a label for screen readers. */
export function IconButton({
  icon,
  label,
  onPress,
  disabled,
  tone = 'surface',
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'surface' | 'stage';
}) {
  const onStage = tone === 'stage';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [
        styles.iconButton,
        {
          backgroundColor: onStage ? (pressed ? '#2a3a2f' : '#1b2a20') : pressed ? colors.surface2 : colors.surface,
          borderColor: onStage ? '#3a4b3f' : colors.line,
        },
        disabled && { opacity: 0.4 },
      ]}
    >
      <Icon name={icon} size={22} color={onStage ? '#ffffff' : colors.text} />
    </Pressable>
  );
}

/* --------------------------------------------------------------- surfaces */

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children, icon }: { children: string; icon?: IconName }) {
  return (
    <View style={styles.sectionTitle}>
      {icon ? <Icon name={icon} size={18} color={colors.accent} /> : null}
      <Txt variant="label" tone="muted">
        {children}
      </Txt>
    </View>
  );
}

/** A status or category tag. Small radius, flat colour, never a pill. */
export function Chip({
  label,
  tone = 'neutral',
  icon,
}: {
  label: string;
  tone?: 'neutral' | 'accent' | 'good' | 'estimate' | 'manual' | 'bad';
  icon?: IconName;
}) {
  const c = chipColors[tone];
  return (
    <View style={[styles.chip, { backgroundColor: c.bg }]}>
      {icon ? <Icon name={icon} size={14} color={c.fg} /> : null}
      <Text style={{ fontFamily: fonts.uiSemi, fontSize: 12, color: c.fg }}>{label}</Text>
    </View>
  );
}

const chipColors = {
  neutral: { bg: colors.surface2, fg: colors.muted },
  accent: { bg: colors.accentSoft, fg: colors.accent },
  good: { bg: colors.greenSoft, fg: '#27632b' },
  estimate: { bg: colors.ochreSoft, fg: colors.ochre },
  manual: { bg: colors.legSoft, fg: colors.leg },
  bad: { bg: colors.redSoft, fg: colors.red },
} as const;

/* ------------------------------------------------------------------ forms */

export function Field({
  label,
  error,
  hint,
  ...input
}: { label: string; error?: string | null; hint?: string } & TextInputProps) {
  return (
    <View style={{ gap: 6 }}>
      <Txt variant="small" style={{ fontFamily: fonts.uiSemi }}>
        {label}
      </Txt>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        {...input}
        style={[styles.input, error ? { borderColor: colors.red } : null]}
      />
      {error ? (
        <Txt variant="small" tone="red">
          {error}
        </Txt>
      ) : hint ? (
        <Txt variant="small" tone="muted">
          {hint}
        </Txt>
      ) : null}
    </View>
  );
}

export function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
  disabledValues = [],
}: {
  label?: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  disabledValues?: T[];
}) {
  return (
    <View style={{ gap: 6 }}>
      {label ? (
        <Txt variant="small" style={{ fontFamily: fonts.uiSemi }}>
          {label}
        </Txt>
      ) : null}
      <View style={styles.segmented} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {options.map((o) => {
          const selected = o.value === value;
          const disabled = disabledValues.includes(o.value);
          return (
            <Pressable
              key={String(o.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected, disabled }}
              disabled={disabled}
              onPress={() => onChange(o.value)}
              style={[
                styles.segment,
                selected && { backgroundColor: colors.accent },
                disabled && { opacity: 0.4 },
              ]}
            >
              <Text
                style={{
                  fontFamily: fonts.uiSemi,
                  fontSize: 14,
                  color: selected ? colors.onAccent : colors.text,
                }}
              >
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** A set of options that wrap onto several lines. For more options than Segmented can fit. */
export function Choices<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Txt variant="small" style={{ fontFamily: fonts.uiSemi }}>
        {label}
      </Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => onChange(o.value)}
              style={[
                styles.choice,
                { backgroundColor: selected ? colors.accent : colors.surface, borderColor: selected ? colors.accent : colors.line },
              ]}
            >
              <Text style={{ fontFamily: fonts.uiSemi, fontSize: 14, color: selected ? colors.onAccent : colors.text }}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function ToggleRow({
  label,
  detail,
  value,
  onChange,
  disabled,
}: {
  label: string;
  detail?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={[styles.toggleRow, disabled && { opacity: 0.5 }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="body" style={{ fontFamily: fonts.uiMedium }}>
          {label}
        </Txt>
        {detail ? (
          <Txt variant="small" tone="muted">
            {detail}
          </Txt>
        ) : null}
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        disabled={disabled}
        onValueChange={onChange}
        trackColor={{ false: colors.line, true: colors.accent }}
        thumbColor="#ffffff"
      />
    </View>
  );
}

/* ----------------------------------------------------------------- states */

export function Loading({ label }: { label: string }) {
  return (
    <View style={styles.state} accessibilityLiveRegion="polite">
      <ActivityIndicator color={colors.accent} />
      <Txt variant="small" tone="muted">
        {label}
      </Txt>
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  detail,
  action,
}: {
  icon: IconName;
  title: string;
  detail: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.state}>
      <View style={styles.stateIcon}>
        <Icon name={icon} size={24} color={colors.accent} />
      </View>
      <Txt variant="heading" style={{ textAlign: 'center' }}>
        {title}
      </Txt>
      <Txt variant="small" tone="muted" style={{ textAlign: 'center', maxWidth: 320 }}>
        {detail}
      </Txt>
      {action}
    </View>
  );
}

export function ErrorState({ title, detail, action }: { title: string; detail: string; action?: ReactNode }) {
  return (
    <View style={[styles.state, { gap: space.md }]} accessibilityRole="alert">
      <View style={[styles.stateIcon, { backgroundColor: colors.redSoft }]}>
        <Icon name="triangle-exclamation-point" size={24} color={colors.red} />
      </View>
      <Txt variant="heading" style={{ textAlign: 'center' }}>
        {title}
      </Txt>
      <Txt variant="small" tone="muted" style={{ textAlign: 'center', maxWidth: 320 }}>
        {detail}
      </Txt>
      {action}
    </View>
  );
}

/** A figure with a caption. The value is a string so that "--" can stand for "no data yet". */
export function Stat({ value, unit, caption }: { value: string; unit?: string; caption: string }) {
  return (
    <View style={styles.stat}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
        <Txt variant="figure">{value}</Txt>
        {unit ? (
          <Txt variant="small" tone="muted">
            {unit}
          </Txt>
        ) : null}
      </View>
      <Txt variant="small" tone="muted">
        {caption}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: TOUCH,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  iconButton: {
    width: TOUCH,
    height: TOUCH,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.md,
  },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
  },
  input: {
    minHeight: TOUCH,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: space.md,
    fontFamily: fonts.ui,
    fontSize: 16,
    color: colors.text,
  },
  segmented: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  segment: { flex: 1, minHeight: TOUCH, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  choice: {
    minHeight: TOUCH,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: TOUCH },
  state: { alignItems: 'center', justifyContent: 'center', gap: space.sm, padding: space.xl },
  stateIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stat: { flex: 1, minWidth: 130, gap: 2 },
});
