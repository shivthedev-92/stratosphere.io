import { ClockCounterClockwise, NotePencil, PaperPlaneRight, X } from "phosphor-react-native";
import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText, AsterAvatar, EmptyText, ErrorText, IconButton, Sheet } from "../components/ui";
import { formatRelativeDate } from "../lib/format";
import { useAppState } from "../state/AppState";
import { fonts, radius, useTheme } from "../theme";

const SUGGESTIONS = ["What should I focus on?", "Help me restart", "What do my reflections show?"];

/** Screen 9: Aster chat tab. */
export function AsterScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const {
    goals,
    chatHistory,
    chatLoading,
    chatError,
    activeChatGoalId,
    sendCoachMessage,
    startNewChat,
    loadChatSessions,
  } = useAppState();
  const [input, setInput] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const contextGoal = activeChatGoalId ? goals.find((goal) => goal.id === activeChatGoalId) : undefined;

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [chatHistory.length, chatLoading]);

  function send(message: string) {
    if (!message.trim() || chatLoading) return;
    setInput("");
    sendCoachMessage(message);
  }

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.bg, paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={-tabBarHeight + insets.bottom}
    >
      <View style={[styles.header, { borderBottomColor: colors.line }]}>
        <AsterAvatar mood={chatLoading ? "thinking" : "happy"} size={44} />
        <View style={styles.flex}>
          <AppText variant="cardTitle">Aster</AppText>
          <AppText variant="meta">Your life coach</AppText>
        </View>
        <IconButton
          icon={ClockCounterClockwise}
          label="Chat history"
          onPress={() => {
            loadChatSessions();
            setShowHistory(true);
          }}
        />
        <IconButton icon={NotePencil} label="New chat" onPress={startNewChat} />
      </View>

      <ScrollView ref={scrollRef} style={styles.flex} contentContainerStyle={styles.messages} keyboardDismissMode="interactive">
        {contextGoal ? (
          <View style={[styles.contextChip, { backgroundColor: colors.accentSoft }]}>
            <AppText variant="meta" color={colors.accentText} numberOfLines={1} style={styles.flexShrink}>
              Context: {contextGoal.title}
            </AppText>
            <Pressable accessibilityRole="button" accessibilityLabel="Remove context" hitSlop={10} onPress={startNewChat}>
              <X size={14} color={colors.accentText} />
            </Pressable>
          </View>
        ) : null}
        {chatHistory.length === 0 ? (
          <EmptyText>Ask what to focus on, how to restart, or what your reflections show.</EmptyText>
        ) : null}
        {chatHistory.map((message, index) =>
          message.role === "assistant" ? (
            <View key={index} style={styles.coachRow}>
              <AsterAvatar size={32} />
              <View style={[styles.bubble, styles.coachBubble, { backgroundColor: colors.raised, borderColor: colors.line }]}>
                <AppText variant="caption" color={colors.accentText} style={styles.bubbleLabel}>
                  Aster
                </AppText>
                <AppText variant="body">{message.content}</AppText>
              </View>
            </View>
          ) : (
            <View key={index} style={[styles.bubble, styles.userBubble, { backgroundColor: colors.accent }]}>
              <AppText variant="body" color="#FFFFFF">
                {message.content}
              </AppText>
            </View>
          ),
        )}
        {chatLoading ? (
          <View style={styles.coachRow}>
            <AsterAvatar mood="thinking" size={32} />
            <AppText variant="meta">Thinking…</AppText>
          </View>
        ) : null}
        <ErrorText>{chatError}</ErrorText>
      </ScrollView>

      <View style={[styles.composer, { paddingBottom: tabBarHeight + 8 }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestions}>
          {SUGGESTIONS.map((suggestion) => (
            <Pressable
              key={suggestion}
              accessibilityRole="button"
              disabled={chatLoading}
              onPress={() => send(suggestion)}
              style={[styles.suggestion, { borderColor: colors.line, backgroundColor: colors.raised }]}
            >
              <AppText variant="meta" color={colors.ink}>
                {suggestion}
              </AppText>
            </Pressable>
          ))}
        </ScrollView>
        <View style={[styles.inputPill, { backgroundColor: colors.raised, borderColor: colors.line }]}>
          <TextInput
            value={input}
            onChangeText={setInput}
            multiline
            placeholder="Ask about your tasks, blockers, or next step..."
            placeholderTextColor={colors.subtle}
            style={[styles.input, { color: colors.ink }]}
            accessibilityLabel="Message Aster"
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send"
            disabled={chatLoading || !input.trim()}
            onPress={() => send(input)}
            style={[styles.send, { backgroundColor: colors.accent }, (chatLoading || !input.trim()) && styles.disabled]}
          >
            <PaperPlaneRight size={18} color="#FFFFFF" weight="fill" />
          </Pressable>
        </View>
      </View>

      <ChatHistorySheet visible={showHistory} onClose={() => setShowHistory(false)} />
    </KeyboardAvoidingView>
  );
}

/** Screen 10: Chat history. */
function ChatHistorySheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const { chatSessions, activeChatSessionId, openChatSession, startNewChat } = useAppState();
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Chat history"
      subtitle="Resume a previous conversation or start fresh."
      headerRight={
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            startNewChat();
            onClose();
          }}
          style={[styles.newPill, { backgroundColor: colors.accentSoft }]}
        >
          <AppText variant="label" color={colors.accentText}>
            New
          </AppText>
        </Pressable>
      }
    >
      {chatSessions.length === 0 ? <EmptyText>No saved chats yet.</EmptyText> : null}
      {chatSessions.map((session) => (
        <Pressable
          key={session.id}
          accessibilityRole="button"
          onPress={async () => {
            onClose();
            await openChatSession(session.id);
          }}
          style={[
            styles.sessionRow,
            { borderBottomColor: colors.line },
            session.id === activeChatSessionId && { backgroundColor: colors.accentSoft },
          ]}
        >
          <View style={styles.sessionTop}>
            <AppText variant="label" numberOfLines={1} style={styles.flex}>
              {session.title}
            </AppText>
            <AppText variant="meta">{formatRelativeDate(session.updated_at)}</AppText>
          </View>
          <AppText variant="meta" numberOfLines={1}>
            {session.goal_id ? "About a task" : "General conversation"}
          </AppText>
        </Pressable>
      ))}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexShrink: { flexShrink: 1 },
  disabled: { opacity: 0.4 },
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 20, paddingVertical: 10, borderBottomWidth: 1 },
  messages: { paddingHorizontal: 20, paddingVertical: 16, gap: 12 },
  contextChip: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
    maxWidth: "100%",
  },
  coachRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  bubble: { maxWidth: "82%", paddingHorizontal: 14, paddingVertical: 10 },
  coachBubble: { borderWidth: 1, borderTopLeftRadius: 18, borderTopRightRadius: 18, borderBottomRightRadius: 18, borderBottomLeftRadius: 6 },
  userBubble: { alignSelf: "flex-end", borderTopLeftRadius: 18, borderTopRightRadius: 18, borderBottomLeftRadius: 18, borderBottomRightRadius: 6 },
  bubbleLabel: { fontFamily: fonts.semibold, fontSize: 12, marginBottom: 2 },
  composer: { paddingHorizontal: 20, paddingTop: 8, gap: 8 },
  suggestions: { gap: 8 },
  suggestion: { minHeight: 36, borderRadius: radius.full, borderWidth: 1, paddingHorizontal: 12, justifyContent: "center" },
  inputPill: { flexDirection: "row", alignItems: "flex-end", borderRadius: 24, borderWidth: 1, paddingLeft: 16, padding: 5 },
  input: { flex: 1, minHeight: 38, maxHeight: 120, paddingTop: 9, paddingBottom: 9, fontFamily: fonts.regular, fontSize: 16 },
  send: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  newPill: { minHeight: 36, borderRadius: radius.full, paddingHorizontal: 14, justifyContent: "center" },
  sessionRow: { paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1, gap: 2 },
  sessionTop: { flexDirection: "row", alignItems: "center", gap: 8 },
});
