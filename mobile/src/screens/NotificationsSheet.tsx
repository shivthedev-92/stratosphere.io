import { Pressable, StyleSheet, View } from "react-native";
import type { NotificationOut } from "../api";
import { AppText, Button, EmptyText, Sheet } from "../components/ui";
import { formatRelativeDate } from "../lib/format";
import { useAppState } from "../state/AppState";
import { radius, useTheme } from "../theme";

/** Screen 12: Notifications. */
export function NotificationsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const { notifications, markAllNotificationsRead, acknowledgeNotification } = useAppState();
  const recent = notifications.slice(0, 30);
  const unread = recent.filter((item) => !item.read_at);
  const earlier = recent.filter((item) => item.read_at);

  function renderItem(item: NotificationOut, dimmed: boolean) {
    const needsCheckIn = item.category === "reminder" && !item.acknowledged_at;
    return (
      <View
        key={item.id}
        style={[styles.item, { backgroundColor: colors.raised, borderColor: colors.line }, dimmed && styles.dimmed]}
      >
        <View style={styles.itemHeader}>
          {!item.read_at ? <View style={[styles.dot, { backgroundColor: colors.accent }]} /> : null}
          <AppText variant="label" style={styles.flex}>
            {item.title}
          </AppText>
          <AppText variant="meta">{formatRelativeDate(item.created_at)}</AppText>
        </View>
        <AppText variant="body" color={colors.muted}>
          {item.body}
        </AppText>
        {needsCheckIn ? (
          <View style={styles.actions}>
            <Button label="Yes" compact onPress={() => acknowledgeNotification(item)} style={styles.flex} />
            <Button label="Not yet" compact variant="secondary" onPress={() => acknowledgeNotification(item)} style={styles.flex} />
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Notifications"
      headerRight={
        unread.length > 0 ? (
          <Pressable accessibilityRole="button" onPress={markAllNotificationsRead} hitSlop={8} style={styles.readAll}>
            <AppText variant="label" color={colors.accentText}>
              Read all
            </AppText>
          </Pressable>
        ) : null
      }
    >
      {recent.length === 0 ? <EmptyText>No notifications yet.</EmptyText> : null}
      {unread.map((item) => renderItem(item, false))}
      {earlier.length > 0 ? (
        <AppText variant="eyebrow" style={styles.group}>
          Earlier
        </AppText>
      ) : null}
      {earlier.map((item) => renderItem(item, true))}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  readAll: { minHeight: 36, justifyContent: "center" },
  item: { borderRadius: radius.card, borderWidth: 1, padding: 14, marginBottom: 10, gap: 6 },
  dimmed: { opacity: 0.7 },
  itemHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  actions: { flexDirection: "row", gap: 10, marginTop: 6 },
  group: { marginTop: 12, marginBottom: 10 },
});
