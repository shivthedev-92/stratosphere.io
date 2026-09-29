import { LinearGradient } from "expo-linear-gradient";
import { Eye, EyeSlash } from "phosphor-react-native";
import { useState } from "react";
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, Ellipse, RadialGradient, Rect, Stop } from "react-native-svg";
import { StrataMark } from "../components/common";
import { AppText, AsterAvatar, Button, ErrorText, Field } from "../components/ui";
import { API_BASE_URL, WEB_URL } from "../config";
import { useAppState } from "../state/AppState";
import { fonts, useTheme } from "../theme";

/** The curved horizon with its atmosphere glow, anchored to the bottom of the screen. */
function EarthLimb({ height = 240 }: { height?: number }) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  return (
    <Svg width={width} height={height} style={styles.limb} pointerEvents="none">
      <Defs>
        <RadialGradient id="atmosphere" cx="50%" cy="100%" rx="75%" ry="85%">
          <Stop offset="0" stopColor={colors.glow} stopOpacity={0.55} />
          <Stop offset="1" stopColor={colors.glow} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width={width} height={height} fill="url(#atmosphere)" />
      <Ellipse
        cx={width / 2}
        cy={height + width * 0.85 - height * 0.4}
        rx={width * 1.15}
        ry={width * 0.85}
        fill={colors.bg}
        stroke={colors.glow}
        strokeWidth={2}
        strokeOpacity={0.9}
      />
    </Svg>
  );
}

/** Screen 1: Launch. */
export function LaunchScreen() {
  const { colors } = useTheme();
  return (
    <LinearGradient colors={colors.gradient} style={styles.launch}>
      <View style={styles.launchContent}>
        <StrataMark size={96} color={colors.accentText} />
        <AppText variant="title" style={styles.brand}>
          Stratosphere
        </AppText>
        <AppText variant="journal" color={colors.muted} style={styles.tagline}>
          your habits in your control
        </AppText>
      </View>
      <EarthLimb />
    </LinearGradient>
  );
}

/** Screen 2: Sign in. */
export function SignInScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { login, loading, error, backendOnline, checkBackend } = useAppState();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg }]}>
      <LinearGradient colors={[colors.gradient[0], colors.bg]} style={styles.sky}>
        <EarthLimb height={200} />
      </LinearGradient>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={[styles.signIn, { paddingTop: insets.top + 72, paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.center}>
            <AsterAvatar size={96} />
            <AppText variant="title" style={styles.welcome}>
              Welcome back
            </AppText>
            <AppText variant="body" color={colors.muted}>
              Sign in to pick up where you left off.
            </AppText>
          </View>

          <View style={styles.form}>
            <Field
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              placeholder="Email"
              accessibilityLabel="Email"
            />
            <View>
              <Field
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoComplete="password"
                textContentType="password"
                placeholder="Password"
                accessibilityLabel="Password"
                style={styles.passwordField}
                onSubmitEditing={() => login(email, password)}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                onPress={() => setShowPassword((current) => !current)}
                hitSlop={8}
                style={styles.eye}
              >
                {showPassword ? <EyeSlash size={20} color={colors.muted} /> : <Eye size={20} color={colors.muted} />}
              </Pressable>
            </View>
            {WEB_URL ? (
              <Pressable
                accessibilityRole="link"
                onPress={() => Linking.openURL(`${WEB_URL}/forgot-password`)}
                style={styles.forgot}
              >
                <AppText variant="label" color={colors.accentText}>
                  Forgot password?
                </AppText>
              </Pressable>
            ) : null}
            <ErrorText>{error}</ErrorText>
            <Button
              label="Sign in"
              onPress={() => login(email, password)}
              loading={loading}
              disabled={!email.trim() || !password}
              style={styles.submit}
            />
            {WEB_URL ? (
              <Pressable accessibilityRole="link" onPress={() => Linking.openURL(`${WEB_URL}/signup`)} style={styles.signup}>
                <AppText variant="body" color={colors.muted}>
                  New to Stratosphere?{" "}
                  <AppText variant="body" color={colors.accentText} style={styles.bold}>
                    Create an account
                  </AppText>
                </AppText>
              </Pressable>
            ) : (
              <AppText variant="meta" style={styles.signup}>
                Create accounts on the web app for now.
              </AppText>
            )}
          </View>

          {__DEV__ ? (
            <View style={[styles.dev, { borderColor: colors.line }]}>
              <AppText variant="eyebrow">Phase 2 · Dev only</AppText>
              <AppText variant="meta">
                Backend {backendOnline ? "online" : backendOnline === false ? "offline" : "unchecked"} · {API_BASE_URL}
              </AppText>
              <Button label="Check backend" variant="secondary" compact onPress={checkBackend} />
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontFamily: fonts.semibold },
  limb: { position: "absolute", bottom: 0, left: 0 },
  launch: { flex: 1 },
  launchContent: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingBottom: 120 },
  brand: { fontSize: 32, marginTop: 8 },
  tagline: { fontSize: 19 },
  sky: { position: "absolute", top: 0, left: 0, right: 0, height: 360 },
  signIn: { paddingHorizontal: 20 },
  center: { alignItems: "center", gap: 6 },
  welcome: { marginTop: 16 },
  form: { marginTop: 32, gap: 12 },
  passwordField: { paddingRight: 52 },
  eye: { position: "absolute", right: 16, top: 16 },
  forgot: { alignSelf: "flex-end", minHeight: 32, justifyContent: "center" },
  submit: { marginTop: 4 },
  signup: { alignSelf: "center", marginTop: 12, textAlign: "center" },
  dev: { marginTop: 32, borderTopWidth: 1, paddingTop: 16, gap: 8 },
});
