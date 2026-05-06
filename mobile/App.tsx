import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";

const API_BASE_URL = "http://192.168.0.104:8001";

type HealthState = "checking" | "online" | "offline";

export default function App() {
  const [healthState, setHealthState] = useState<HealthState>("checking");
  const [message, setMessage] = useState("Checking backend connection...");

  async function checkBackend() {
    setHealthState("checking");
    setMessage("Checking backend connection...");

    try {
      const response = await fetch(`${API_BASE_URL}/health`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const body = (await response.json()) as { ok?: boolean };
      if (!body.ok) {
        throw new Error("Unexpected health response");
      }
      setHealthState("online");
      setMessage("Connected to the productivity backend.");
    } catch (error) {
      setHealthState("offline");
      setMessage(error instanceof Error ? error.message : "Could not reach backend.");
    }
  }

  useEffect(() => {
    checkBackend();
  }, []);

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Phase 2</Text>
          <Text style={styles.title}>Stratosphere Mobile</Text>
          <Text style={styles.subtitle}>
            First iPhone check: Expo app connected to the same FastAPI backend.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Backend</Text>
          <Text style={styles.url}>{API_BASE_URL}</Text>

          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                healthState === "online" && styles.statusDotOnline,
                healthState === "offline" && styles.statusDotOffline,
              ]}
            />
            <Text style={styles.statusText}>
              {healthState === "checking" ? "Checking" : healthState}
            </Text>
          </View>

          <Text style={styles.message}>{message}</Text>

          {healthState === "checking" ? (
            <ActivityIndicator color="#60a5fa" style={styles.loader} />
          ) : (
            <Pressable style={styles.button} onPress={checkBackend}>
              <Text style={styles.buttonText}>Check again</Text>
            </Pressable>
          )}
        </View>

        <Text style={styles.footer}>
          Next mobile slice: login, action items, then task journal timeline.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#0a0a0a",
  },
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  header: {
    marginBottom: 28,
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
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: 0,
  },
  subtitle: {
    color: "#a3a3a3",
    fontSize: 16,
    lineHeight: 24,
    marginTop: 12,
  },
  card: {
    backgroundColor: "#171717",
    borderColor: "#2f2f2f",
    borderRadius: 14,
    borderWidth: 1,
    padding: 20,
  },
  cardLabel: {
    color: "#d4d4d4",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
  },
  url: {
    color: "#737373",
    fontSize: 13,
    marginBottom: 18,
  },
  statusRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  statusDot: {
    backgroundColor: "#f59e0b",
    borderRadius: 6,
    height: 12,
    width: 12,
  },
  statusDotOnline: {
    backgroundColor: "#10b981",
  },
  statusDotOffline: {
    backgroundColor: "#ef4444",
  },
  statusText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  message: {
    color: "#a3a3a3",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 12,
  },
  loader: {
    marginTop: 20,
  },
  button: {
    alignItems: "center",
    backgroundColor: "#2563eb",
    borderRadius: 10,
    marginTop: 20,
    paddingVertical: 12,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  footer: {
    color: "#737373",
    fontSize: 13,
    lineHeight: 20,
    marginTop: 24,
  },
});
