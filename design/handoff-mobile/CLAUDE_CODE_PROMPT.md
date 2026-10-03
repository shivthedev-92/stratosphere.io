Copy this folder to `design/handoff-mobile/` in the repo, then paste the prompt below into Claude Code from the repo root:

---
Read `design/handoff-mobile/README.md` fully and open `design/handoff-mobile/Stratosphere Mobile.dc.html` in a browser as the visual reference; switch themes with the `theme` prop. Work on a new branch `mobile-v2`, built on top of `design-system-v1` if that branch exists. Do these steps in order:

1. Add the Night/Dawn theme tokens, Instrument Sans, Newsreader and `phosphor-react-native`.
2. Split `mobile/App.tsx` into screens under `mobile/src/screens/` with a bottom-tab navigator (Today, Calendar, Aster, Progress) and a stack for Task journal, Calendar day and Settings. Keep all existing API calls and behaviour.
3. Build each of the 13 screens as specified. Use sheets for Add action item, Add journal entry, Chat history, Notifications and Edit profile.
4. Replace every emoji with Phosphor icons. The task emoji becomes an icon picker, and legacy emoji values need a fallback icon.
5. Migrate the saved theme values from dusk/dark/blue to night/dawn/system.
6. Hide "Phase 2" and the backend check outside `__DEV__`.

After each step, run `npx expo start` and the typecheck, then commit that step on its own.
---
