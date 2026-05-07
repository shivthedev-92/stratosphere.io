import { StatusBar } from "expo-status-bar";
import * as SecureStore from "expo-secure-store";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { api, type EmotionLabel, type GoalLogOut, type GoalOut, type UserOut } from "./src/api";
import { API_BASE_URL } from "./src/config";

const TOKEN_KEY = "stratosphere_access_token";
const EMOTION_OPTIONS: Array<{ label: string; value: EmotionLabel }> = [
  { label: "Happy", value: "happy" },
  { label: "Sad", value: "sad" },
  { label: "Excited", value: "excited" },
  { label: "Calm", value: "calm" },
  { label: "Anxious", value: "anxious" },
  { label: "Overwhelmed", value: "overwhelmed" },
  { label: "Hopeful", value: "hopeful" },
  { label: "Tired", value: "tired" },
  { label: "Unable to describe", value: "unable_to_describe" },
  { label: "Other", value: "other" },
];

function getDateKey(value: string | null) {
  const date = value ? new Date(value) : new Date();
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function getGoalDate(goal: GoalOut) {
  return goal.scheduled_for ?? goal.created_at;
}

function formatGoalDate(goal: GoalOut) {
  if (!goal.is_timed || !goal.scheduled_for) return "Moment-based";
  return new Date(goal.scheduled_for).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatLogDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getLogMeaning(log: GoalLogOut) {
  if (log.soulful === true) return "Meaningful";
  if (log.soulful === false) return "Not meaningful";
  return "Unsure";
}

function getEmotionLabel(value: EmotionLabel | null) {
  if (!value) return null;
  return EMOTION_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

export default function App() {
  const [booting, setBooting] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState<UserOut | null>(null);
  const [goals, setGoals] = useState<GoalOut[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [selectedGoal, setSelectedGoal] = useState<GoalOut | null>(null);
  const [goalLogs, setGoalLogs] = useState<GoalLogOut[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [reflection, setReflection] = useState("");
  const [completed, setCompleted] = useState(true);
  const [soulful, setSoulful] = useState<boolean | null>(true);
  const [taskFilter, setTaskFilter] = useState<"today" | "all">("today");
  const [emotionLabel, setEmotionLabel] = useState<EmotionLabel | null>(null);

  const todayGoals = useMemo(() => {
    const todayKey = getDateKey(null);
    return goals.filter((goal) => getDateKey(getGoalDate(goal)) === todayKey);
  }, [goals]);
  const visibleGoals = taskFilter === "today" ? todayGoals : goals;

  async function loadDashboard(nextToken: string) {
    setLoading(true);
    setError("");
    try {
      const [userData, goalData] = await Promise.all([api.me(nextToken), api.goals(nextToken)]);
      setUser(userData);
      setGoals(goalData);
      setToken(nextToken);
      await SecureStore.setItemAsync(TOKEN_KEY, nextToken);
    } catch (err) {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      setToken(null);
      setUser(null);
      setGoals([]);
      setSelectedGoal(null);
      setGoalLogs([]);
      setError(err instanceof Error ? err.message : "Could not load dashboard.");
    } finally {
      setLoading(false);
    }
  }

  async function checkBackend() {
    try {
      const response = await api.health();
      setBackendOnline(response.ok);
    } catch {
      setBackendOnline(false);
    }
  }

  useEffect(() => {
    async function restoreSession() {
      await checkBackend();
      const savedToken = await SecureStore.getItemAsync(TOKEN_KEY);
      if (savedToken) {
        await loadDashboard(savedToken);
      }
      setBooting(false);
    }

    restoreSession();
  }, []);

  async function handleLogin(e?: FormEvent) {
    e?.preventDefault();
    if (!email.trim() || !password) return;

    setLoading(true);
    setError("");
    try {
      const auth = await api.login(email.trim(), password);
      await loadDashboard(auth.access_token);
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    setToken(null);
    setUser(null);
    setGoals([]);
    setSelectedGoal(null);
    setGoalLogs([]);
    setPassword("");
    setError("");
  }

  async function handleRefresh() {
    if (!token) return;
    await loadDashboard(token);
  }

  async function openGoal(goal: GoalOut) {
    if (!token) return;
    setSelectedGoal(goal);
    setLogsLoading(true);
    setError("");
    try {
      const logs = await api.goalLogsForGoal(token, goal.id);
      setGoalLogs(logs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load journal entries.");
    } finally {
      setLogsLoading(false);
    }
  }

  async function handleAddReflection() {
    if (!token || !selectedGoal || !reflection.trim()) return;
    setLogsLoading(true);
    setError("");
    try {
      const log = await api.createGoalLog(token, selectedGoal.id, {
        completed,
        reflection: reflection.trim(),
        soulful,
        emotion_label: emotionLabel,
      });
      setGoalLogs((current) => [log, ...current]);
      setReflection("");
      setCompleted(true);
      setSoulful(true);
      setEmotionLabel(null);
      await loadDashboard(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save journal entry.");
    } finally {
      setLogsLoading(false);
    }
  }

  function closeGoal() {
    setSelectedGoal(null);
    setGoalLogs([]);
    setReflection("");
    setCompleted(true);
    setSoulful(true);
    setEmotionLabel(null);
    setError("");
  }

  if (booting) {
    return (
      <AppShell>
        <View style={styles.centered}>
          <ActivityIndicator color="#60a5fa" />
          <Text style={styles.mutedText}>Starting Stratosphere...</Text>
        </View>
      </AppShell>
    );
  }

  if (!token || !user) {
    return (
      <AppShell>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.eyebrow}>Phase 2</Text>
            <Text style={styles.title}>Stratosphere Mobile</Text>
            <Text style={styles.subtitle}>Sign in with your existing web account.</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.connectionRow}>
              <Text style={styles.cardLabel}>Backend</Text>
              <Text style={backendOnline ? styles.onlineText : styles.offlineText}>
                {backendOnline ? "Online" : "Offline"}
              </Text>
            </View>
            <Text style={styles.url}>{API_BASE_URL}</Text>
            <Pressable style={styles.secondaryButton} onPress={checkBackend}>
              <Text style={styles.secondaryButtonText}>Check backend</Text>
            </Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Login</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder="Email"
              placeholderTextColor="#737373"
              style={styles.input}
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="Password"
              placeholderTextColor="#737373"
              style={styles.input}
            />
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <Pressable
              disabled={loading || !email.trim() || !password}
              style={[styles.primaryButton, (loading || !email.trim() || !password) && styles.disabledButton]}
              onPress={() => handleLogin()}
            >
              <Text style={styles.primaryButtonText}>{loading ? "Signing in..." : "Sign in"}</Text>
            </Pressable>
            <Text style={styles.helperText}>Create accounts on the web app for now.</Text>
          </View>
        </ScrollView>
      </AppShell>
    );
  }

  if (selectedGoal) {
    const sortedLogs = [...goalLogs].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

    return (
      <AppShell>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.detailHeader}>
            <Pressable style={styles.backButton} onPress={closeGoal}>
              <Text style={styles.secondaryButtonText}>Back</Text>
            </Pressable>
            <Text style={styles.eyebrow}>Task journal</Text>
            <Text style={styles.title}>{selectedGoal.title}</Text>
            <View style={styles.detailMetaRow}>
              <Text style={styles.priorityPill}>{selectedGoal.priority}</Text>
              <Text style={styles.detailMetaText}>{formatGoalDate(selectedGoal)}</Text>
              <Text style={styles.detailMetaText}>
                {sortedLogs.length} {sortedLogs.length === 1 ? "entry" : "entries"}
              </Text>
            </View>
          </View>

          {selectedGoal.notes ? (
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Task context</Text>
              <Text style={styles.goalNotes}>{selectedGoal.notes}</Text>
            </View>
          ) : null}

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Add journal entry</Text>
            <View style={styles.choiceRow}>
              <Pressable
                style={[styles.choiceButton, completed && styles.choiceButtonActive]}
                onPress={() => {
                  setCompleted(true);
                  setSoulful(true);
                }}
              >
                <Text style={completed ? styles.choiceTextActive : styles.choiceText}>Done</Text>
              </Pressable>
              <Pressable
                style={[styles.choiceButton, !completed && styles.choiceButtonActive]}
                onPress={() => {
                  setCompleted(false);
                  setSoulful(false);
                }}
              >
                <Text style={!completed ? styles.choiceTextActive : styles.choiceText}>Not done</Text>
              </Pressable>
            </View>
            <TextInput
              value={reflection}
              onChangeText={setReflection}
              multiline
              placeholder="Add the latest detail, obstacle, decision, or reflection..."
              placeholderTextColor="#737373"
              style={styles.textArea}
            />
            <Text style={styles.fieldLabel}>How did this feel?</Text>
            <View style={styles.emotionGrid}>
              {EMOTION_OPTIONS.map((item) => (
                <Pressable
                  key={item.value}
                  style={[styles.emotionButton, emotionLabel === item.value && styles.emotionButtonActive]}
                  onPress={() =>
                    setEmotionLabel((current) => (current === item.value ? null : item.value))
                  }
                >
                  <Text
                    style={emotionLabel === item.value ? styles.emotionTextActive : styles.emotionText}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.fieldLabel}>Does this still feel meaningful?</Text>
            <View style={styles.choiceRow}>
              {[
                { label: "Yes", value: true },
                { label: "Unsure", value: null },
                { label: "No", value: false },
              ].map((item) => (
                <Pressable
                  key={item.label}
                  style={[styles.choiceButton, soulful === item.value && styles.choiceButtonActive]}
                  onPress={() => setSoulful(item.value)}
                >
                  <Text style={soulful === item.value ? styles.choiceTextActive : styles.choiceText}>
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <Pressable
              disabled={logsLoading || !reflection.trim()}
              style={[styles.primaryButton, (logsLoading || !reflection.trim()) && styles.disabledButton]}
              onPress={handleAddReflection}
            >
              <Text style={styles.primaryButtonText}>
                {logsLoading ? "Saving..." : "Add entry"}
              </Text>
            </Pressable>
          </View>

          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.cardTitle}>Journal timeline</Text>
                <Text style={styles.mutedText}>Latest entries first.</Text>
              </View>
              {logsLoading ? <ActivityIndicator color="#60a5fa" /> : null}
            </View>

            {sortedLogs.length === 0 ? (
              <Text style={styles.emptyText}>No journal entries yet.</Text>
            ) : (
              <View style={styles.timeline}>
                {sortedLogs.map((log) => (
                  <View key={log.id} style={styles.timelineItem}>
                    <View style={styles.timelineRail}>
                      <Text style={styles.timelineDot}>🔵</Text>
                      <View style={styles.timelineLine} />
                    </View>
                    <View style={styles.timelineCard}>
                      <View style={styles.timelineHeader}>
                        <Text style={styles.timelineBadge}>User log</Text>
                        <Text style={styles.goalMeta}>{formatLogDate(log.created_at)}</Text>
                      </View>
                      <View style={styles.logPillRow}>
                        <Text style={styles.logPill}>{log.completed ? "Completed" : "Not done"}</Text>
                        <Text style={styles.logPill}>{getLogMeaning(log)}</Text>
                        {log.emotion_label ? (
                          <Text style={styles.emotionPill}>{getEmotionLabel(log.emotion_label)}</Text>
                        ) : null}
                      </View>
                      <Text style={styles.logText}>{log.reflection}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.dashboardHeader}>
          <View>
            <Text style={styles.eyebrow}>Today</Text>
            <Text style={styles.title}>Hello, {user.name}</Text>
            <Text style={styles.subtitle}>{user.email}</Text>
          </View>
          <Pressable style={styles.signOutButton} onPress={handleSignOut}>
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{todayGoals.length}</Text>
            <Text style={styles.statLabel}>Today</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{goals.length}</Text>
            <Text style={styles.statLabel}>All tasks</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.cardTitle}>
                {taskFilter === "today" ? "Today's Action Items" : "All Action Items"}
              </Text>
              <Text style={styles.mutedText}>Pulled from the FastAPI backend.</Text>
            </View>
            <Pressable style={styles.secondaryButtonCompact} onPress={handleRefresh}>
              <Text style={styles.secondaryButtonText}>Refresh</Text>
            </Pressable>
          </View>

          <View style={styles.filterRow}>
            <Pressable
              style={[styles.filterButton, taskFilter === "today" && styles.filterButtonActive]}
              onPress={() => setTaskFilter("today")}
            >
              <Text style={taskFilter === "today" ? styles.filterTextActive : styles.filterText}>
                Today
              </Text>
            </Pressable>
            <Pressable
              style={[styles.filterButton, taskFilter === "all" && styles.filterButtonActive]}
              onPress={() => setTaskFilter("all")}
            >
              <Text style={taskFilter === "all" ? styles.filterTextActive : styles.filterText}>
                All ({goals.length})
              </Text>
            </Pressable>
          </View>

          {loading ? <ActivityIndicator color="#60a5fa" style={styles.inlineLoader} /> : null}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {visibleGoals.length === 0 ? (
            <Text style={styles.emptyText}>
              {taskFilter === "today" ? "No action items for today." : "No action items yet."}
            </Text>
          ) : (
            visibleGoals.map((goal) => (
              <View key={goal.id} style={styles.goalCard}>
                <View style={styles.goalHeader}>
                  <Text style={styles.goalTitle}>{goal.title}</Text>
                  <Text style={styles.priorityPill}>{goal.priority}</Text>
                </View>
                {goal.notes ? <Text style={styles.goalNotes}>{goal.notes}</Text> : null}
                <View style={styles.goalFooter}>
                  <Text style={styles.goalMeta}>{formatGoalDate(goal)}</Text>
                  <Pressable style={styles.reflectButton} onPress={() => openGoal(goal)}>
                    <Text style={styles.reflectButtonText}>Reflect</Text>
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </AppShell>
  );
}

function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.screen}>
        <StatusBar style="light" />
        {children}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#0a0a0a",
  },
  scrollContent: {
    gap: 18,
    padding: 24,
    paddingBottom: 40,
  },
  centered: {
    alignItems: "center",
    flex: 1,
    gap: 14,
    justifyContent: "center",
    padding: 24,
  },
  header: {
    marginBottom: 4,
  },
  dashboardHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 16,
    justifyContent: "space-between",
  },
  detailHeader: {
    gap: 10,
  },
  detailMetaRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  detailMetaText: {
    borderColor: "#2f2f2f",
    borderRadius: 7,
    borderWidth: 1,
    color: "#d4d4d4",
    fontSize: 12,
    fontWeight: "700",
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  eyebrow: {
    color: "#60a5fa",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  title: {
    color: "#ffffff",
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: 0,
  },
  subtitle: {
    color: "#a3a3a3",
    fontSize: 16,
    lineHeight: 24,
    marginTop: 10,
  },
  card: {
    backgroundColor: "#171717",
    borderColor: "#2f2f2f",
    borderRadius: 14,
    borderWidth: 1,
    padding: 18,
  },
  cardLabel: {
    color: "#d4d4d4",
    fontSize: 14,
    fontWeight: "700",
  },
  cardTitle: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "800",
  },
  connectionRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  url: {
    color: "#737373",
    fontSize: 13,
    marginTop: 8,
  },
  onlineText: {
    color: "#10b981",
    fontSize: 13,
    fontWeight: "800",
  },
  offlineText: {
    color: "#ef4444",
    fontSize: 13,
    fontWeight: "800",
  },
  input: {
    backgroundColor: "#262626",
    borderColor: "#404040",
    borderRadius: 10,
    borderWidth: 1,
    color: "#ffffff",
    fontSize: 16,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#2563eb",
    borderRadius: 10,
    marginTop: 16,
    paddingVertical: 13,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },
  secondaryButton: {
    alignItems: "center",
    borderColor: "#404040",
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 16,
    paddingVertical: 11,
  },
  secondaryButtonCompact: {
    borderColor: "#404040",
    borderRadius: 9,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  secondaryButtonText: {
    color: "#d4d4d4",
    fontSize: 13,
    fontWeight: "800",
  },
  backButton: {
    alignSelf: "flex-start",
    borderColor: "#404040",
    borderRadius: 9,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  disabledButton: {
    opacity: 0.45,
  },
  signOutButton: {
    borderColor: "#404040",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  signOutText: {
    color: "#d4d4d4",
    fontSize: 13,
    fontWeight: "800",
  },
  helperText: {
    color: "#737373",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 12,
  },
  mutedText: {
    color: "#a3a3a3",
    fontSize: 14,
    lineHeight: 20,
  },
  errorText: {
    color: "#fca5a5",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 12,
  },
  fieldLabel: {
    color: "#d4d4d4",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 16,
  },
  choiceRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },
  choiceButton: {
    alignItems: "center",
    borderColor: "#404040",
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 11,
  },
  choiceButtonActive: {
    backgroundColor: "#2563eb",
    borderColor: "#60a5fa",
  },
  choiceText: {
    color: "#d4d4d4",
    fontSize: 13,
    fontWeight: "800",
  },
  choiceTextActive: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
  },
  textArea: {
    backgroundColor: "#262626",
    borderColor: "#404040",
    borderRadius: 10,
    borderWidth: 1,
    color: "#ffffff",
    fontSize: 15,
    lineHeight: 21,
    marginTop: 14,
    minHeight: 130,
    paddingHorizontal: 14,
    paddingVertical: 12,
    textAlignVertical: "top",
  },
  emotionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  emotionButton: {
    borderColor: "#404040",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  emotionButtonActive: {
    backgroundColor: "#075985",
    borderColor: "#38bdf8",
  },
  emotionText: {
    color: "#d4d4d4",
    fontSize: 12,
    fontWeight: "800",
  },
  emotionTextActive: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
  },
  statCard: {
    backgroundColor: "#171717",
    borderColor: "#2f2f2f",
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    padding: 16,
  },
  statValue: {
    color: "#ffffff",
    fontSize: 30,
    fontWeight: "900",
  },
  statLabel: {
    color: "#a3a3a3",
    fontSize: 13,
    marginTop: 4,
  },
  sectionHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    marginBottom: 16,
  },
  inlineLoader: {
    marginVertical: 16,
  },
  filterRow: {
    backgroundColor: "#0f0f0f",
    borderColor: "#2f2f2f",
    borderRadius: 11,
    borderWidth: 1,
    flexDirection: "row",
    gap: 4,
    marginBottom: 8,
    padding: 4,
  },
  filterButton: {
    alignItems: "center",
    borderRadius: 8,
    flex: 1,
    paddingVertical: 9,
  },
  filterButtonActive: {
    backgroundColor: "#2563eb",
  },
  filterText: {
    color: "#a3a3a3",
    fontSize: 13,
    fontWeight: "800",
  },
  filterTextActive: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
  },
  emptyText: {
    color: "#737373",
    fontSize: 15,
    lineHeight: 22,
    paddingVertical: 14,
  },
  goalCard: {
    borderTopColor: "#2f2f2f",
    borderTopWidth: 1,
    paddingVertical: 15,
  },
  goalHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  goalTitle: {
    color: "#ffffff",
    flex: 1,
    fontSize: 17,
    fontWeight: "800",
    lineHeight: 23,
  },
  priorityPill: {
    borderColor: "#0369a1",
    borderRadius: 7,
    borderWidth: 1,
    color: "#bae6fd",
    fontSize: 12,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 3,
    textTransform: "capitalize",
  },
  goalNotes: {
    color: "#a3a3a3",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  goalMeta: {
    color: "#737373",
    fontSize: 13,
  },
  goalFooter: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    marginTop: 12,
  },
  reflectButton: {
    backgroundColor: "#2563eb",
    borderRadius: 9,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  reflectButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
  },
  timeline: {
    gap: 0,
  },
  timelineItem: {
    flexDirection: "row",
    gap: 12,
  },
  timelineRail: {
    alignItems: "center",
    width: 24,
  },
  timelineDot: {
    fontSize: 14,
    lineHeight: 22,
  },
  timelineLine: {
    backgroundColor: "#075985",
    flex: 1,
    minHeight: 18,
    width: 1,
  },
  timelineCard: {
    backgroundColor: "#0f0f0f",
    borderColor: "#2f2f2f",
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    marginBottom: 14,
    padding: 14,
  },
  timelineHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
  },
  timelineBadge: {
    borderColor: "#0369a1",
    borderRadius: 7,
    borderWidth: 1,
    color: "#bae6fd",
    fontSize: 12,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  logPillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  logPill: {
    borderColor: "#404040",
    borderRadius: 7,
    borderWidth: 1,
    color: "#d4d4d4",
    fontSize: 12,
    fontWeight: "700",
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  emotionPill: {
    borderColor: "#38bdf8",
    borderRadius: 7,
    borderWidth: 1,
    color: "#bae6fd",
    fontSize: 12,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  logText: {
    color: "#e5e5e5",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 12,
  },
});
