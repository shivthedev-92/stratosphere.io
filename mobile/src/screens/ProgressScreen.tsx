import { useFocusEffect } from "@react-navigation/native";
import { CheckCircle, CircleDashed } from "phosphor-react-native";
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { api, type EmotionLabel } from "../api";
import { Screen } from "../components/common";
import { AppText, Card, EmptyText, Segmented } from "../components/ui";
import { formatDateInput, formatLogDate, getEmotionLabel, getLogMeaning, NEGATIVE_EMOTIONS } from "../lib/format";
import { useAppState } from "../state/AppState";
import { useTheme } from "../theme";

const WEEKS = 16;

function levelFor(done: number) {
  if (done <= 0) return 0;
  if (done === 1) return 1;
  if (done === 2) return 2;
  return 3;
}

function deviceTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** Monday-first columns covering the last 16 weeks; future days are null. */
function buildWeeks(today: Date) {
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const mondayOffset = (end.getDay() + 6) % 7;
  const start = new Date(end);
  start.setDate(end.getDate() - mondayOffset - (WEEKS - 1) * 7);
  return Array.from({ length: WEEKS }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => {
      const date = new Date(start);
      date.setDate(start.getDate() + week * 7 + day);
      return date > end ? null : formatDateInput(date);
    }),
  );
}

/** Screen 11: Progress tab. */
export function ProgressScreen() {
  const { colors } = useTheme();
  const { token, goals, allGoalLogs, refresh, loading } = useAppState();
  const [tab, setTab] = useState<"progress" | "reflections">("progress");
  const [doneByDay, setDoneByDay] = useState<Map<string, number>>(new Map());

  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      api
        .progressDaily(token, deviceTimeZone(), WEEKS * 7)
        .then((data) => setDoneByDay(new Map(data.days.map((day) => [day.date, day.done]))))
        .catch(() => setDoneByDay(new Map()));
    }, [token, allGoalLogs.length]),
  );

  const weeks = useMemo(() => buildWeeks(new Date()), []);
  const completedCount = goals.filter((goal) => goal.completed).length;
  const openCount = goals.length - completedCount;

  const topEmotions = useMemo(() => {
    const now = new Date();
    const counts = new Map<EmotionLabel, number>();
    for (const log of allGoalLogs) {
      const created = new Date(log.created_at);
      if (!log.emotion_label || created.getMonth() !== now.getMonth() || created.getFullYear() !== now.getFullYear()) continue;
      counts.set(log.emotion_label, (counts.get(log.emotion_label) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [allGoalLogs]);
  const maxEmotion = Math.max(1, ...topEmotions.map(([, count]) => count));

  const goalTitles = useMemo(() => new Map(goals.map((goal) => [goal.id, goal.title])), [goals]);
  const sortedLogs = useMemo(
    () => [...allGoalLogs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [allGoalLogs],
  );

  return (
    <Screen onRefresh={refresh} refreshing={loading}>
      <AppText variant="title" style={styles.title}>
        Progress
      </AppText>
      <AppText variant="meta" style={styles.subtitle}>
        Track completed tasks and reflection activity.
      </AppText>
      <Segmented
        options={[
          { label: "Progress", value: "progress" },
          { label: "Reflections", value: "reflections" },
        ]}
        value={tab}
        onChange={setTab}
        style={styles.segmented}
      />

      {tab === "progress" ? (
        <>
          <View style={styles.tiles}>
            <Card style={styles.tile}>
              <CheckCircle size={22} color={colors.low} weight="fill" />
              <AppText variant="title" style={styles.tileValue}>
                {completedCount}
              </AppText>
              <AppText variant="meta">Completed</AppText>
            </Card>
            <Card style={styles.tile}>
              <CircleDashed size={22} color={colors.nd} />
              <AppText variant="title" style={styles.tileValue}>
                {openCount}
              </AppText>
              <AppText variant="meta">Open</AppText>
            </Card>
          </View>

          <Card style={styles.section}>
            <AppText variant="cardTitle">Activity</AppText>
            <AppText variant="meta" style={styles.sectionSub}>
              Tasks done per day, last {WEEKS} weeks.
            </AppText>
            <View style={styles.heatmap} accessibilityLabel="Activity heatmap">
              {weeks.map((week, weekIndex) => (
                <View key={weekIndex} style={styles.heatColumn}>
                  {week.map((key, dayIndex) => (
                    <View
                      key={dayIndex}
                      style={[
                        styles.heatCell,
                        { backgroundColor: key ? colors.heat[levelFor(doneByDay.get(key) ?? 0)] : "transparent" },
                      ]}
                    />
                  ))}
                </View>
              ))}
            </View>
            <View style={styles.legend}>
              <AppText variant="caption">Less</AppText>
              {colors.heat.map((color) => (
                <View key={color} style={[styles.legendCell, { backgroundColor: color }]} />
              ))}
              <AppText variant="caption">More</AppText>
            </View>
          </Card>

          <Card style={styles.section}>
            <AppText variant="cardTitle">Most felt this month</AppText>
            {topEmotions.length === 0 ? <EmptyText>No emotions logged this month.</EmptyText> : null}
            {topEmotions.map(([emotion, count]) => (
              <View key={emotion} style={styles.emotionRow}>
                <AppText variant="label" style={styles.emotionLabel}>
                  {getEmotionLabel(emotion)}
                </AppText>
                <View style={[styles.barTrack, { backgroundColor: colors.sunken }]}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        width: `${(count / maxEmotion) * 100}%`,
                        backgroundColor: NEGATIVE_EMOTIONS.has(emotion) ? colors.nd : colors.accent,
                      },
                    ]}
                  />
                </View>
                <AppText variant="meta">{count}</AppText>
              </View>
            ))}
          </Card>
        </>
      ) : (
        <>
          {sortedLogs.length === 0 ? <EmptyText>No journal entries yet.</EmptyText> : null}
          {sortedLogs.map((log, index) => (
            <View key={log.id} style={styles.entry}>
              <View style={styles.rail}>
                <View style={[styles.dot, { backgroundColor: index === 0 ? colors.accent : colors.lineStrong }]} />
                {index < sortedLogs.length - 1 ? <View style={[styles.line, { backgroundColor: colors.line }]} /> : null}
              </View>
              <View style={styles.entryBody}>
                <AppText variant="label" numberOfLines={1}>
                  {goalTitles.get(log.goal_id) ?? "Task removed"}
                </AppText>
                <AppText variant="meta">
                  {formatLogDate(log.created_at)} · {getEmotionLabel(log.emotion_label) ?? "No emotion"} · {getLogMeaning(log)}
                </AppText>
                <AppText variant="journal" numberOfLines={4}>
                  {log.reflection}
                </AppText>
              </View>
            </View>
          ))}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 8 },
  subtitle: { marginBottom: 16 },
  segmented: { marginBottom: 16 },
  tiles: { flexDirection: "row", gap: 12 },
  tile: { flex: 1, gap: 4 },
  tileValue: { marginTop: 4 },
  section: { marginTop: 12 },
  sectionSub: { marginBottom: 12 },
  heatmap: { flexDirection: "row", gap: 3 },
  heatColumn: { flex: 1, gap: 3 },
  heatCell: { aspectRatio: 1, borderRadius: 3 },
  legend: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 4, marginTop: 10 },
  legendCell: { width: 11, height: 11, borderRadius: 2 },
  emotionRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12 },
  emotionLabel: { width: 96 },
  barTrack: { flex: 1, height: 8, borderRadius: 4, overflow: "hidden" },
  barFill: { height: 8, borderRadius: 4 },
  entry: { flexDirection: "row", gap: 12 },
  rail: { width: 12, alignItems: "center" },
  dot: { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
  line: { width: 2, flex: 1, marginTop: 4 },
  entryBody: { flex: 1, paddingBottom: 20, gap: 4 },
});
