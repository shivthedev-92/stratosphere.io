# Handoff: Stratosphere iOS App (Night & Dawn)

## Overview
This is a redesign of every screen in `mobile/App.tsx` (React Native / Expo) on the Stratosphere design system. The app currently shows everything on one long dashboard with modals; the redesign moves it to **four bottom tabs: Today, Calendar, Aster, Progress**. Settings opens from the avatar and notifications from the bell. All existing API calls, fields and values stay the same.

## About the Design Files
`Stratosphere Mobile.dc.html` is an HTML **design reference**, not code to ship. Open it in a browser; it needs `support.js` next to it. Switch between Night and Dawn with the `theme` prop in the logic class. Recreate the screens in React Native using the existing state and handlers in `App.tsx`. Split them into screen components under `mobile/src/screens/` and add a tab navigator (`@react-navigation/bottom-tabs` with a native stack for pushed screens). Use sheets (`@gorhom/bottom-sheet` or native `pageSheet` modals) where marked.

## Fidelity
**High-fidelity.** Colours, type, spacing and radii are final. The sample content (names, tasks, dates) is illustrative only.

## Global specs
- **Frame:** iPhone 390×844 pt. Safe area: 54 top, 34 bottom.
- **Screen padding:** 20 horizontal.
- **Tab bar:** 88 high including the home indicator. Top border 1px `line`, background `bar` (blurred). Four items: Phosphor icons at 25pt, labels 11/500. Inactive items use `subtle`; the active item uses `accent-text` with the fill icon.
  - Icons: `sun-horizon`, `calendar-blank`, `chat-circle-dots`, `chart-bar`.
- **Pushed-screen header:** 48 high, a back control (caret-left 22 + label, 17pt accent-text) and optional 44×44 trailing icon buttons.
- **Headings:** screen titles 30/600, tracking -0.03em. Eyebrow labels 13/600, uppercase, tracking .06em, `subtle`. Card titles 16–17/600. Body 15–16. Meta text 13 `muted`.
- **Cards:** `raised` background, radius 16–18, padding 14–16. Grouped list rows are 52 high with 1px `line` dividers.
- **Inputs:** 52 high, radius 14, 1px `line`, `raised` background, 17pt text. Focus: 1.5px `accent` border plus a 3px `accent-soft` ring.
- **Buttons:**
  - Primary: 52–54 high, radius 14, `accent` background, white 17/600.
  - Secondary: 1px `line` border.
  - Soft: `accent-soft` background with `accent-text`.
  - Destructive: `danger` text only.
- **Segmented control:** 3px padding, radius 13, `raised` track; the selected segment is radius 10 on `seg`.
- **Sheets:** radius 28 at the top, `sheet` background, 40×5 grabber, a 36pt circular close (x) button. The scrim is `scrim`.
- **Priority:** Low `plant` / `low`, Medium `lightning` / `med`, High `flame` / `high`. Tinted tiles use `*-bg`. "Not done" uses `circle-dashed` in `nd` and is **never red**.
- **Fonts:** Instrument Sans for the UI. **Newsreader italic** for all journal and reflection text and quotes.
- **Icons:** Phosphor (`phosphor-react-native`). Replace every emoji in the UI.
- **Hit targets:** at least 44pt.
- **Motion:** 200–250ms ease-out, no bounce. Sheets use the native spring.

## Tokens
| Token | Night | Dawn |
|---|---|---|
| bg | #0B0A14 | #F7F5F1 |
| sunken / sheet | #13121F | #F3F0EA / #F7F5F1 |
| raised | #1C1A2B | #FFFFFF |
| seg | #2A2840 | #FFFFFF |
| bar | rgba(11,10,20,.92) | rgba(247,245,241,.94) |
| scrim | rgba(3,2,10,.6) | rgba(22,21,31,.35) |
| ink / muted / subtle | #F3F2F8 / #A6A3B8 / #8A879E | #16151F / #56536A / #6E6B7E |
| line / line-strong | #2A2840 / #3A3857 | #E6E2DA / #CFC9BE |
| accent | #5B4CF0 | #4A3CE0 |
| accent-soft | rgba(107,92,255,.18) | rgba(74,60,224,.10) |
| accent-text | #A79BFF | #4A3CE0 |
| low / med / high | #3CCFB4 / #6CC0F5 / #F2B24C | #0E8A76 / #1C73B0 / #9A5F08 |
| low-bg / med-bg / high-bg | same colour at .14 | same colour at .10 |
| nd (not done) | #8A879E | #6E6B7E |
| danger | #F0707A | #C0323F |
| heatmap levels 0–3 | line, #2B2275, #4A3CE0, #8676FF | line, #E2DEFF, #A79BFF, #4A3CE0 |
| atmosphere glow (launch, sign-in) | #6B5CFF | #F2A76B |

## Screens
1. **Launch**
   - Replaces the blue splash and the "Starting Stratosphere..." loader.
   - Background: gradient (Night `#15123A` to `#0B0A14`; Dawn `#EEEBF7` to `#FBE2CF`) with an Earth-limb arc near the bottom that has the atmosphere glow.
   - Content: 96pt brand mark, "Stratosphere" at 32/600, and "your habits in your control" in Newsreader italic 19.
2. **Sign in**
   - Sky gradient at the top, then the limb arc, then the Aster avatar at 96.
   - Copy: "Welcome back" / "Sign in to pick up where you left off."
   - Buttons: Continue with Apple (white on Night, black on Dawn; follow Apple's guidelines) and Continue with Google.
   - Then an "or with email" divider, Email and Password fields (with an eye toggle), "Forgot password?", the Sign in button, and "New to Stratosphere? Create an account".
   - Hide "Phase 2" and "Check backend" outside `__DEV__`.
3. **Today** (tab)
   - Header: date eyebrow, "Hello, {name}" 30/600, a 44pt bell with an unread dot in `high`, and the 44pt avatar (opens Settings).
   - Summary card: "3 of 5 done today" with "20 in total", an 8pt progress bar, and the motivational quote in Newsreader italic.
   - Segmented filter: Today / All (n) / Completed (n), mapped to `taskFilter`.
   - Goal cards:
     - A 40pt priority-tinted icon tile, title 16/600, and a priority + time meta line.
     - A status icon on the right.
     - The latest reflection sits on a `sunken` panel.
     - Buttons: Reflect (soft) and View (secondary).
     - Completed cards show at 70% opacity with the title struck through.
   - FAB: 58pt, radius 20, `accent`, placed 104 above the bottom. It opens screen 4.
4. **Add action item** (sheet)
   - Copy: "Add Action Item" / "Capture a task or moment you want to revisit."
   - Task title field.
   - **Icon** picker (7 across, 44pt tiles; selected tile is `accent-soft` with a 1.5px `accent` inset). This replaces the `taskEmoji` field; store the icon name in the same field.
   - Specific notes, then Priority as a 3-up segmented choice (the selected one uses its priority colour).
   - Calendar date and Reminder time as two tappable fields that open the native pickers.
   - "Add action item" primary button.
   - The same sheet serves Edit task, with the fields prefilled and a Delete action.
5. **Task journal** (pushed)
   - Back to Today; the pencil button opens an Edit/Delete menu.
   - Eyebrow "Task journal", title 28/600, chips for priority and date/time.
   - "Task context" card.
   - "Task status" card with its helper copy and an Open / Completed segmented control, mapped to `handleSetTaskCompleted`.
   - "Journal timeline" / "Latest entries first.": vertical dots with a 2px line; each entry shows date, emotion pill and Meaningful / Not meaningful, with the text in Newsreader italic 17.
   - Sticky footer: "Add journal entry" (primary) and "Ask Aster" (opens the Aster tab with this task as context).
6. **Add journal entry** (sheet)
   - Textarea in Newsreader italic 18 (placeholder: "Add the latest detail, obstacle, decision, or reflection...").
   - "How did this feel?" chips from `EMOTION_OPTIONS`; tapping the selected chip again clears it.
   - "Does this still feel meaningful?" Yes / No, mapped to `soulful`.
   - A "Mark task complete" switch, mapped to `completed`.
   - "Save entry" button.
7. **Calendar** (tab)
   - Title "Calendar" / "Priority dots mark scheduled task dates."
   - Month card:
     - Header "September 2026" with caret buttons.
     - Weekday row, then 44pt day cells with a 32pt date square.
     - Selected day: `accent` fill. Today: 1.5px `accent` inset with `accent-text`.
     - Days outside the month at 40% opacity.
     - Up to three 5pt dots per day.
     - Legend below.
   - Below the card: the selected day's name, a "See day" link (opens screen 8), and a compact list of that day's items.
8. **Calendar day** (pushed)
   - Eyebrow "Calendar day" and the date title.
   - "Action Items" / "Edit, delete, or reflect on this day."
   - Rows with a trailing caret. Swipe left reveals Edit (`med`) and Delete (`danger`), 75pt each.
   - A dashed "Add to this day" button opens screen 4 with the date filled in.
9. **Aster chat** (tab)
   - Header: Aster avatar 44, "Aster" / "Your life coach", and history and new-chat buttons.
   - Context chip "Context: {task}". This replaces the "Context sent" card.
   - Bubbles:
     - Coach: `raised` background, radius 18/18/18/6.
     - User: `accent` background, white text, radius 18/18/6/18.
     - Loading state: Aster avatar plus "Thinking…".
   - Suggestion chips (What should I focus on? / Help me restart / What do my reflections show?) sit above the input pill ("Ask about your tasks, blockers, or next step...") and its 38pt send button.
10. **Chat history** (sheet)
    - Copy: "Chat history" / "Resume a previous conversation or start fresh."
    - A "New" pill button.
    - Session rows: title, relative date, and a one-line snippet.
11. **Progress** (tab)
    - Title and subtitle, then the Progress / Reflections segmented control.
    - Completed and Open tiles.
    - Activity heatmap: 16 weeks × 7 days in 4 levels, with a legend. Reuse the logic in `frontend/src/lib/heatmap.ts`.
    - "Most felt this month": the top three emotion bars. Negative emotions use `nd`, never red.
    - The Reflections tab lists the entries in timeline style.
12. **Notifications** (sheet)
    - "Notifications" with a "Read all" link.
    - Unread cards carry an 8pt `accent` dot.
    - Completion check-ins have inline Yes / Not yet buttons, mapped to `handleAcknowledgeNotification`.
    - An "Earlier" group shows at 70% opacity.
13. **Settings** (pushed)
    - Eyebrow "Account", title "Settings".
    - Profile card: 56pt avatar, name, email, and an Edit button that opens a sheet with the existing name, phone (country code), DOB and notifications fields.
    - Grouped rows: Phone, Date of birth, In-app notifications (switch).
    - **Appearance:** three swatch cards, Night / Dawn / System. They replace Dusk / Dark / Blue; migrate `dusk` and `dark` to night and `blue` to dawn.
    - Rows: Telegram reminders, Contact us (the existing support ticket form in a sheet), Privacy.
    - Sign out in `danger`.

## State
Keep all of the existing state in `App.tsx` and lift it into context or providers per tab. Changes:
- `themeValue`: `'night' | 'dawn' | 'system'`, with migration from the old values.
- `showSettings`, `showAssistant` and `dayViewDate` become navigation routes.
- `showDashboardAddTask` and `showDayAddTask` merge into one add-task sheet that takes an optional preset date.
- The task emoji becomes the task icon name.

## Assets
- `assets/aster-happy.svg` (coach avatar) and `assets/crew-indigo.svg` (sample user avatar).
- The full avatar set is in `design_handoff_stratosphere_brand_system/assets/avatars/`.
- Brand mark: logo candidate 1a (pending final choice).
- Icons: Phosphor.

## Files
- `Stratosphere Mobile.dc.html` plus `support.js`: the design reference.
- `CLAUDE_CODE_PROMPT.md`: the prompt to paste into Claude Code.
