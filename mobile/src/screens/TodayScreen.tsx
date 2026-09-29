import { Bell, Plus } from "phosphor-react-native";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import type { GoalOut } from "../api";
import { GoalCard, Screen } from "../components/common";
import { AppText, Card, EmptyText, ErrorText, IconButton, Segmented, UserAvatar } from "../components/ui";
import { formatTodayEyebrow, getDateKey, getGoalDate } from "../lib/format";
import { motivationalMessages } from "../lib/motivational-messages";
import type { TabScreenProps } from "../navigation";
import { useAppState } from "../state/AppState";
import { useTheme } from "../theme";
import { AddJournalSheet } from "./AddJournalSheet";
import { AddTaskSheet } from "./AddTaskSheet";
import { NotificationsSheet } from "./NotificationsSheet";

type Filter = "today" | "all" | "completed";

/** Screen 3: Today tab. */
export function TodayScreen({ navigation }: TabScreenProps<"Today">) {
  const { colors } = useTheme();
  const tabBarHeight = useBottomTabBarHeight();
  const { user, goals, latestLogByGoalId, unreadNotifications, loading, error, refresh } = useAppState();
  const [filter, setFilter] = useState<Filter>("today");
  const [showAddTask, setShowAddTask] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [reflectGoal, setReflectGoal] = useState<GoalOut | null>(null);
  const [quoteIndex, setQuoteIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setQuoteIndex((current) => (current + 1) % motivationalMessages.length), 12_000);
    return () => clearInterval(timer);
  }, []);

  const todayGoals = useMemo(() => {
    const todayKey = getDateKey(null);
    return goals.filter((goal) => getDateKey(getGoalDate(goal)) === todayKey);
  }, [goals]);
  const completedGoals = useMemo(() => goals.filter((goal) => goal.completed), [goals]);
  const visibleGoals = filter === "today" ? todayGoals : filter === "completed" ? completedGoals : goals;
  const todayDone = todayGoals.filter((goal) => goal.completed).length;
  const progress = todayGoals.length ? todayDone / todayGoals.length : 0;

  if (!user) return null;

  return (
    <View style={styles.flex}>
      <Screen onRefresh={refresh} refreshing={loading}>
        <View style={styles.header}>
          <View style={styles.flex}>
            <AppText variant="eyebrow">{formatTodayEyebrow()}</AppText>
            <AppText variant="title" numberOfLines={2}>
              Hello, {user.name.split(" ")[0]}
            </AppText>
          </View>
          <IconButton
            icon={Bell}
            label={unreadNotifications > 0 ? `Notifications, ${unreadNotifications} unread` : "Notifications"}
            badge={unreadNotifications > 0}
            onPress={() => setShowNotifications(true)}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Settings"
            onPress={() => navigation.navigate("Settings")}
            hitSlop={4}
          >
            <UserAvatar name={user.name} avatarId={user.avatar_id} size={44} />
          </Pressable>
        </View>

        <Card style={styles.summary}>
          <View style={styles.summaryRow}>
            <AppText variant="cardTitle">
              {todayDone} of {todayGoals.length} done today
            </AppText>
            <AppText variant="meta">{goals.length} in total</AppText>
          </View>
          <View
            style={[styles.track, { backgroundColor: colors.sunken }]}
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: todayGoals.length, now: todayDone }}
          >
            <View style={[styles.fill, { backgroundColor: colors.accent, width: `${progress * 100}%` }]} />
          </View>
          <AppText variant="journal" color={colors.muted} style={styles.quote}>
            “{motivationalMessages[quoteIndex]}”
          </AppText>
        </Card>

        <Segmented<Filter>
          options={[
            { label: "Today", value: "today" },
            { label: `All (${goals.length})`, value: "all" },
            { label: `Completed (${completedGoals.length})`, value: "completed" },
          ]}
          value={filter}
          onChange={setFilter}
          style={styles.segmented}
        />

        <ErrorText>{error}</ErrorText>
        {visibleGoals.length === 0 ? (
          <EmptyText>
            {filter === "today"
              ? "No action items for today."
              : filter === "completed"
                ? "No completed items yet."
                : "No action items yet."}
          </EmptyText>
        ) : (
          visibleGoals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              latestLog={latestLogByGoalId[goal.id]}
              onReflect={() => setReflectGoal(goal)}
              onView={() => navigation.navigate("TaskJournal", { goalId: goal.id })}
            />
          ))
        )}
      </Screen>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add action item"
        onPress={() => setShowAddTask(true)}
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: colors.accent, bottom: tabBarHeight + 16, shadowColor: colors.accent },
          pressed && styles.pressed,
        ]}
      >
        <Plus size={26} color="#FFFFFF" weight="bold" />
      </Pressable>

      <AddTaskSheet
        visible={showAddTask}
        onClose={() => setShowAddTask(false)}
        onSaved={() => setFilter("all")}
      />
      <AddJournalSheet goal={reflectGoal} onClose={() => setReflectGoal(null)} />
      <NotificationsSheet visible={showNotifications} onClose={() => setShowNotifications(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.8 },
  header: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8, marginBottom: 16 },
  summary: { gap: 10 },
  summaryRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  track: { height: 8, borderRadius: 4, overflow: "hidden" },
  fill: { height: 8, borderRadius: 4 },
  quote: { fontSize: 16, lineHeight: 22 },
  segmented: { marginVertical: 16 },
  fab: {
    position: "absolute",
    right: 20,
    width: 58,
    height: 58,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
});
