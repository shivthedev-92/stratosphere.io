import { CaretLeft, CaretRight } from "phosphor-react-native";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import type { GoalOut } from "../api";
import { PriorityTile, Screen, StatusIcon } from "../components/common";
import { AppText, Card, EmptyText, IconButton } from "../components/ui";
import { PRIORITIES, PRIORITY_META } from "../icons";
import {
  formatDateInput,
  formatGoalTime,
  formatMonthLabel,
  getCalendarDays,
  getDateKey,
  getDateKeyFromDate,
  getGoalDate,
  WEEKDAY_LABELS,
} from "../lib/format";
import type { TabScreenProps } from "../navigation";
import { useAppState } from "../state/AppState";
import { fonts, useTheme } from "../theme";

/** Screen 7: Calendar tab. */
export function CalendarScreen({ navigation }: TabScreenProps<"Calendar">) {
  const { colors } = useTheme();
  const { goals, refresh, loading } = useAppState();
  const [month, setMonth] = useState(() => new Date());
  const [selected, setSelected] = useState(() => new Date());

  const goalsByDateKey = useMemo(() => {
    return goals.reduce<Record<string, GoalOut[]>>((grouped, goal) => {
      const key = getDateKey(getGoalDate(goal));
      (grouped[key] ??= []).push(goal);
      return grouped;
    }, {});
  }, [goals]);
  const days = useMemo(() => getCalendarDays(month), [month]);
  const todayKey = getDateKey(null);
  const selectedKey = getDateKeyFromDate(selected);
  const selectedGoals = goalsByDateKey[selectedKey] ?? [];

  return (
    <Screen onRefresh={refresh} refreshing={loading}>
      <AppText variant="title" style={styles.title}>
        Calendar
      </AppText>
      <AppText variant="meta" style={styles.subtitle}>
        Priority dots mark scheduled task dates.
      </AppText>

      <Card>
        <View style={styles.monthHeader}>
          <AppText variant="cardTitle" style={styles.flex}>
            {formatMonthLabel(month)}
          </AppText>
          <IconButton
            icon={CaretLeft}
            label="Previous month"
            size={18}
            onPress={() => setMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
          />
          <IconButton
            icon={CaretRight}
            label="Next month"
            size={18}
            onPress={() => setMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
          />
        </View>
        <View style={styles.week}>
          {WEEKDAY_LABELS.map((label, index) => (
            <AppText key={index} variant="caption" style={styles.weekday}>
              {label}
            </AppText>
          ))}
        </View>
        <View style={styles.grid}>
          {days.map((day) => {
            const dayGoals = goalsByDateKey[day.dateKey] ?? [];
            const priorities = PRIORITIES.filter((priority) => dayGoals.some((goal) => goal.priority === priority));
            const isSelected = day.dateKey === selectedKey;
            const isToday = day.dateKey === todayKey;
            return (
              <Pressable
                key={day.dateKey}
                accessibilityRole="button"
                accessibilityLabel={`${day.date.toDateString()}, ${dayGoals.length} items`}
                accessibilityState={{ selected: isSelected }}
                onPress={() => setSelected(day.date)}
                style={[styles.cell, !day.isCurrentMonth && styles.outside]}
              >
                <View
                  style={[
                    styles.dateSquare,
                    isSelected && { backgroundColor: colors.accent },
                    isToday && !isSelected && { borderWidth: 1.5, borderColor: colors.accent },
                  ]}
                >
                  <AppText
                    variant="label"
                    color={isSelected ? "#FFFFFF" : isToday ? colors.accentText : colors.ink}
                    style={(isSelected || isToday) && styles.bold}
                  >
                    {day.date.getDate()}
                  </AppText>
                </View>
                <View style={styles.dots}>
                  {priorities.map((priority) => (
                    <View
                      key={priority}
                      style={[styles.dot, { backgroundColor: colors[PRIORITY_META[priority].color] as string }]}
                    />
                  ))}
                </View>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.legend}>
          {PRIORITIES.map((priority) => (
            <View key={priority} style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: colors[PRIORITY_META[priority].color] as string }]} />
              <AppText variant="meta">{PRIORITY_META[priority].label}</AppText>
            </View>
          ))}
        </View>
      </Card>

      <View style={styles.dayHeader}>
        <AppText variant="cardTitle" style={styles.flex}>
          {selected.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
        </AppText>
        <Pressable
          accessibilityRole="link"
          hitSlop={10}
          onPress={() => navigation.navigate("CalendarDay", { date: formatDateInput(selected) })}
        >
          <AppText variant="label" color={colors.accentText}>
            See day
          </AppText>
        </Pressable>
      </View>
      {selectedGoals.length === 0 ? <EmptyText>No action items for this day.</EmptyText> : null}
      {selectedGoals.map((goal) => (
        <Pressable
          key={goal.id}
          accessibilityRole="button"
          onPress={() => navigation.navigate("TaskJournal", { goalId: goal.id })}
          style={[styles.compactRow, { borderBottomColor: colors.line }]}
        >
          <PriorityTile goal={goal} size={32} />
          <View style={styles.flex}>
            <AppText variant="label" numberOfLines={1}>
              {goal.title}
            </AppText>
            <AppText variant="meta">{formatGoalTime(goal)}</AppText>
          </View>
          <StatusIcon completed={goal.completed} size={20} />
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontFamily: fonts.semibold },
  title: { marginTop: 8 },
  subtitle: { marginBottom: 16 },
  monthHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  week: { flexDirection: "row" },
  weekday: { flex: 1, textAlign: "center", paddingVertical: 6 },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: `${100 / 7}%`, height: 48, alignItems: "center", justifyContent: "flex-start", paddingTop: 2 },
  outside: { opacity: 0.4 },
  dateSquare: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  dots: { flexDirection: "row", gap: 3, marginTop: 3, height: 5 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  legend: { flexDirection: "row", gap: 16, marginTop: 8, justifyContent: "center" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  dayHeader: { flexDirection: "row", alignItems: "center", marginTop: 20, marginBottom: 8 },
  compactRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, borderBottomWidth: 1 },
});
