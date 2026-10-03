// Per-weight imports so only these four font files are bundled.
import { InstrumentSans_400Regular } from "@expo-google-fonts/instrument-sans/400Regular";
import { InstrumentSans_500Medium } from "@expo-google-fonts/instrument-sans/500Medium";
import { InstrumentSans_600SemiBold } from "@expo-google-fonts/instrument-sans/600SemiBold";
import { Newsreader_400Regular_Italic } from "@expo-google-fonts/newsreader/400Regular_Italic";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { DarkTheme, DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { BlurView } from "expo-blur";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import { CalendarBlank, ChartBar, ChatCircleDots, SunHorizon, type Icon } from "phosphor-react-native";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { RootStackParamList, TabParamList } from "./src/navigation";
import { AsterScreen } from "./src/screens/AsterScreen";
import { LaunchScreen, SignInScreen } from "./src/screens/AuthScreens";
import { CalendarDayScreen } from "./src/screens/CalendarDayScreen";
import { CalendarScreen } from "./src/screens/CalendarScreen";
import { ProgressScreen } from "./src/screens/ProgressScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { TaskJournalScreen } from "./src/screens/TaskJournalScreen";
import { TodayScreen } from "./src/screens/TodayScreen";
import { AppStateProvider, useAppState } from "./src/state/AppState";
import { fonts, ThemeProvider, useTheme } from "./src/theme";

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const TAB_ICONS: Record<keyof TabParamList, Icon> = {
  Today: SunHorizon,
  Calendar: CalendarBlank,
  Aster: ChatCircleDots,
  Progress: ChartBar,
};

function Tabs() {
  const { colors, name } = useTheme();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.accentText,
        tabBarInactiveTintColor: colors.subtle,
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11 },
        tabBarStyle: { position: "absolute", borderTopColor: colors.line, backgroundColor: "transparent", elevation: 0 },
        tabBarBackground: () => (
          <BlurView tint={name === "night" ? "dark" : "light"} intensity={40} style={[StyleSheet.absoluteFill, { backgroundColor: colors.bar }]} />
        ),
        tabBarIcon: ({ color, focused }) => {
          const Glyph = TAB_ICONS[route.name];
          return <Glyph size={25} color={color} weight={focused ? "fill" : "regular"} />;
        },
      })}
    >
      <Tab.Screen name="Today" component={TodayScreen} />
      <Tab.Screen name="Calendar" component={CalendarScreen} />
      <Tab.Screen name="Aster" component={AsterScreen} />
      <Tab.Screen name="Progress" component={ProgressScreen} />
    </Tab.Navigator>
  );
}

function Root({ fontsLoaded }: { fontsLoaded: boolean }) {
  const { colors, name } = useTheme();
  const { booting, token, user } = useAppState();
  const base = name === "night" ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...base,
    colors: { ...base.colors, background: colors.bg, card: colors.bg, text: colors.ink, border: colors.line, primary: colors.accent },
  };

  let content;
  if (!fontsLoaded || booting) content = <LaunchScreen />;
  else if (!token || !user) content = <SignInScreen />;
  else
    content = (
      <NavigationContainer theme={navigationTheme}>
        <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
          <Stack.Screen name="Tabs" component={Tabs} />
          <Stack.Screen name="TaskJournal" component={TaskJournalScreen} />
          <Stack.Screen name="CalendarDay" component={CalendarDayScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    );

  return (
    <>
      <StatusBar style={name === "night" ? "light" : "dark"} />
      {content}
    </>
  );
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    InstrumentSans_400Regular,
    InstrumentSans_500Medium,
    InstrumentSans_600SemiBold,
    Newsreader_400Regular_Italic,
  });

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AppStateProvider>
            {/* A font failure falls back to the system font rather than blocking the app. */}
            <Root fontsLoaded={fontsLoaded || Boolean(fontError)} />
          </AppStateProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
