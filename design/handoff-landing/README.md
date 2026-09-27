# Handoff: Stratosphere Landing + Sign-in Page

## Overview
This is a redesign of the public landing page (`frontend/src/app/page.tsx`) and the sign-in page (`frontend/src/app/(auth)/login`). It removes the photographic background and the abstract line art that sat behind the headline. In their place is a clean sky that ends in a curved glowing horizon ("Earth limb"). Vector objects drift slowly around the edges: a ringed planet, a moon, satellites, Aster, comets and a hover car. The three static phone mockups become a horizontal screenshot carousel, drawn in the Night & Dawn design system colours.

The page has two hero directions, both shipping:
- **Launch hero**: the landing page `/`. Centred headline, subcopy, Get started / Sign in / App Store badge.
- **Sign-in card**: the login page `/login`. Short headline and a glass card with Apple, Google and email sign-in.

Night is the default theme. Dawn is the light mode. Both use the same tokens as `design_handoff_stratosphere_brand_system/tokens/tokens.css`.

## About the Design Files
`Stratosphere Landing.dc.html` is a **design reference built in HTML**. It shows the intended look and behaviour; it is not production code to copy. Recreate it in the existing Next.js + Tailwind/CSS setup in `frontend/`, using the repo's components (`brand-mark.tsx`, `oauth-buttons.tsx`, `theme.tsx`, `background-shell.tsx`, `aster.tsx`). To view it, open the file in a browser (it needs `support.js` next to it). The "direction", "theme" and "motion" props at the top of the logic class switch the variants.

## Fidelity
**High-fidelity.** Colours, type, spacing, radii and motion are final. The vector objects are final placements but placeholder artwork: they are to be replaced later by commissioned illustrations at the same sizes and positions.

## Screens / Views

### 1. Hero (shared by `/` and `/login`)
- Section: `position:relative; min-height:960px; overflow:hidden; background: var(--sky)`.
- **Sky gradient**
  - Night: `linear-gradient(180deg,#05040C 0%,#0B0A1A 45%,#1A1450 100%)`
  - Dawn: `linear-gradient(180deg,#EEEBF7 0%,#F7F3EE 42%,#FBE2CF 100%)`
  - Dawn also adds a sun glow: an ellipse 900×420 centred at `bottom:60px`, `radial-gradient(closest-side, rgba(247,167,107,.55), transparent)`.
- **Earth limb**: an absolutely positioned div, `left:-25%; width:150%; height:1200px; top:calc(100% - 170px); border-radius:50%`.
  - Night: `background:#0B0A14; box-shadow:0 -40px 140px -20px #6B5CFF, inset 0 1px 0 rgba(167,155,255,.55)`.
  - Dawn: `background:#F7F5F1; box-shadow:0 -40px 140px -20px #F2A76B, inset 0 1px 0 rgba(242,167,107,.7)`.
  - Its fill matches the next section's background, so the page appears to rise out of the atmosphere.
- **Stars**: 120 dots of 1, 1.6 or 2.4px, seeded random placement (deterministic), top 82% of the hero.
  - Night: white, opacity .35–.95. 30% of them twinkle (3–7s, random delay).
  - Dawn: only the top 34%, colour `#8C84BE`, opacity .45.
- **Nav** (absolute, z-index 5): max-width 1240, height 76, padding 0 32.
  - Left: brand mark 30px (candidate 1a; colour `#A79BFF` Night, `#4A3CE0` Dawn) and "Stratosphere" at 19/600, tracking -0.02em.
  - Centre links, 15/500 muted, hover to ink: Screens (#screens), Aster, your coach; For teams; Contact.
  - Right:
    - Theme toggle: 40×40, radius 12, border line, `ph-sun` in Night / `ph-moon` in Dawn.
    - "Sign in" text link.
    - "Get the app" button: 40 high, radius 12, accent background, white 15/600.

### 1a. Launch hero content (`/`)
- Column centred, `max-width:min(860px, 100vw - 280px)`, padding-top 176, gap 28, z-index 3.
- **Chip**
  - Pill: radius 999, padding 6/14/6/6, border line, `background: var(--surface)`, backdrop-blur 12.
  - Inner "New" badge: accent-soft background, accent-text colour, 12/600.
  - Text "Now on the App Store for iPhone" at 14/500 muted, followed by `ph-arrow-right`.
- **H1**: "A calmer way to choose, reflect, and finish your day." Size `clamp(46px,5.4vw,76px)`, weight 600, tracking -0.045em, line-height 1.02, `text-wrap:balance`.
- **Sub**: "Stratosphere helps you plan action items, record how they felt, and use those reflections to make better decisions tomorrow." 19px, line-height 1.55, muted, max-width 600.
- **CTAs** (gap 12, wrap, all 54 high, radius 14):
  - Get started: accent background, white 16/600, trailing arrow, `box-shadow:0 10px 30px -10px var(--accent)`, hover accent-hover.
  - Sign in: border line, `background: var(--btn2)`, blur.
  - App Store badge: black, 1px `#3A3A3F`. **Replace with Apple's official "Download on the App Store" badge SVG** from Apple Marketing Resources.

### 1b. Sign-in card content (`/login`)
- Column max-width 560, padding-top 128, gap 24, centred.
- **H1**: "A calmer way to finish your day." 52/600, tracking -0.04em.
- **Sub**: "Sign in to plan today's action items and pick up where you left off." 17px muted.
- **Card**
  - Box: max-width 420, padding 28, radius 24, border line, `background: var(--surface)`, backdrop-blur 20, `box-shadow: var(--card-shadow)`, gap 12.
  - Continue with Apple: 50 high, radius 14. White background with black text in Night; black with white text in Dawn (follow Apple's Sign in with Apple guidelines).
  - Continue with Google: 50 high, border line, btn2 background, `ph-google-logo`. Use the official multicolour Google "G" in production.
  - "or" divider: 13px subtle, 1px lines either side.
  - Email label: 14/500. Input: 50 high, radius 14, border line, `background: var(--input)`, 16px text. Focus: border accent plus `0 0 0 3px var(--accent-soft)`.
  - Continue with email: 50 high, accent, white 16/600.
  - "New to Stratosphere? Create an account": link in accent-text, 600.
- Below the card: App Store badge, 48 high.
- Wire the buttons to the existing `oauth-buttons.tsx` and auth API calls; keep the current behaviour.

### 2. Screens carousel (`#screens`)
- Section padding 40/0/120, `background: var(--section)`.
- **Header row** (max-width 1240, flex, space-between, wraps):
  - Eyebrow: "Inside the app", 13/600, uppercase, tracking .08em, accent-text.
  - H2: "Your day, reflections, and progress in one iPhone app." 46/600, tracking -0.035em.
  - Paragraph: "Open with a calm brand experience, review scheduled priorities on the calendar, and track completed work alongside the reflections that shaped it." 18px muted.
  - Prev/Next buttons on the right: 48px circles, border line, `ph-arrow-left` / `ph-arrow-right`. Each scrolls the track by ±336px smoothly.
- **Track**
  - Layout: `display:flex; gap:36px; overflow-x:auto; scroll-snap-type:x mandatory; scrollbar-width:none`.
  - Inline padding and scroll-padding: `max(32px, calc((100vw - 1176px)/2))`.
  - Native touch, trackpad and swipe scrolling must work. Each slide has `scroll-snap-align:start`.
- **Slides** (the mobile app screenshots):
  - Phone frame: 300×624, padding 10, radius 50, bezel `#0E0D16`, ring `0 0 0 1px #2A2840`, shadow `var(--phone-shadow)`.
  - Screen: radius 40. Dynamic Island: 92×27 black pill, top 11. Status bar: 48 high, "9:41" 14/600.
  - Caption below the frame: 16/600.
- The six slides, in order:
  1. **Brand launch**: gradient `#15123A` to `#0B0A14`, a small Earth limb, the 84px mark, "Stratosphere" at 26/600, and "your habits in your control" in Newsreader italic 17.
  2. **Today**:
     - Date label, "Hello, Sivarajan" at 20/600 (nowrap), Aster avatar at 36.
     - Progress card: "3 of 5 done" with a 60% accent bar.
     - Five action items with a check (done) or dashed circle (not done). Priority chips: Low (plant, `--low`), Medium (lightning, `--med`), High (flame, `--high`).
     - Tab bar: 72 high, house / calendar / chat / chart icons, active item in accent-text.
  3. **Calendar**:
     - "May 2026" with caret buttons.
     - A 7-column month grid with leading and trailing days at 45% opacity, 4px priority dots under days, and the selected day (12) on a 24px accent square.
     - Agenda row for Tuesday 12 May.
  4. **Reflect without pressure**:
     - Task context: "Book flight to San Francisco".
     - "How did it go?" with Done (filled `--low`), Unsure and Not done. Not done is neutral, never red.
     - "Specific notes" in a Newsreader italic journal box.
     - Save reflection button.
  5. **Ask the life coach**: Aster chat. Coach bubbles use raised background with radius 16/16/16/4; user bubbles use accent with radius 16/16/4/16. Rounded input pill at the bottom.
  6. **Review your rhythm**:
     - Progress/Reflections segmented control.
     - Completed 15 / Open 5 tiles.
     - A 7-day bar chart, with today's bar in accent and the rest in accent-soft.
     - "Latest reflection" quote in Newsreader italic.
- These mock screens are placeholders. Replace them with **real App Store screenshots** (exported from the iOS app in the new design system) once available, keeping the frame and carousel.

### 3. Footer
- Top border line, max-width 1240, padding 28/32, 14px muted.
- Content: "© 2026 Stratosphere" on the left; Privacy, Terms and Contact on the right.

## Floating objects (hero)
- Build them as a `<HeroSky />` component: absolutely positioned, `pointer-events:none`, z-index 1. The content sits at z-index 3.
- The SVGs are in `assets/floating/{night,dawn}/`. Import them as inline SVG components so the palette can switch with the theme.
- Positions:

| Object | Wide (≥1360px) | Compact (<1360px) | Drift |
|---|---|---|---|
| Ringed planet | right 4%, top 13%, w230, rot -6° | right -40px, top 9%, w170, op .9 | 14s |
| Moon | left 6%, top 15%, w76 | left 2%, top 11%, w52 | 11s, delay 1.5s |
| Satellite A | left 3%, top 52%, w190, rot -14° | left -30px, top 64%, w130 | 12s, delay .8s |
| Satellite B | right 13%, top 66%, w110, rot 20°, op .85 | hidden | 10s, delay 2.2s |
| Aster (full body) | right 5%, top 38%, w120, rot 8° | right 1.5%, top 60%, w84 | 9s, delay .4s |
| Hover car | left 0, top calc(100% - 262px), w300 | same | see below |
| Comets | top 12% left 72% (delay 2s); top 26% left 38% (delay 8.5s) | same | 13s |

- On mobile (<768px), hide Satellite A and the comets, and show only the planet, the moon and Aster at compact sizes.

## Interactions & Behavior
- **drift**: `0%,100% {translate(0,0) rotate(var(--r))} 50% {translate(0,-16px) rotate(var(--r)+3deg)}`, ease-in-out, infinite.
- **Hover car**: the outer element runs `carfly` 38s linear infinite (`translateX(-420px)` to `translateX(100vw + 420px)`). The inner element runs `bob` 3.2s ease-in-out (±7px). Headlight at the front (right), red taillight, light trail behind, underglow in indigo (Night) or peach (Dawn).
- **Blink**: the antenna tips on the satellite and Aster (`#F2B24C`) fade in and out, `blink` 2.4s / 3s.
- **Twinkle**: star opacity .9 to .2, 3–7s.
- **Comet**: a 150×2 streak with a gradient head, rotated -24°. It travels (-560px, 250px) and fades in the first 12% of a 13s loop.
- **Reduced motion**: `@media (prefers-reduced-motion: reduce)` disables all of these animations; the car sits static at 6vw.
- **Theme toggle**: switches the Night/Dawn tokens. Use the existing `theme.tsx` and `theme-script.ts` so there's no flash, and persist the choice.
- **Carousel**: the arrows call `scrollBy({left: ±336, behavior:'smooth'})`. Optional: arrow keys when focused, and disabling an arrow at the start or end.
- UI transitions stay under 250ms with no bounce, per the design system.

## State Management
- `theme: 'night' | 'dawn'` comes from the existing theme provider.
- `viewportWidth` controls the compact placement of the floating objects. CSS media queries are preferred in production.
- Sign-in reuses the existing auth state and API in `lib/api.ts`.

## Design Tokens (Night / Dawn)
| Token | Night | Dawn |
|---|---|---|
| section / app-bg / earth | #0B0A14 | #F7F5F1 |
| ink | #F3F2F8 | #16151F |
| muted | #A6A3B8 | #56536A |
| subtle | #8A879E | #6E6B7E |
| line | #2A2840 | #E6E2DA |
| raised | #1C1A2B | #FFFFFF |
| surface (glass) | rgba(19,18,31,.72) | rgba(255,255,255,.82) |
| btn2 | rgba(255,255,255,.06) | rgba(255,255,255,.7) |
| accent / hover | #5B4CF0 / #6B5CFF | #4A3CE0 / #3A2DB8 |
| accent-soft | rgba(107,92,255,.18) | rgba(74,60,224,.10) |
| accent-text / mark | #A79BFF | #4A3CE0 |
| low / med / high | #3CCFB4 / #6CC0F5 / #F2B24C | #0E8A76 / #1C73B0 / #9A5F08 |
| not done | #8A879E | #6E6B7E |
| atmosphere glow | #6B5CFF | #F2A76B |
| phone shadow | 0 40px 80px -30px rgba(0,0,0,.9) | 0 40px 80px -40px rgba(80,50,20,.45) |
| card shadow | 0 30px 80px -30px rgba(0,0,0,.8) | 0 30px 70px -30px rgba(80,50,20,.3) |

- **Type**: Instrument Sans 400/500/600 for the UI; Newsreader italic for journal and quote text.
- **Radii**: 12 for nav buttons, 14 for buttons and inputs, 16 for app cards, 24 for the sign-in card, 50/40 for the phone frame and screen, 999 for pills.
- **Icons**: Phosphor (regular and fill).

## Assets
- `assets/floating/night/*.svg` and `assets/floating/dawn/*.svg`: planet, moon, satellite, hover car. These are placeholder vector art; commission final illustrations at the same aspect ratios. The hover car is an original design; do not reference any real car model.
- `assets/floating/aster-float.svg`: full-body Aster.
- `assets/aster-happy.svg`: Aster avatar, used in the phone mockups.
- Brand mark: the inline SVG for candidate 1a, pending the final logo choice. Keep it in `brand-mark.tsx` so a later swap is one file.
- **Delete from use**: `public/beautiful-night.png` / `beautiful-sunrise.png` as hero backgrounds, and the abstract line and box art behind the headline.
- **Official badges needed**: Apple's App Store badge, Sign in with Apple assets, and Google's sign-in "G".

## Files
- `Stratosphere Landing.dc.html`: the full design reference, with direction, theme and motion props.
- `support.js`: the runtime needed to open the reference in a browser.
- `CLAUDE_CODE_PROMPT.md`: the prompt to paste into Claude Code.
- Related package: `design_handoff_stratosphere_brand_system/` (tokens, components, avatars).
