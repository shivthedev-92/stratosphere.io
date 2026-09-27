# App layout audit

Part 2 of `design/handoff-landing/CLAUDE_CODE_PROMPT.md`. Covers the signed-in app: dashboard, month calendar, add-task flow, task detail dialog, reflect dialog, task page (`/tasks/[goalId]`) and Settings.

- Audited: 27 September 2026, from `main` after PR #7. Demo account data: 5 tasks, 4 reflections.
- Screenshots: `design/audit-screens/`, each screen at 1440px in Night and Dawn.
- Scope: only token and colour fixes were applied; nothing structural changed.

---

## 1. Design-token compliance

The signed-in screens already use the Night & Dawn tokens (the design-system PR converted about 700 classes).

| Item | Where | Status |
|---|---|---|
| `bg-indigo-600/30` for the selected calendar day | `components/month-priority-calendar.tsx` | **Fixed**: now `bg-accent/20` |
| `text-white` (11 places) | dashboard, task page, both dialogs | Intended: always on `bg-accent` or `bg-danger`, white in both themes per the design system |
| Hex, `rgb()` or Tailwind palette colours | all audited files | None left |
| Emoji in UI | all audited files | None left (Phosphor icons) |

**Not token issues, but visual inconsistencies for the redesign:**
- **Old background.** The dashboard, task page and chat still use the old photographic background (`.signature-bg`, mountains and planets). The landing and sign-in pages now use the new sky (PR #8), so the app looks like a different product once you sign in.
- **Two ways to change theme.** The hamburger menu (top right) opens an Appearance menu that duplicates **Settings → Appearance**.

## 2. Layout problems by width

The measurements come from a script run against the dashboard with demo data.

| Width | Layout | Horizontal page overflow | Controls under 40px | Main problems |
|---|---|---|---|---|
| **375** | One column | none | 44 | The header wraps to three rows; the task list starts about **1,300px down**; the completed-reflections table is cut off at the right |
| **768** | One column (the two-column layout starts at `lg`) | none | 14 | Same order problem as 375: form and calendar come before the task list |
| **1280** | Two columns | none | 44 | The task panel's height follows the left column, so with few tasks it's a large empty box |
| **1440** | Two columns, max width 1088 | none | 44 | As at 1280, plus stat tiles stretched to the Priority Mix height, leaving empty space |

**Details:**

- **Header** (every width):
  - It carries six controls: avatar, notifications, **Life Coach**, **Settings**, **Sign out** and the appearance menu.
  - At 375 they wrap to three rows, and **Sign out** gets the same weight as the main actions.
- **Order on phones.** The page reads:
  1. Motivational quote
  2. Add Action Item form
  3. Calendar
  4. Today's Action Items
  5. Progress
  6. Completed Reflections

  The user's own tasks come fourth, below a full form.
- **Motivational quote banner.** A full-width card at the top of every visit. At 375 it takes about 190px.
- **Task list panel:**
  - The heading always says **"Today's Action Items"**, even with the **Upcoming** or **All** filter.
  - It has two segmented controls (**List/Cards** and **Today/Upcoming/All**), and the panel height is set in code (`actionListHeight`) to match the left column.
- **Completed Reflections table.** Six columns: Completed, Reflection, Status, Time completed, Took, Action. At 375 the last three are off screen inside the card. "Took 1m" isn't explained anywhere.
- **Progress Path.** The three stat tiles (Done / Not done / Felt meaningful) stretch to the Priority Mix card's height. The "4 reflections" pill repeats the count from elsewhere.
- **Small controls.** Calendar day cells (about 34–36px), the filter chips (32px tall) and the icon buttons are under the 40px comfortable tap size on phones. The 375 count of 44 includes the heatmap day cells, which are meant to be small.

## 3. The add-task flow, step by step

Source: `handleCreateGoal` in `app/dashboard/page.tsx`. Screenshot: `add-task-*-1440.jpg`.

1. The **Add Action Item** form is always open in the left column. There's no button to reveal it.
2. **Title** (required). Placeholder "Read for 15 minutes".
3. **Specific notes** (optional). A tall text area. Placeholder "Where, why, or what might get in the way?".
4. **Priority**: a segmented Low / Medium (default) / High, with plant, lightning and flame icons.
5. **"This has a specific time"** checkbox. When ticked, it shows the browser's native date-and-time input. Its format is browser-dependent (for example `mm/dd/yyyy, --:-- --` in Chrome for the US).
6. **Submit.** The label changes with the chosen time: **Add to today**, **Add to tomorrow**, or **Add to 3 Oct**.
7. The app calls `POST /goals`:

   ```json
   { "title": "...", "notes": "..." or null, "priority": "low|medium|high",
     "is_timed": true or false, "scheduled_for": "ISO datetime" or null }
   ```

   A timed task also creates a reminder, which is sent through Telegram when linked.

**Rough edges:**
- **Untimed tasks.** A task without a time is always dated "today" (its creation date). There's no way to plan an untimed task for tomorrow.
- **"Moment-based goal."** The task list calls untimed tasks this, but the form never uses the phrase.
- **Time formats differ.** The task card shows the raw locale time with seconds ("Timed for 9/26/2026, 7:00:00 AM"). The task page shows "Sat, Sep 26, 7:00 AM".
- **Validation.** Ticking "specific time" without picking a date is still accepted. The task is saved marked as timed but with no time (`is_timed: true`, `scheduled_for: null`), so no reminder is ever created. The date input isn't `required`, and the API doesn't reject the combination.

**Fields the redesign needs:** title; optional notes; priority; when: today, a specific day, or a day plus time; and whether to be reminded (on by default when a time is set). Telegram is the delivery channel if linked.

## 4. The calendar: behaviour and data

Source: `components/month-priority-calendar.tsx`. Screenshot: `calendar-*-1440.jpg`.

- **Current month only.** There are **no previous or next buttons**, so past and future months can't be viewed.
- **Days:**
  - Each day shows up to three dots: one per distinct priority among that day's tasks, not a count of tasks.
  - Today has an accent outline.
  - The selected day has an accent tint.
- **Task dates.** A task belongs to a day by its `scheduled_for`, or by `created_at` if it's untimed.
- **Click a day** to filter the task list to that day (and switch the filter to **All**). Click it again to clear.
- **Legend** at the top: Low, Med, High.
- **What it doesn't show:**
  - done versus not done
  - whether a day has reflections
  - the number of tasks
- **Overlap with the heatmap.** The year heatmap in Progress Path (PR #5) now covers "how did my days go". The calendar is best kept for "what's planned".

## 5. Other screens

- **Task detail dialog** (`task-detail-modal-*`):
  - Contains Title, Notes, Priority, the timed toggle and date, **Delete task** and **Save changes**.
  - **Delete** also appears as a separate trash button on every task card, so there are two paths to the same destructive action.
- **Reflect dialog** (`reflect-modal-*`):
  - Done / Not done, a reflection text box, then "Does this goal still feel meaningful? Yes / Unsure / No", then Cancel / Save reflection.
  - This is the only place "Unsure" appears; it means the meaningfulness answer.
- **Task page** (`task-page-*`):
  - Header: title, priority chip, time chip and entry count.
  - A **Task context** card.
  - **Add journal entry** on the left and the **Journal timeline** on the right: the "thought chain", which works well.
  - Timeline entries carry chips such as "User log", "Completed" and "Meaningful".
- **Settings** (`settings-*`):
  - Contains Name, Email, Profile avatar, Appearance, Telegram reminders, Contact us and Delete account.
  - It's a long, single-scroll dialog.

**Vocabulary.** The same things have several names, which is part of why the app feels like "a lot to comprehend":

| Concept | Words used today |
|---|---|
| A thing to do | action item, task, goal, moment-based goal, timed task |
| Writing about it | reflection, journal entry, entry, user log |
| Its state | Done / Completed / Addressed, Not done, Re-work |
| Meaningfulness | Meaningful, Felt meaningful, Yes / Unsure / No |

## 6. For the design session

These are inputs, not decisions, drawn from the findings and the owner's notes.

- **Shorter first screen.** Lead with "today": the tasks, one clear **Add** action and progress at a glance. The quote, the full form and the table can live behind a tap or on their own pages.
- **One vocabulary.** For example: *task*, *reflection*, *done / not done*, *felt meaningful*.
- **Phone order.** Put the task list first and the form behind an **Add** button or bottom sheet. Header actions could go into a tab bar or a menu.
- **Calendar.** Add month navigation, and decide whether it shows plans only or plans plus completion (the heatmap already covers completion).
- **Thought chain.** The per-task journal timeline is the strongest idea in the app, and worth featuring rather than hiding one tap deep.
- **Simple tools the owner asked about**, for example a **mind map** of a goal and its steps, or of how reflections connect. These need a layout slot and a data model (goal → steps → reflections), so they belong in the dashboard redesign rather than being bolted on.
- **Match the landing sky.** The signed-in app should use the new sky and tokens instead of the old photo background.

## Screenshot index (`design/audit-screens/`)

| File | Screen |
|---|---|
| `dashboard-{night,dawn}-1440.jpg` | Dashboard, full page, default **Today** filter (empty, because the demo tasks are dated yesterday) |
| `dashboard-all-tasks-{night,dawn}-1440.jpg` | Dashboard with the **All** filter, showing task cards |
| `add-task-{night,dawn}-1440.jpg` | Add Action Item form with "specific time" ticked |
| `calendar-{night,dawn}-1440.jpg` | Month calendar |
| `task-detail-modal-{night,dawn}-1440.jpg` | Task details (edit) dialog |
| `reflect-modal-{night,dawn}-1440.jpg` | Reflect dialog |
| `task-page-{night,dawn}-1440.jpg` | Task page with the journal timeline |
| `settings-{night,dawn}-1440.jpg` | Settings dialog |
