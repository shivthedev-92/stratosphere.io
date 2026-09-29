import { CaretRight, PencilSimple, Plus, Trash } from "phosphor-react-native";
import { useRef, useState } from "react";
import { Alert, Animated, Pressable, StyleSheet, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import type { GoalOut } from "../api";
import { PriorityTile, PushedHeader, Screen, SectionHeader, StatusIcon } from "../components/common";
import { AppText, EmptyText, ErrorText } from "../components/ui";
import { formatGoalTime, formatMonthLabel, getDateKey, getDateKeyFromDate, getGoalDate, parseDateInput } from "../lib/format";
import type { RootScreenProps } from "../navigation";
import { useAppState } from "../state/AppState";
import { radius, useTheme } from "../theme";
import { AddTaskSheet } from "./AddTaskSheet";

/** Screen 8: Calendar day (pushed). */
export function CalendarDayScreen({ navigation, route }: RootScreenProps<"CalendarDay">) {
  const { colors } = useTheme();
  const { goals, deleteGoal, error } = useAppState();
  const date = parseDateInput(route.params.date);
  const dayKey = getDateKeyFromDate(date);
  const dayGoals = goals.filter((goal) => getDateKey(getGoalDate(goal)) === dayKey);
  const [sheet, setSheet] = useState<{ goal: GoalOut | null } | null>(null);

  function confirmDelete(goal: GoalOut) {
    Alert.alert("Delete this task?", "Its journal entries will be deleted too.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteGoal(goal) },
    ]);
  }

  return (
    <>
      <Screen header={<PushedHeader backLabel="Calendar" onBack={navigation.goBack} />}>
        <AppText variant="eyebrow">Calendar day</AppText>
        <AppText variant="pushedTitle" style={styles.title}>
          {date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        </AppText>
        <AppText variant="meta" style={styles.subtitle}>
          {dayGoals.length} {dayGoals.length === 1 ? "item" : "items"} · {formatMonthLabel(date)}
        </AppText>

        <SectionHeader title="Action Items" subtitle="Edit, delete, or reflect on this day." />
        <ErrorText>{error}</ErrorText>
        <View style={[styles.list, { borderColor: colors.line, backgroundColor: colors.raised }]}>
          {dayGoals.length === 0 ? <EmptyText>No action items for this day.</EmptyText> : null}
          {dayGoals.map((goal, index) => (
            <SwipeRow
              key={goal.id}
              onEdit={() => setSheet({ goal })}
              onDelete={() => confirmDelete(goal)}
              last={index === dayGoals.length - 1}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityHint="Swipe left for edit and delete"
                onPress={() => navigation.navigate("TaskJournal", { goalId: goal.id })}
                style={[styles.row, { backgroundColor: colors.raised }]}
              >
                <PriorityTile goal={goal} size={32} />
                <View style={styles.flex}>
                  <AppText variant="label" numberOfLines={1}>
                    {goal.title}
                  </AppText>
                  <AppText variant="meta">{formatGoalTime(goal)}</AppText>
                </View>
                <StatusIcon completed={goal.completed} size={20} />
                <CaretRight size={16} color={colors.subtle} />
              </Pressable>
            </SwipeRow>
          ))}
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => setSheet({ goal: null })}
          style={[styles.addDay, { borderColor: colors.lineStrong }]}
        >
          <Plus size={18} color={colors.accentText} />
          <AppText variant="label" color={colors.accentText}>
            Add to this day
          </AppText>
        </Pressable>
      </Screen>

      <AddTaskSheet
        visible={sheet !== null}
        goal={sheet?.goal}
        presetDate={route.params.date}
        onClose={() => setSheet(null)}
      />
    </>
  );
}

function SwipeRow({
  children,
  onEdit,
  onDelete,
  last,
}: {
  children: React.ReactNode;
  onEdit: () => void;
  onDelete: () => void;
  last: boolean;
}) {
  const { colors } = useTheme();
  const ref = useRef<Swipeable>(null);

  function renderActions(progress: Animated.AnimatedInterpolation<number>) {
    const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [150, 0] });
    const action = (label: string, color: string, Glyph: typeof Trash, onPress: () => void) => (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => {
          ref.current?.close();
          onPress();
        }}
        style={[styles.action, { backgroundColor: color }]}
      >
        <Glyph size={20} color="#FFFFFF" />
        <AppText variant="caption" color="#FFFFFF">
          {label}
        </AppText>
      </Pressable>
    );
    return (
      <Animated.View style={[styles.actions, { transform: [{ translateX }] }]}>
        {action("Edit", colors.med, PencilSimple, onEdit)}
        {action("Delete", colors.danger, Trash, onDelete)}
      </Animated.View>
    );
  }

  return (
    <View style={!last && { borderBottomWidth: 1, borderBottomColor: colors.line }}>
      <Swipeable ref={ref} renderRightActions={renderActions} overshootRight={false} friction={2}>
        {children}
      </Swipeable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  title: { marginTop: 4 },
  subtitle: { marginTop: 4, marginBottom: 20 },
  list: { borderRadius: radius.card, borderWidth: 1, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 60, paddingHorizontal: 14 },
  actions: { flexDirection: "row", width: 150 },
  action: { width: 75, alignItems: "center", justifyContent: "center", gap: 2 },
  addDay: {
    marginTop: 16,
    minHeight: 52,
    borderRadius: radius.control,
    borderWidth: 1.5,
    borderStyle: "dashed",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
});
