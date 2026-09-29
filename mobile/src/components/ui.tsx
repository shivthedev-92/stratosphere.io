import { X, type Icon } from "phosphor-react-native";
import { useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { SvgXml } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Priority } from "../api";
import { ASTER_SVGS, AVATAR_SVGS } from "../assets/svgs";
import { PRIORITY_META } from "../icons";
import { fonts, hitTarget, radius, useTheme } from "../theme";

type TextVariant = "title" | "pushedTitle" | "eyebrow" | "cardTitle" | "body" | "meta" | "label" | "journal" | "caption";

const TEXT_STYLES: Record<TextVariant, TextStyle> = {
  title: { fontFamily: fonts.semibold, fontSize: 30, letterSpacing: -0.9 },
  pushedTitle: { fontFamily: fonts.semibold, fontSize: 28, letterSpacing: -0.8 },
  eyebrow: { fontFamily: fonts.semibold, fontSize: 13, letterSpacing: 0.8, textTransform: "uppercase" },
  cardTitle: { fontFamily: fonts.semibold, fontSize: 17 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21 },
  meta: { fontFamily: fonts.regular, fontSize: 13 },
  label: { fontFamily: fonts.medium, fontSize: 15 },
  journal: { fontFamily: fonts.journal, fontSize: 17, lineHeight: 24 },
  caption: { fontFamily: fonts.medium, fontSize: 11 },
};

const DEFAULT_TONE: Record<TextVariant, "ink" | "muted" | "subtle"> = {
  title: "ink",
  pushedTitle: "ink",
  eyebrow: "subtle",
  cardTitle: "ink",
  body: "ink",
  meta: "muted",
  label: "ink",
  journal: "ink",
  caption: "subtle",
};

export function AppText({
  variant = "body",
  color,
  style,
  children,
  numberOfLines,
}: {
  variant?: TextVariant;
  color?: string;
  style?: StyleProp<TextStyle>;
  children: ReactNode;
  numberOfLines?: number;
}) {
  const { colors } = useTheme();
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[TEXT_STYLES[variant], { color: color ?? colors[DEFAULT_TONE[variant]] }, style]}
    >
      {children}
    </Text>
  );
}

type ButtonVariant = "primary" | "secondary" | "soft" | "destructive";

export function Button({
  label,
  onPress,
  variant = "primary",
  icon: IconGlyph,
  disabled,
  loading,
  compact,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: Icon;
  disabled?: boolean;
  loading?: boolean;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const palette = {
    primary: { bg: colors.accent, fg: "#FFFFFF", border: "transparent" },
    secondary: { bg: "transparent", fg: colors.ink, border: colors.line },
    soft: { bg: colors.accentSoft, fg: colors.accentText, border: "transparent" },
    destructive: { bg: "transparent", fg: colors.danger, border: "transparent" },
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        { backgroundColor: palette.bg, borderColor: palette.border },
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <>
          {IconGlyph ? <IconGlyph size={compact ? 18 : 20} color={palette.fg} /> : null}
          <Text style={[styles.buttonText, compact && styles.buttonTextCompact, { color: palette.fg }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function IconButton({
  icon: IconGlyph,
  label,
  onPress,
  color,
  size = 22,
  badge,
  bordered = true,
  weight,
}: {
  icon: Icon;
  label: string;
  onPress: () => void;
  color?: string;
  size?: number;
  badge?: boolean;
  bordered?: boolean;
  weight?: "regular" | "fill";
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        bordered && { borderColor: colors.line, borderWidth: 1, backgroundColor: colors.raised },
        pressed && styles.pressed,
      ]}
    >
      <IconGlyph size={size} color={color ?? colors.ink} weight={weight} />
      {badge ? <View style={[styles.badgeDot, { backgroundColor: colors.high, borderColor: colors.bg }]} /> : null}
    </Pressable>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  style,
}: {
  options: Array<{ label: string; value: T }>;
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, name } = useTheme();
  return (
    <View accessibilityRole="tablist" style={[styles.segTrack, { backgroundColor: colors.raised, borderColor: colors.line }, style]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[
              styles.segItem,
              selected && { backgroundColor: colors.seg },
              selected && name === "dawn" && styles.segShadow,
            ]}
          >
            <Text
              numberOfLines={1}
              style={[styles.segText, { color: selected ? colors.ink : colors.muted }, selected && { fontFamily: fonts.semibold }]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return <View style={[styles.card, { backgroundColor: colors.raised, borderColor: colors.line }, style]}>{children}</View>;
}

export function Field({ style, multiline, journal, ...props }: TextInputProps & { journal?: boolean }) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      {...props}
      multiline={multiline}
      placeholderTextColor={colors.subtle}
      onFocus={(event) => {
        setFocused(true);
        props.onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        props.onBlur?.(event);
      }}
      style={[
        styles.field,
        multiline && styles.fieldMultiline,
        {
          color: colors.ink,
          backgroundColor: colors.raised,
          borderColor: focused ? colors.accent : colors.line,
          borderWidth: focused ? 1.5 : 1,
        },
        focused && { shadowColor: colors.accent, shadowOpacity: 0.35, shadowRadius: 3, shadowOffset: { width: 0, height: 0 } },
        journal && { fontFamily: fonts.journal, fontSize: 18, lineHeight: 25 },
        style,
      ]}
    />
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <AppText variant="label" style={styles.fieldLabel}>
      {children}
    </AppText>
  );
}

export function Pill({ label, color, bg, icon: IconGlyph }: { label: string; color: string; bg: string; icon?: Icon }) {
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      {IconGlyph ? <IconGlyph size={14} color={color} /> : null}
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </View>
  );
}

export function PriorityChip({ priority }: { priority: Priority }) {
  const { colors } = useTheme();
  const meta = PRIORITY_META[priority];
  return <Pill label={meta.label} icon={meta.icon} color={colors[meta.color] as string} bg={colors[meta.bg] as string} />;
}

export function ErrorText({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  if (!children) return null;
  return (
    <AppText variant="meta" color={colors.danger} style={styles.error}>
      {children}
    </AppText>
  );
}

export function EmptyText({ children }: { children: ReactNode }) {
  return (
    <AppText variant="body" style={styles.empty}>
      {children}
    </AppText>
  );
}

export function AsterAvatar({ mood = "happy", size = 44 }: { mood?: keyof typeof ASTER_SVGS; size?: number }) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size }}>
      <SvgXml xml={ASTER_SVGS[mood]} width={size} height={size} />
    </View>
  );
}

export function UserAvatar({ name, avatarId, size = 44 }: { name: string; avatarId: string | null; size?: number }) {
  const { colors } = useTheme();
  const xml = avatarId ? AVATAR_SVGS[avatarId] : undefined;
  if (xml) return <SvgXml xml={xml} width={size} height={size} />;
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return (
    <View style={[styles.initials, { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.accentSoft }]}>
      <Text style={{ color: colors.accentText, fontFamily: fonts.semibold, fontSize: size * 0.38 }}>{initials || "U"}</Text>
    </View>
  );
}

/** Bottom sheet using the native page-sheet modal, with a grabber and close button. */
export function Sheet({
  visible,
  onClose,
  title,
  subtitle,
  headerRight,
  children,
  footer,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  headerRight?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.sheet, { backgroundColor: colors.sheet }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[styles.grabber, { backgroundColor: colors.lineStrong }]} />
        <View style={styles.sheetHeader}>
          <View style={styles.flex}>
            <AppText variant="title" style={styles.sheetTitle}>
              {title}
            </AppText>
            {subtitle ? <AppText variant="meta">{subtitle}</AppText> : null}
          </View>
          {headerRight}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={onClose}
            hitSlop={8}
            style={[styles.sheetClose, { backgroundColor: colors.raised, borderColor: colors.line }]}
          >
            <X size={18} color={colors.muted} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
        {footer ? <View style={[styles.sheetFooter, { paddingBottom: Math.max(insets.bottom, 16) }]}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </Modal>
  );
}

export const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.4 },
  button: {
    minHeight: 52,
    borderRadius: radius.control,
    borderWidth: 1,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  buttonCompact: { minHeight: hitTarget, paddingHorizontal: 16 },
  buttonText: { fontFamily: fonts.semibold, fontSize: 17 },
  buttonTextCompact: { fontSize: 15 },
  iconButton: {
    width: hitTarget,
    height: hitTarget,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeDot: { position: "absolute", top: 9, right: 10, width: 9, height: 9, borderRadius: 5, borderWidth: 1.5 },
  segTrack: { flexDirection: "row", padding: 3, borderRadius: 13, borderWidth: 1 },
  segItem: { flex: 1, minHeight: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  segShadow: { shadowColor: "#16151F", shadowOpacity: 0.12, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  segText: { fontFamily: fonts.medium, fontSize: 14 },
  card: { borderRadius: radius.card, borderWidth: 1, padding: 16 },
  field: { minHeight: 52, borderRadius: radius.control, paddingHorizontal: 16, fontFamily: fonts.regular, fontSize: 17 },
  fieldMultiline: { minHeight: 110, paddingTop: 14, paddingBottom: 14, textAlignVertical: "top" },
  fieldLabel: { marginTop: 18, marginBottom: 8 },
  pill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.chip },
  pillText: { fontFamily: fonts.semibold, fontSize: 13 },
  error: { marginTop: 10 },
  empty: { opacity: 0.7, paddingVertical: 16, textAlign: "center" },
  initials: { alignItems: "center", justifyContent: "center" },
  sheet: { flex: 1, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet },
  grabber: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, marginTop: 8 },
  sheetHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingHorizontal: 20, paddingTop: 16 },
  sheetTitle: { fontSize: 24 },
  sheetClose: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  sheetBody: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32 },
  sheetFooter: { paddingHorizontal: 20, paddingTop: 12 },
});
