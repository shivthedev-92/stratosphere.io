import {
  Airplane,
  Barbell,
  Books,
  Brain,
  Briefcase,
  Coffee,
  Flame,
  Heart,
  House,
  Lightbulb,
  Lightning,
  MusicNotes,
  Palette,
  PersonSimpleRun,
  Plant,
  Sparkle,
  Target,
  type Icon,
} from "phosphor-react-native";
import type { Priority } from "./api";
import type { Colors } from "./theme";

export const PRIORITY_META: Record<
  Priority,
  { label: string; icon: Icon; color: keyof Colors; bg: keyof Colors }
> = {
  low: { label: "Low", icon: Plant, color: "low", bg: "lowBg" },
  medium: { label: "Medium", icon: Lightning, color: "med", bg: "medBg" },
  high: { label: "High", icon: Flame, color: "high", bg: "highBg" },
};

export const PRIORITIES: Priority[] = ["low", "medium", "high"];

// Stored in the goal's `emoji` column (max 16 chars), replacing the old emoji picker.
export const TASK_ICONS: Record<string, Icon> = {
  sparkle: Sparkle,
  brain: Brain,
  barbell: Barbell,
  books: Books,
  run: PersonSimpleRun,
  briefcase: Briefcase,
  house: House,
  heart: Heart,
  lightbulb: Lightbulb,
  target: Target,
  coffee: Coffee,
  music: MusicNotes,
  plane: Airplane,
  palette: Palette,
};

export const TASK_ICON_KEYS = Object.keys(TASK_ICONS);
export const DEFAULT_TASK_ICON = "sparkle";

const LEGACY_EMOJI: Record<string, string> = {
  "✨": "sparkle",
  "🧠": "brain",
  "💪": "barbell",
  "📚": "books",
  "🏃": "run",
  "💼": "briefcase",
  "🏠": "house",
  "❤️": "heart",
  "❤": "heart",
  "💡": "lightbulb",
  "🎯": "target",
};

/** Icon key for a goal, mapping emoji saved by older app versions. */
export function taskIconKey(value: string | null | undefined): string {
  if (value && TASK_ICONS[value]) return value;
  if (value && LEGACY_EMOJI[value]) return LEGACY_EMOJI[value];
  return DEFAULT_TASK_ICON;
}

export function TaskIcon({ value, size = 20, color }: { value: string | null | undefined; size?: number; color: string }) {
  const Glyph = TASK_ICONS[taskIconKey(value)];
  return <Glyph size={size} color={color} />;
}
