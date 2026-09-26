# Handoff: Stratosphere Brand + Design System v1 ("Night & Dawn")

## Overview
Brand refresh and design system for Stratosphere.io (web: `frontend/` Next.js + Tailwind v4; iOS: `mobile/` React Native/Expo). Adds one unified indigo accent, a Dawn light mode, a type system, an icon set replacing all UI emoji, restyled core components, the astronaut coach **Aster**, and a selectable profile-avatar set.

## About the design files
Files in `reference/` are **design references built in HTML**: prototypes of the intended look, not production code. Recreate them in the existing codebase using its patterns (Tailwind classes in `frontend/`, StyleSheet in `mobile/`). Do not ship the HTML. Open `reference/*.dc.html` in a browser (keep `support.js` and `frontend/public/` next to them).

## Fidelity
**High-fidelity.** Colors, type, radii, spacing and component states are final. The logo is **not final yet**: three candidates are in `assets/logo-candidates/`; the owner will pick one. Until then keep the existing `BrandMark` and wire it so the SVG can be swapped in one place.

## Global rules
- **One accent:** indigo. Remove sky-blue (#0284c7-ish) buttons and `bg-sky-400` bars from the landing page and ProgressSystem; use `--accent`.
- **"Not done" is neutral grey** (`--notdone`), never red/amber. Red (`--danger`) only for destructive actions (delete).
- **No emoji in UI.** Replace with Phosphor icons (Regular weight; Fill for the selected state):
  - 🌱 Low → `plant` · ⚡ Medium → `lightning` · 🔥 High → `flame`
  - ⏰ timed → `alarm` · ✏️ edit → `pencil-simple` · 🗑️ delete → `trash` · 🔔 → `bell` · ✦ quote → `sparkle` · 🌤 Today → `sun-horizon`
  - Done → `check-circle` (fill when selected) · Not done → `circle-dashed`
  - Web: `@phosphor-icons/react`. iOS: `phosphor-react-native`.
- **Keep the copy as is.** This handoff doesn't change the product's wording, except the coach's name inside chat (Aster).
- Motion: 150–250 ms, easing `cubic-bezier(.2,.7,.2,1)`, no bounce/overshoot.
- Hit targets ≥ 44 pt on iOS, ≥ 40 px on web.

## Themes
- **Night** (default): `frontend/public/beautiful-night.png` behind a `linear-gradient(rgba(11,10,20,.55), rgba(11,10,20,.88))` overlay. Surfaces are translucent `rgba(19,18,31,.78)` + `backdrop-filter: blur(16px)` + 1 px `rgba(255,255,255,.08)` border.
- **Dawn** (new light mode): `frontend/public/beautiful-sunrise.png` behind `linear-gradient(rgba(247,245,241,.35), rgba(247,245,241,.92) 55%)`. Surfaces are solid white with a 1 px #E6E2DA border and shadow `0 12px 30px -20px rgba(43,34,117,.3)`. No glossy gradients or bevels.
- Toggle: `data-theme="dawn"` on `<html>`; default follows `prefers-color-scheme`, with a user override saved in Settings. iOS: `useColorScheme()` + override.
- Replace the current `.signature-bg` grid/stripe overlay with the scene + overlay above; the grid lines and stripes are removed.

## Design tokens
All values are in `tokens/tokens.css` (web) and `tokens/tokens.ts` (RN). Summary:
- Indigo 50–950: F1EFFF E2DEFF C7BFFF A79BFF 8676FF 6B5CFF **5B4CF0** 4A3CE0 3A2DB8 2B2275 15123A. Primary = 600 on Night, 700 on Dawn. Focus ring 3 px `rgba(107,92,255,.25)` + 1 px accent border.
- Priority (Night / Dawn fg · bg): Low #3CCFB4 / #0E7A68 · #E3F5F1; Medium #6CC0F5 / #1C6AA3 · #E4F0FA; High #F2B24C / #8A5507 · #FBF0DD. Night bg = fg at 12% alpha.
- Type: **Instrument Sans** (UI, 400/500/600) + **Newsreader Italic** (daily quote, journal entries, journal textarea). Web/iOS sizes: display 56/34, title-1 32/28, title-2 20/20, body 16/17, journal 20/19, label 14/15, caption 12/13 uppercase +0.06em. Display tracking −0.035em, titles −0.02em.
- Spacing 4-pt grid: 4 8 12 16 24 32 48 64. Radius: chip 8, control 12, card 20, panel 24, full.

## Components (see reference/Stratosphere Design System.dc.html §04)
- **Primary button:** h44, px20, r12, bg accent, white 15/600. Hover accent-hover. Disabled: 40% opacity (replace the current dim #3b2f9a look).
- **Secondary button:** h44, r12, Night bg rgba(255,255,255,.06) + border line-strong; Dawn white + #E6E2DA border. Text 15/600.
- **Ghost / link button:** transparent, text accent-soft (Night) / accent (Dawn).
- **Icon button:** 44×44, r12, secondary style. Delete variant: danger text, danger-bg, border danger at 28%.
- **Segmented control** (Today/Upcoming/All, List/Cards): container p4 r12; Night: active pill accent bg + white text; Dawn: container #EFECE6, active pill white + shadow 0 1px 2px rgba(22,21,31,.12), inactive text-muted.
- **Priority chip (badge):** px10 py5 r8, 13/600, icon + label, priority fg on priority bg.
- **Priority selector (form):** 3-col grid, h44 r12, border line-strong; selected = border in priority fg + tinted bg + Fill icon + 600 weight.
- **Inputs:** h44 (textarea h72+), r12, px14, 15px. Night bg rgba(255,255,255,.04); Dawn #FBFAF7. Focus: accent border + ring.
- **Quote banner:** card r20, p20/22, sparkle icon (indigo-300 Night / 700 Dawn) + Newsreader italic 21/1.35.
- **Task card:** card r20; title 17/600 + priority chip; note 15 text-muted; meta row 13 text-subtle with alarm icon; secondary "Reflect" button top-right (h40).
- **Reflection composer:** Done / Not done 2-col (Done selected: low-bg + low border + check-circle fill), question label 15/500, Yes/Unsure/No 3-col (selected = primary).
- **Chat:** coach bubble r18 18 18 6, raised bg + line border, "Aster" label 12/600 accent-soft; user bubble r18 18 6 18, accent bg, white. Avatar 32–36 px left of coach bubble, aligned to bubble bottom.

## Aster — astronaut coach (§05)
- SVGs: `assets/aster/aster-{happy,thinking,celebrating}.svg`. Round avatar with indigo gradient #6B5CFF→#2B2275.
- States: **happy** (default), **thinking** (while the AI response streams; show with a 3-dot typing bubble), **celebrating** (after a task is marked Done, or a milestone).
- Tone: playful, encouraging, space metaphors in moderation ("big rockets launch in stages"). The nav button can stay "Life Coach"; the chat header and bubble label read "Aster".
- The same avatar is used for the Telegram bot profile photo.
- These SVGs are geometric placeholders good enough to ship in the web app; for the App Store the owner may commission an illustrator using them as the brief.

## Profile avatars (§06)
- 12 SVGs in `assets/avatars/`: 6 "Crew" helmets (no face, so Aster stays unique) + 6 "Sky" (ringed planet, crescent, dawn, comet, binary, earthrise).
- Picker: 76 px circles, grid `repeat(auto-fill, minmax(96px,1fr))` gap 20, grouped "Crew" / "Sky". Selected: 2 px #8676FF ring offset 3 px + 22 px accent check badge top-right. Shown at signup (optional step) and in Settings.
- Data: add `avatar_id: string | null` to the user model (backend migration + `/me` schema). Null → current initial-letter tile fallback.
- Replace the "S" square in the dashboard header with the chosen avatar.

## Suggested implementation order
1. Tokens + fonts in `globals.css` and `mobile/src/theme.ts` (from tokens.ts).
2. Install Phosphor; replace every emoji in dashboard, tasks/[goalId], modals, calendar, mobile/App.tsx.
3. Restyle buttons/inputs/segmented/chips/cards to spec; unify accent (landing page sky → indigo).
4. Theme switch (Night/Dawn) + Settings toggle.
5. Aster in chat (web + mobile), then the avatar picker + `avatar_id` field.
6. Logo swap once chosen (BrandMark, icon.svg, favicon, Expo icon/splash, Assets.xcassets).

## Files
- `reference/Stratosphere Design System.dc.html`: tokens, type, icons, components (Night/Dawn), Aster, avatar picker.
- `reference/Stratosphere Brand.dc.html`: logo candidates 1a/1b/1c with app icons and favicons.
- `tokens/tokens.css`, `tokens/tokens.ts`.
- `assets/aster/`, `assets/avatars/`, `assets/logo-candidates/`.
- Backgrounds already exist in the repo at `frontend/public/beautiful-night.png` and `beautiful-sunrise.png` (mobile: copy to `mobile/assets/`).

## Repository notes
- The reference HTML expects the two scene images at `reference/frontend/public/`. They are not duplicated here (3.5 MB); they already live in `frontend/public/beautiful-night.png` and `beautiful-sunrise.png`. Copy them next to the reference files if you want to open those pages locally.
- Logo decision (2026-09-26): **1a Strata**.
