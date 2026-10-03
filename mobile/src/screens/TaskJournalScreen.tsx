import { useFocusEffect } from "@react-navigation/native";
import { PencilSimple } from "phosphor-react-native";
import { useCallback, useState } from "react";
import { ActivityIndicator, ActionSheetIOS, Alert, Platform, StyleSheet, View } from "react-native";
import type { GoalLogOut } from "../api";
import { PushedHeader, Screen } from "../components/common";
import { AppText, Button, Card, EmptyText, ErrorText, IconButton, Pill, PriorityChip, Segmented } from "../components/ui";
import { formatGoalTime, formatLogDate, getEmotionLabel, getLogMeaning, NEGATIVE_EMOTIONS } from "../lib/format";
import type { RootScreenProps } from "../navigation";
import { useAppState } from "../state/AppState";
import { radius, useTheme } from "../theme";
import { AddJournalSheet } from "./AddJournalSheet";
import { AddTaskSheet } from "./AddTaskSheet";

/** Screen 5: Task journal (pushed). */
export function TaskJournalScreen({ navigation, route }: RootScreenProps<"TaskJournal">) {
  const { colors } = useTheme();
  const { goals, loadGoalLogs, setGoalCompleted, deleteGoal, openAssistant, loading, error } = useAppState();
  const goal = goals.find((item) => item.id === route.params.goalId) ?? null;
  const [logs, setLogs] = useState<GoalLogOut[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [showJournal, setShowJournal] = useState(false);

  const reload = useCallback(async () => {
    setLogsLoading(true);
    setLogs(await loadGoalLogs(route.params.goalId));
    setLogsLoading(false);
    // loadGoalLogs changes identity each render; the goal id is the real dependency.
  }, [route.params.goalId]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  if (!goal) {
    return (
      <Screen header={<PushedHeader backLabel="Today" onBack={navigation.goBack} />}>
        <EmptyText>This task no longer exists.</EmptyText>
      </Screen>
    );
  }

  const current = goal;
  const sortedLogs = [...logs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  function confirmDelete() {
    Alert.alert("Delete this task?", "Its journal entries will be deleted too.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          if (await deleteGoal(current)) navigation.goBack();
        },
      },
    ]);
  }

  function openMenu() {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ["Edit task", "Delete task", "Cancel"], destructiveButtonIndex: 1, cancelButtonIndex: 2 },
        (index) => {
          if (index === 0) setShowEdit(true);
          if (index === 1) confirmDelete();
        },
      );
    } else {
      Alert.alert(current.title, undefined, [
        { text: "Edit task", onPress: () => setShowEdit(true) },
        { text: "Delete task", style: "destructive", onPress: confirmDelete },
        { text: "Cancel", style: "cancel" },
      ]);
    }
  }

  async function askAster() {
    await openAssistant(current);
    navigation.navigate("Tabs", { screen: "Aster" });
  }

  return (
    <>
      <Screen
        header={
          <PushedHeader
            backLabel="Today"
            onBack={navigation.goBack}
            right={<IconButton icon={PencilSimple} label="Edit or delete task" onPress={openMenu} />}
          />
        }
        footer={
          <>
            {!current.completed ? (
              <Button label="Add journal entry" onPress={() => setShowJournal(true)} style={styles.flex} />
            ) : null}
            <Button label="Ask Aster" variant="secondary" onPress={askAster} style={styles.flex} />
          </>
        }
      >
        <AppText variant="eyebrow">Task journal</AppText>
        <AppText variant="pushedTitle" style={styles.title}>
          {current.title}
        </AppText>
        <View style={styles.chips}>
          <PriorityChip priority={current.priority} />
          <Pill label={formatGoalTime(current)} color={colors.muted} bg={colors.raised} />
        </View>

        {current.notes ? (
          <Card style={styles.card}>
            <AppText variant="eyebrow">Task context</AppText>
            <AppText variant="body" style={styles.cardBody}>
              {current.notes}
            </AppText>
          </Card>
        ) : null}

        <Card style={styles.card}>
          <AppText variant="cardTitle">Task status</AppText>
          <AppText variant="meta" style={styles.cardBody}>
            Mark the task complete only when the task itself is finished.
          </AppText>
          <Segmented
            options={[
              { label: "Open", value: "open" },
              { label: "Completed", value: "completed" },
            ]}
            value={current.completed ? "completed" : "open"}
            onChange={(value) => setGoalCompleted(current, value === "completed")}
            style={styles.segmented}
          />
          {loading ? <ActivityIndicator color={colors.accentText} style={styles.loader} /> : null}
          <ErrorText>{error}</ErrorText>
        </Card>

        <View style={styles.timelineHeader}>
          <AppText variant="cardTitle">Journal timeline</AppText>
          <AppText variant="meta">Latest entries first.</AppText>
        </View>
        {logsLoading && logs.length === 0 ? <ActivityIndicator color={colors.accentText} /> : null}
        {!logsLoading && sortedLogs.length === 0 ? <EmptyText>No journal entries yet.</EmptyText> : null}
        {sortedLogs.map((log, index) => {
          const emotion = getEmotionLabel(log.emotion_label);
          const negative = log.emotion_label ? NEGATIVE_EMOTIONS.has(log.emotion_label) : false;
          return (
            <View key={log.id} style={styles.entry}>
              <View style={styles.rail}>
                <View style={[styles.dot, { backgroundColor: index === 0 ? colors.accent : colors.lineStrong }]} />
                {index < sortedLogs.length - 1 ? <View style={[styles.line, { backgroundColor: colors.line }]} /> : null}
              </View>
              <View style={styles.entryBody}>
                <View style={styles.entryMeta}>
                  <AppText variant="meta">{formatLogDate(log.created_at)}</AppText>
                  {emotion ? (
                    <Pill
                      label={emotion}
                      color={negative ? colors.nd : colors.accentText}
                      bg={negative ? colors.raised : colors.accentSoft}
                    />
                  ) : null}
                  <AppText variant="meta" color={log.soulful ? colors.low : colors.nd}>
                    {getLogMeaning(log)}
                  </AppText>
                </View>
                <AppText variant="journal">{log.reflection}</AppText>
              </View>
            </View>
          );
        })}
      </Screen>

      <AddTaskSheet visible={showEdit} goal={current} onClose={() => setShowEdit(false)} onDeleted={navigation.goBack} />
      <AddJournalSheet
        goal={showJournal ? current : null}
        onClose={() => setShowJournal(false)}
        onSaved={(log) => setLogs((existing) => [log, ...existing])}
      />
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  title: { marginTop: 4 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12, marginBottom: 16 },
  card: { marginBottom: 12 },
  cardBody: { marginTop: 6 },
  segmented: { marginTop: 12 },
  loader: { marginTop: 8 },
  timelineHeader: { marginTop: 12, marginBottom: 12 },
  entry: { flexDirection: "row", gap: 12 },
  rail: { width: 12, alignItems: "center" },
  dot: { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
  line: { width: 2, flex: 1, marginTop: 4, borderRadius: radius.full },
  entryBody: { flex: 1, paddingBottom: 20, gap: 6 },
  entryMeta: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
});
