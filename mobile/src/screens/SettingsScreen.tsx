import DateTimePicker from "@react-native-community/datetimepicker";
import { useFocusEffect } from "@react-navigation/native";
import { CaretRight, Check, EnvelopeSimple, Moon, ShieldCheck, Sun, TelegramLogo, DeviceMobile, type Icon } from "phosphor-react-native";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Alert, Linking, Platform, Pressable, StyleSheet, Switch, View } from "react-native";
import { api, type TelegramStatusOut } from "../api";
import { PushedHeader, Screen } from "../components/common";
import { AppText, Button, Card, ErrorText, Field, FieldLabel, Segmented, Sheet, UserAvatar } from "../components/ui";
import { WEB_URL } from "../config";
import {
  COUNTRY_CODE_OPTIONS,
  formatDateInput,
  formatDobDisplay,
  formatPhoneDisplay,
  formatPhoneForStorage,
  parseDateInput,
  splitPhoneNumber,
} from "../lib/format";
import type { RootScreenProps } from "../navigation";
import { useAppState } from "../state/AppState";
import { palettes, radius, useTheme, type ThemePreference } from "../theme";

const AVATAR_GROUPS = [
  { label: "Crew", ids: ["crew-indigo", "crew-teal", "crew-sky", "crew-amber", "crew-rose", "crew-midnight"] },
  { label: "Sky", ids: ["sky-ringed-planet", "sky-crescent", "sky-dawn", "sky-comet", "sky-binary", "sky-earthrise"] },
];

/** Screen 13: Settings (pushed). */
export function SettingsScreen({ navigation }: RootScreenProps<"Settings">) {
  const { colors, preference, setPreference } = useTheme();
  const { token, user, saveProfile, signOut, loading } = useAppState();
  const [sheet, setSheet] = useState<"profile" | "avatar" | "contact" | null>(null);
  const [telegram, setTelegram] = useState<TelegramStatusOut | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      api.telegramStatus(token).then(setTelegram).catch(() => setTelegram(null));
    }, [token]),
  );

  if (!user) return null;
  const current = user;

  async function toggleNotifications(enabled: boolean) {
    await saveProfile({
      name: current.name,
      phone_number: current.phone_number,
      date_of_birth: current.date_of_birth,
      in_app_notifications_enabled: enabled,
    });
  }

  async function handleTelegram() {
    if (!token || !telegram?.available) return;
    if (telegram.linked) {
      Alert.alert("Telegram reminders", "Stop sending reminders to Telegram?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Disconnect",
          style: "destructive",
          onPress: async () => {
            await api.telegramUnlink(token);
            setTelegram(await api.telegramStatus(token));
          },
        },
      ]);
      return;
    }
    try {
      const link = await api.telegramLink(token);
      await Linking.openURL(link.url);
    } catch {
      Alert.alert("Telegram reminders", "Could not open Telegram. Try again from the web app.");
    }
  }

  const telegramValue = !telegram ? "" : !telegram.available ? "Unavailable" : telegram.linked ? "Connected" : "Connect";

  return (
    <>
      <Screen header={<PushedHeader backLabel="Today" onBack={navigation.goBack} />}>
        <AppText variant="eyebrow">Account</AppText>
        <AppText variant="pushedTitle" style={styles.title}>
          Settings
        </AppText>

        <Card style={styles.profile}>
          <Pressable accessibilityRole="button" accessibilityLabel="Change avatar" onPress={() => setSheet("avatar")}>
            <UserAvatar name={current.name} avatarId={current.avatar_id} size={56} />
          </Pressable>
          <View style={styles.flex}>
            <AppText variant="cardTitle" numberOfLines={1}>
              {current.name}
            </AppText>
            <AppText variant="meta" numberOfLines={1}>
              {current.email}
            </AppText>
          </View>
          <Button label="Edit" variant="secondary" compact onPress={() => setSheet("profile")} />
        </Card>

        <Group>
          <Row label="Phone" value={formatPhoneDisplay(current.phone_number)} />
          <Row label="Date of birth" value={formatDobDisplay(current.date_of_birth)} />
          <Row
            label="In-app notifications"
            last
            right={
              <Switch
                value={current.in_app_notifications_enabled}
                disabled={loading}
                onValueChange={toggleNotifications}
                trackColor={{ true: colors.accent, false: colors.line }}
                accessibilityLabel="In-app notifications"
              />
            }
          />
        </Group>

        <AppText variant="eyebrow" style={styles.groupLabel}>
          Appearance
        </AppText>
        <View style={styles.swatches}>
          {(
            [
              { value: "night", label: "Night", icon: Moon },
              { value: "dawn", label: "Dawn", icon: Sun },
              { value: "system", label: "System", icon: DeviceMobile },
            ] as Array<{ value: ThemePreference; label: string; icon: Icon }>
          ).map((option) => {
            const selected = preference === option.value;
            const preview = option.value === "system" ? null : palettes[option.value];
            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => setPreference(option.value)}
                style={[
                  styles.swatch,
                  { borderColor: selected ? colors.accent : colors.line, backgroundColor: colors.raised },
                  selected && styles.swatchSelected,
                ]}
              >
                <View style={styles.swatchPreview}>
                  {preview ? (
                    <View style={[styles.swatchFill, { backgroundColor: preview.bg }]}>
                      <View style={[styles.swatchBar, { backgroundColor: preview.accent }]} />
                    </View>
                  ) : (
                    <View style={styles.swatchSplit}>
                      <View style={[styles.flex, { backgroundColor: palettes.night.bg }]} />
                      <View style={[styles.flex, { backgroundColor: palettes.dawn.bg }]} />
                    </View>
                  )}
                </View>
                <View style={styles.swatchLabel}>
                  <option.icon size={16} color={selected ? colors.accentText : colors.muted} />
                  <AppText variant="label" color={selected ? colors.accentText : colors.ink}>
                    {option.label}
                  </AppText>
                </View>
              </Pressable>
            );
          })}
        </View>

        <Group>
          <Row label="Telegram reminders" icon={TelegramLogo} value={telegramValue} onPress={telegram?.available ? handleTelegram : undefined} />
          <Row label="Contact us" icon={EnvelopeSimple} onPress={() => setSheet("contact")} last={!WEB_URL} />
          {WEB_URL ? (
            <Row label="Privacy" icon={ShieldCheck} onPress={() => Linking.openURL(`${WEB_URL}/privacy`)} last />
          ) : null}
        </Group>

        <Button label="Sign out" variant="destructive" onPress={signOut} style={styles.signOut} />
      </Screen>

      <EditProfileSheet visible={sheet === "profile"} onClose={() => setSheet(null)} />
      <AvatarSheet visible={sheet === "avatar"} onClose={() => setSheet(null)} />
      <ContactSheet visible={sheet === "contact"} onClose={() => setSheet(null)} />
    </>
  );
}

function Group({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return <View style={[styles.group, { backgroundColor: colors.raised, borderColor: colors.line }]}>{children}</View>;
}

function Row({
  label,
  value,
  icon: Glyph,
  right,
  onPress,
  last,
}: {
  label: string;
  value?: string;
  icon?: Icon;
  right?: ReactNode;
  onPress?: () => void;
  last?: boolean;
}) {
  const { colors } = useTheme();
  const content = (
    <>
      {Glyph ? <Glyph size={20} color={colors.muted} /> : null}
      <AppText variant="body" style={styles.flex}>
        {label}
      </AppText>
      {value ? <AppText variant="meta">{value}</AppText> : null}
      {right}
      {onPress ? <CaretRight size={16} color={colors.subtle} /> : null}
    </>
  );
  const style = [styles.row, !last && { borderBottomWidth: 1, borderBottomColor: colors.line }];
  return onPress ? (
    <Pressable accessibilityRole="button" onPress={onPress} style={style}>
      {content}
    </Pressable>
  ) : (
    <View style={style}>{content}</View>
  );
}

function EditProfileSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors, name: themeName } = useTheme();
  const { user, saveProfile, loading, error, setError } = useAppState();
  const [name, setName] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [notifications, setNotifications] = useState(true);
  const [showDob, setShowDob] = useState(false);

  useEffect(() => {
    if (!visible || !user) return;
    const parsed = splitPhoneNumber(user.phone_number);
    setError("");
    setName(user.name);
    setCountryCode(parsed.countryCode);
    setPhone(parsed.localPhone);
    setDob(user.date_of_birth ?? "");
    setNotifications(user.in_app_notifications_enabled);
    setShowDob(false);
  }, [visible, user, setError]);

  async function save() {
    const saved = await saveProfile({
      name: name.trim(),
      phone_number: formatPhoneForStorage(countryCode, phone),
      date_of_birth: dob || null,
      in_app_notifications_enabled: notifications,
    });
    if (saved) onClose();
  }

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Edit profile"
      footer={<Button label="Save profile" onPress={save} loading={loading} disabled={!name.trim()} style={styles.flex} />}
    >
      <FieldLabel>Name</FieldLabel>
      <Field value={name} onChangeText={setName} placeholder="Name" autoComplete="name" />
      <FieldLabel>Country code</FieldLabel>
      <Segmented
        options={COUNTRY_CODE_OPTIONS.map((option) => ({ label: option.value, value: option.value }))}
        value={countryCode}
        onChange={setCountryCode}
      />
      <FieldLabel>Phone</FieldLabel>
      <Field
        value={phone}
        onChangeText={(value) => setPhone(value.replace(/[^\d]/g, ""))}
        keyboardType="phone-pad"
        maxLength={15}
        placeholder="Local phone number"
      />
      <FieldLabel>Date of birth</FieldLabel>
      <View style={styles.dobRow}>
        <Pressable
          accessibilityRole="button"
          onPress={() => setShowDob((current) => !current)}
          style={[styles.dobField, { backgroundColor: colors.raised, borderColor: colors.line }]}
        >
          <AppText variant="body" color={dob ? colors.ink : colors.subtle}>
            {dob ? formatDobDisplay(dob) : "Select date"}
          </AppText>
        </Pressable>
        {dob ? <Button label="Clear" variant="secondary" compact onPress={() => setDob("")} /> : null}
      </View>
      {showDob ? (
        <DateTimePicker
          value={parseDateInput(dob, new Date(1995, 0, 1))}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          maximumDate={new Date()}
          themeVariant={themeName === "night" ? "dark" : "light"}
          textColor={colors.ink}
          onChange={(_, selected) => {
            if (Platform.OS !== "ios") setShowDob(false);
            if (selected) setDob(formatDateInput(selected));
          }}
        />
      ) : null}
      <View style={[styles.switchRow, { backgroundColor: colors.raised, borderColor: colors.line }]}>
        <AppText variant="label" style={styles.flex}>
          In-app notifications
        </AppText>
        <Switch value={notifications} onValueChange={setNotifications} trackColor={{ true: colors.accent, false: colors.line }} />
      </View>
      <ErrorText>{error}</ErrorText>
    </Sheet>
  );
}

function AvatarSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const { user, updateAvatar } = useAppState();
  if (!user) return null;
  return (
    <Sheet visible={visible} onClose={onClose} title="Profile avatar" subtitle="Pick a crew helmet or a piece of sky.">
      {AVATAR_GROUPS.map((group) => (
        <View key={group.label}>
          <AppText variant="eyebrow" style={styles.groupLabel}>
            {group.label}
          </AppText>
          <View style={styles.avatarGrid} accessibilityRole="radiogroup">
            {group.ids.map((id) => {
              const selected = user.avatar_id === id;
              return (
                <Pressable
                  key={id}
                  accessibilityRole="radio"
                  accessibilityLabel={id.replace(/-/g, " ")}
                  accessibilityState={{ selected }}
                  onPress={() => updateAvatar(id)}
                  style={[styles.avatarOption, selected && { borderColor: colors.accent }]}
                >
                  <UserAvatar name={user.name} avatarId={id} size={76} />
                  {selected ? (
                    <View style={[styles.avatarCheck, { backgroundColor: colors.accent }]}>
                      <Check size={13} color="#FFFFFF" weight="bold" />
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
      {user.avatar_id ? (
        <Button label="Use my initials instead" variant="secondary" onPress={() => updateAvatar(null)} style={styles.initialsButton} />
      ) : null}
    </Sheet>
  );
}

function ContactSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { createSupportTicket } = useAppState();
  const { colors } = useTheme();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function send() {
    setSaving(true);
    setStatus("");
    setError("");
    try {
      await createSupportTicket(subject, message);
      setSubject("");
      setMessage("");
      setStatus("Thanks. Your support ticket has been received.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send your message.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Contact us"
      subtitle="Raise a support ticket for issues, feedback, or beta testing notes."
      footer={
        <Button
          label="Raise ticket"
          onPress={send}
          loading={saving}
          disabled={!subject.trim() || message.trim().length < 10}
          style={styles.flex}
        />
      }
    >
      <FieldLabel>Subject</FieldLabel>
      <Field value={subject} onChangeText={setSubject} placeholder="Subject" maxLength={180} />
      <FieldLabel>Message</FieldLabel>
      <Field
        value={message}
        onChangeText={setMessage}
        multiline
        maxLength={4000}
        placeholder="Share the issue, device, and what you expected to happen."
      />
      <ErrorText>{error}</ErrorText>
      {status ? (
        <AppText variant="meta" color={colors.low} style={styles.status}>
          {status}
        </AppText>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  title: { marginTop: 4, marginBottom: 16 },
  profile: { flexDirection: "row", alignItems: "center", gap: 14 },
  group: { borderRadius: radius.card, borderWidth: 1, marginTop: 16, overflow: "hidden" },
  groupLabel: { marginTop: 24, marginBottom: 10 },
  row: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16 },
  swatches: { flexDirection: "row", gap: 10 },
  swatch: { flex: 1, borderRadius: radius.card, borderWidth: 1, padding: 8, gap: 8 },
  swatchSelected: { borderWidth: 1.5 },
  swatchPreview: { height: 56, borderRadius: 12, overflow: "hidden" },
  swatchFill: { flex: 1, justifyContent: "flex-end", padding: 8 },
  swatchBar: { height: 6, width: "60%", borderRadius: 3 },
  swatchSplit: { flex: 1, flexDirection: "row" },
  swatchLabel: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingBottom: 4 },
  signOut: { marginTop: 24 },
  dobRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  dobField: { flex: 1, minHeight: 52, borderRadius: radius.control, borderWidth: 1, paddingHorizontal: 16, justifyContent: "center" },
  switchRow: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.control,
    borderWidth: 1,
    padding: 14,
  },
  avatarGrid: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  avatarOption: { borderRadius: 44, borderWidth: 2, borderColor: "transparent", padding: 3 },
  avatarCheck: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  initialsButton: { marginTop: 24 },
  status: { marginTop: 10 },
});
