import { BottomTabBarHeightContext } from "@react-navigation/bottom-tabs";
import { CaretLeft, CheckCircle, CircleDashed } from "phosphor-react-native";
import { useContext, type ReactNode } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import type { GoalLogOut, GoalOut } from "../api";
import { PRIORITY_META, TaskIcon } from "../icons";
import { formatGoalTime } from "../lib/format";
import { radius, useTheme } from "../theme";
import { AppText, Button } from "./ui";

// Logo 1a (Strata), same path as frontend/src/components/brand-mark.tsx.
const STRATA_PATH =
  "M32 5A27 27 0 0 1 55.09 18H8.91A27 27 0 0 1 32 5ZM7.72 20.2H56.28A27 27 0 0 1 58.77 28.5H5.23A27 27 0 0 1 7.72 20.2ZM5.01 31.3H58.99A27 27 0 0 1 57.79 40H6.21A27 27 0 0 1 5.01 31.3ZM7.52 43.4H56.48A27 27 0 0 1 32 59A27 27 0 0 1 7.52 43.4Z";

export function StrataMark({ size = 96, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" accessibilityLabel="Stratosphere">
      <Path d={STRATA_PATH} fill={color} />
    </Svg>
  );
}

function useTabBarHeight() {
  // Pushed screens render outside the tab navigator, where the hook would throw.
  const height = useContext(BottomTabBarHeightContext);
  return height ?? 0;
}

export function Screen({
  children,
  header,
  footer,
  onRefresh,
  refreshing = false,
  contentStyle,
}: {
  children: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useTabBarHeight();
  const bottom = footer ? 24 : Math.max(tabBarHeight, insets.bottom) + 24;

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      {header}
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottom }, contentStyle]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        refreshControl={
          onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentText} /> : undefined
        }
      >
        {children}
      </ScrollView>
      {footer ? (
        <View
          style={[
            styles.footer,
            { paddingBottom: Math.max(insets.bottom, 12), backgroundColor: colors.bar, borderTopColor: colors.line },
          ]}
        >
          {footer}
        </View>
      ) : null}
    </View>
  );
}

export function PushedHeader({ backLabel, onBack, right }: { backLabel: string; onBack: () => void; right?: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.pushedHeader}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Back to ${backLabel}`}
        onPress={onBack}
        hitSlop={8}
        style={styles.back}
      >
        <CaretLeft size={22} color={colors.accentText} />
        <AppText variant="body" color={colors.accentText} style={styles.backLabel}>
          {backLabel}
        </AppText>
      </Pressable>
      <View style={styles.headerRight}>{right}</View>
    </View>
  );
}

export function StatusIcon({ completed, size = 24 }: { completed: boolean; size?: number }) {
  const { colors } = useTheme();
  return (
    <View accessible accessibilityLabel={completed ? "Completed" : "Open"}>
      {completed ? (
        <CheckCircle size={size} color={colors.low} weight="fill" />
      ) : (
        <CircleDashed size={size} color={colors.nd} />
      )}
    </View>
  );
}

export function PriorityTile({ goal, size = 40 }: { goal: GoalOut; size?: number }) {
  const { colors } = useTheme();
  const meta = PRIORITY_META[goal.priority];
  return (
    <View style={[styles.tile, { width: size, height: size, backgroundColor: colors[meta.bg] as string }]}>
      <TaskIcon value={goal.emoji} size={size * 0.5} color={colors[meta.color] as string} />
    </View>
  );
}

export function GoalCard({
  goal,
  latestLog,
  onReflect,
  onView,
}: {
  goal: GoalOut;
  latestLog?: GoalLogOut;
  onReflect: () => void;
  onView: () => void;
}) {
  const { colors } = useTheme();
  const meta = PRIORITY_META[goal.priority];
  return (
    <View
      style={[
        styles.goalCard,
        { backgroundColor: colors.raised, borderColor: colors.line },
        goal.completed && styles.completed,
      ]}
    >
      <Pressable accessibilityRole="button" onPress={onView} style={styles.goalRow}>
        <PriorityTile goal={goal} />
        <View style={styles.goalText}>
          <AppText
            variant="cardTitle"
            numberOfLines={2}
            style={[styles.goalTitle, goal.completed && styles.struck]}
          >
            {goal.title}
          </AppText>
          <AppText variant="meta" numberOfLines={1}>
            {meta.label} · {formatGoalTime(goal)}
          </AppText>
        </View>
        <StatusIcon completed={goal.completed} />
      </Pressable>
      {latestLog ? (
        <View style={[styles.latestLog, { backgroundColor: colors.sunken }]}>
          <AppText variant="journal" color={colors.muted} numberOfLines={2} style={styles.latestLogText}>
            {latestLog.reflection}
          </AppText>
        </View>
      ) : null}
      <View style={styles.goalActions}>
        {!goal.completed ? <Button label="Reflect" variant="soft" compact onPress={onReflect} style={styles.flex} /> : null}
        <Button label="View" variant="secondary" compact onPress={onView} style={styles.flex} />
      </View>
    </View>
  );
}

export function SectionHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.flex}>
        <AppText variant="cardTitle">{title}</AppText>
        {subtitle ? <AppText variant="meta">{subtitle}</AppText> : null}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8 },
  footer: { paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, flexDirection: "row", gap: 10 },
  pushedHeader: { height: 48, flexDirection: "row", alignItems: "center", paddingHorizontal: 12 },
  back: { flexDirection: "row", alignItems: "center", minHeight: 44, paddingRight: 8 },
  backLabel: { fontSize: 17, marginLeft: 2 },
  headerRight: { flex: 1, flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  tile: { borderRadius: 12, alignItems: "center", justifyContent: "center" },
  goalCard: { borderRadius: radius.card, borderWidth: 1, padding: 14, marginBottom: 12 },
  completed: { opacity: 0.7 },
  goalRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  goalText: { flex: 1, gap: 2 },
  goalTitle: { fontSize: 16 },
  struck: { textDecorationLine: "line-through" },
  latestLog: { marginTop: 12, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  latestLogText: { fontSize: 15, lineHeight: 21 },
  goalActions: { flexDirection: "row", gap: 10, marginTop: 12 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
});
