import DateTimePicker from "@react-native-community/datetimepicker";
import { CalendarBlank, Clock, X } from "phosphor-react-native";
import { useEffect, useState } from "react";
import { Alert, Platform, Pressable, StyleSheet, View } from "react-native";
import type { GoalOut, Priority } from "../api";
import { AppText, Button, ErrorText, Field, FieldLabel, Sheet } from "../components/ui";
import { DEFAULT_TASK_ICON, PRIORITIES, PRIORITY_META, TASK_ICONS, TASK_ICON_KEYS, taskIconKey } from "../icons";
import {
  formatDateInput,
  formatScheduledFor,
  formatTimeInput,
  getTaskScheduledDate,
  getTaskScheduledTime,
  parseDateInput,
  parseTimeInput,
} from "../lib/format";
import { useAppState } from "../state/AppState";
import { fonts, hitTarget, radius, useTheme } from "../theme";

/** Screen 4: Add action item. Also edits an existing task when `goal` is set. */
export function AddTaskSheet({
  visible,
  onClose,
  goal,
  presetDate,
  onSaved,
  onDeleted,
}: {
  visible: boolean;
  onClose: () => void;
  goal?: GoalOut | null;
  /** YYYY-MM-DD, used by "Add to this day". */
  presetDate?: string;
  onSaved?: (goal: GoalOut) => void;
  onDeleted?: () => void;
}) {
  const { colors, name } = useTheme();
  const { createGoal, updateGoal, deleteGoal, loading, error, setError } = useAppState();
  const [title, setTitle] = useState("");
  const [icon, setIcon] = useState(DEFAULT_TASK_ICON);
  const [notes, setNotes] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [picker, setPicker] = useState<"date" | "time" | null>(null);

  useEffect(() => {
    if (!visible) return;
    setError("");
    setPicker(null);
    setTitle(goal?.title ?? "");
    setIcon(taskIconKey(goal?.emoji));
    setNotes(goal?.notes ?? "");
    setPriority(goal?.priority ?? "medium");
    setDate(goal ? getTaskScheduledDate(goal) : (presetDate ?? ""));
    setTime(goal ? getTaskScheduledTime(goal) : "09:00");
  }, [visible, goal, presetDate, setError]);

  async function save() {
    if (!title.trim()) return;
    const data = {
      title: title.trim(),
      emoji: icon,
      notes: notes.trim() || null,
      is_timed: Boolean(date),
      scheduled_for: date ? formatScheduledFor(date, time) : null,
      priority,
    };
    const saved = goal ? await updateGoal(goal, data) : await createGoal(data);
    if (saved) {
      onSaved?.(saved);
      onClose();
    }
  }

  function confirmDelete() {
    if (!goal) return;
    Alert.alert("Delete this task?", "Its journal entries will be deleted too.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          if (await deleteGoal(goal)) {
            onClose();
            onDeleted?.();
          }
        },
      },
    ]);
  }

  const pickerProps = {
    display: Platform.OS === "ios" ? ("spinner" as const) : ("default" as const),
    themeVariant: name === "night" ? ("dark" as const) : ("light" as const),
    textColor: colors.ink,
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={goal ? "Edit Action Item" : "Add Action Item"}
      subtitle={goal ? "Update or remove this action item." : "Capture a task or moment you want to revisit."}
      footer={
        <View style={styles.footer}>
          <Button
            label={goal ? "Save changes" : "Add action item"}
            onPress={save}
            loading={loading}
            disabled={!title.trim()}
          />
          {goal ? <Button label="Delete task" variant="destructive" onPress={confirmDelete} disabled={loading} /> : null}
        </View>
      }
    >
      <FieldLabel>Task title</FieldLabel>
      <Field value={title} onChangeText={setTitle} placeholder="Task title" returnKeyType="done" />

      <FieldLabel>Icon</FieldLabel>
      <View style={styles.iconGrid} accessibilityRole="radiogroup">
        {TASK_ICON_KEYS.map((key) => {
          const Glyph = TASK_ICONS[key];
          const selected = key === icon;
          return (
            <Pressable
              key={key}
              accessibilityRole="radio"
              accessibilityLabel={key}
              accessibilityState={{ selected }}
              onPress={() => setIcon(key)}
              style={[
                styles.iconTile,
                { backgroundColor: selected ? colors.accentSoft : colors.raised, borderColor: selected ? colors.accent : colors.line },
                selected && styles.iconTileSelected,
              ]}
            >
              <Glyph size={22} color={selected ? colors.accentText : colors.muted} weight={selected ? "fill" : "regular"} />
            </Pressable>
          );
        })}
      </View>

      <FieldLabel>Specific notes</FieldLabel>
      <Field value={notes} onChangeText={setNotes} placeholder="Specific notes" multiline />

      <FieldLabel>Priority</FieldLabel>
      <View style={styles.priorityRow} accessibilityRole="radiogroup">
        {PRIORITIES.map((value) => {
          const meta = PRIORITY_META[value];
          const selected = value === priority;
          const tone = colors[meta.color] as string;
          return (
            <Pressable
              key={value}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => setPriority(value)}
              style={[
                styles.priorityOption,
                {
                  borderColor: selected ? tone : colors.line,
                  backgroundColor: selected ? (colors[meta.bg] as string) : colors.raised,
                },
              ]}
            >
              <meta.icon size={18} color={selected ? tone : colors.muted} weight={selected ? "fill" : "regular"} />
              <AppText variant="label" color={selected ? tone : colors.muted} style={selected && styles.bold}>
                {meta.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.dateRow}>
        <View style={styles.flex}>
          <FieldLabel>Calendar date</FieldLabel>
          <PickerField
            icon="date"
            value={date ? parseDateInput(date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : ""}
            placeholder="Optional date"
            onPress={() => setPicker(picker === "date" ? null : "date")}
            onClear={
              date
                ? () => {
                    setDate("");
                    setTime("09:00");
                    setPicker(null);
                  }
                : undefined
            }
          />
        </View>
        <View style={styles.flex}>
          <FieldLabel>Reminder time</FieldLabel>
          <PickerField
            icon="time"
            value={date ? parseTimeInput(time).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : ""}
            placeholder="Pick a date first"
            disabled={!date}
            onPress={() => setPicker(picker === "time" ? null : "time")}
          />
        </View>
      </View>
      {picker === "date" ? (
        <DateTimePicker
          {...pickerProps}
          mode="date"
          value={parseDateInput(date)}
          onChange={(_, selected) => {
            if (Platform.OS !== "ios") setPicker(null);
            if (selected) setDate(formatDateInput(selected));
          }}
        />
      ) : null}
      {picker === "time" ? (
        <DateTimePicker
          {...pickerProps}
          mode="time"
          value={parseTimeInput(time)}
          onChange={(_, selected) => {
            if (Platform.OS !== "ios") setPicker(null);
            if (selected) setTime(formatTimeInput(selected));
          }}
        />
      ) : null}
      <ErrorText>{error}</ErrorText>
    </Sheet>
  );
}

function PickerField({
  icon,
  value,
  placeholder,
  onPress,
  onClear,
  disabled,
}: {
  icon: "date" | "time";
  value: string;
  placeholder: string;
  onPress: () => void;
  onClear?: () => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  const Glyph = icon === "date" ? CalendarBlank : Clock;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.pickerField, { backgroundColor: colors.raised, borderColor: colors.line }, disabled && styles.disabled]}
    >
      <Glyph size={18} color={colors.muted} />
      <AppText variant="body" color={value ? colors.ink : colors.subtle} numberOfLines={1} style={styles.flex}>
        {value || placeholder}
      </AppText>
      {onClear ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Clear date" hitSlop={10} onPress={onClear}>
          <X size={16} color={colors.subtle} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontFamily: fonts.semibold },
  disabled: { opacity: 0.5 },
  footer: { flex: 1, gap: 4 },
  iconGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  iconTile: {
    width: hitTarget,
    height: hitTarget,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  iconTileSelected: { borderWidth: 1.5 },
  priorityRow: { flexDirection: "row", gap: 8 },
  priorityOption: {
    flex: 1,
    minHeight: hitTarget,
    borderRadius: radius.control,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  dateRow: { flexDirection: "row", gap: 10 },
  pickerField: {
    minHeight: 52,
    borderRadius: radius.control,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
});
