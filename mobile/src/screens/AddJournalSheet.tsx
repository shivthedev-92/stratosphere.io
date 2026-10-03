import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Switch, View } from "react-native";
import type { EmotionLabel, GoalLogOut, GoalOut } from "../api";
import { AppText, Button, ErrorText, Field, FieldLabel, Segmented, Sheet } from "../components/ui";
import { EMOTION_OPTIONS } from "../lib/format";
import { useAppState } from "../state/AppState";
import { fonts, radius, useTheme } from "../theme";

/** Screen 6: Add journal entry. */
export function AddJournalSheet({
  goal,
  onClose,
  onSaved,
}: {
  goal: GoalOut | null;
  onClose: () => void;
  onSaved?: (log: GoalLogOut) => void;
}) {
  const { colors } = useTheme();
  const { addReflection, loading, error, setError } = useAppState();
  const [reflection, setReflection] = useState("");
  const [emotion, setEmotion] = useState<EmotionLabel | null>(null);
  const [meaningful, setMeaningful] = useState<"yes" | "no">("yes");
  const [completeTask, setCompleteTask] = useState(false);

  useEffect(() => {
    if (!goal) return;
    setError("");
    setReflection("");
    setEmotion(null);
    setMeaningful("yes");
    setCompleteTask(false);
  }, [goal, setError]);

  async function save() {
    if (!goal) return;
    const log = await addReflection(goal, {
      reflection,
      soulful: meaningful === "yes",
      emotionLabel: emotion,
      completeTask,
    });
    if (log) {
      onSaved?.(log);
      onClose();
    }
  }

  return (
    <Sheet
      visible={goal !== null}
      onClose={onClose}
      title="Add journal entry"
      subtitle={goal?.title}
      footer={<Button label="Save entry" onPress={save} loading={loading} disabled={!reflection.trim()} style={styles.flex} />}
    >
      <Field
        journal
        multiline
        value={reflection}
        onChangeText={setReflection}
        placeholder="Add the latest detail, obstacle, decision, or reflection..."
        style={styles.textarea}
        accessibilityLabel="Journal entry"
      />

      <FieldLabel>How did this feel?</FieldLabel>
      <View style={styles.chips}>
        {EMOTION_OPTIONS.map((option) => {
          const selected = option.value === emotion;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setEmotion(selected ? null : option.value)}
              style={[
                styles.chip,
                { borderColor: selected ? colors.accent : colors.line, backgroundColor: selected ? colors.accentSoft : colors.raised },
              ]}
            >
              <AppText variant="label" color={selected ? colors.accentText : colors.muted} style={selected && styles.bold}>
                {option.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      <FieldLabel>Does this still feel meaningful?</FieldLabel>
      <Segmented
        options={[
          { label: "Yes", value: "yes" },
          { label: "No", value: "no" },
        ]}
        value={meaningful}
        onChange={setMeaningful}
      />

      <View style={[styles.switchRow, { backgroundColor: colors.raised, borderColor: colors.line }]}>
        <View style={styles.flex}>
          <AppText variant="label">Mark task complete</AppText>
          <AppText variant="meta">Only when the task itself is finished.</AppText>
        </View>
        <Switch
          value={completeTask}
          onValueChange={setCompleteTask}
          trackColor={{ true: colors.accent, false: colors.line }}
          accessibilityLabel="Mark task complete"
        />
      </View>
      <ErrorText>{error}</ErrorText>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontFamily: fonts.semibold },
  textarea: { minHeight: 150 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { minHeight: 40, paddingHorizontal: 14, borderRadius: radius.full, borderWidth: 1, justifyContent: "center" },
  switchRow: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: radius.control,
    borderWidth: 1,
    padding: 14,
  },
});
