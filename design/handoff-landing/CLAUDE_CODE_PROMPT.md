Copy this folder to `design/handoff-landing/` in the repo, then paste the prompt below into Claude Code from the repo root. If the brand system handoff hasn't been applied yet, run that one first. It lives at `design/handoff/` and its prompt creates the `design-system-v1` branch.

---
Read `design/handoff-landing/README.md` fully. Open `design/handoff-landing/Stratosphere Landing.dc.html` in a browser as the visual reference; the Sign-in card view is at `direction: 'Sign-in card'` in its logic class. Work on a new branch `landing-v2`, built on top of `design-system-v1` if that branch exists.

Part 1: Landing and login
1. Create a `HeroSky` component in `frontend/src/components/hero-sky.tsx`. It renders the sky gradient, the Earth limb, the stars, the comets and the floating objects, using the SVGs in `design/handoff-landing/assets/floating/` converted to theme-aware inline SVG components. Include the drift, car, bob, blink, twinkle and comet animations, the compact and mobile placements, and prefers-reduced-motion handling, exactly as specified. Replace `background-shell.tsx`'s photo background on the landing and auth pages, and remove the abstract line art behind the hero headline.
2. Rebuild `frontend/src/app/page.tsx` as the "Launch hero" plus the screens carousel plus the footer. Keep the existing partnerships and contact form section below the carousel, restyled with the tokens.
3. Rebuild `frontend/src/app/(auth)/login` as the "Sign-in card" direction, reusing `oauth-buttons.tsx` and the existing auth logic. Apply the same card treatment to signup, forgot-password and reset-password.
4. The carousel must use native scroll-snap with the arrow buttons. Leave clearly named TODOs where the official App Store badge, Sign in with Apple and Google assets go.

Part 2: App layout audit. Do not redesign these pages yet.
5. Review `frontend/src/app/dashboard/page.tsx`, `frontend/src/components/month-priority-calendar.tsx`, `task-detail-modal.tsx`, `reflect-goal-modal.tsx`, the add-task flow and `frontend/src/app/tasks/[goalId]`. Write `design/app-layout-audit.md` covering:
   - every hard-coded colour or emoji, and anything else that doesn't use the design tokens;
   - layout problems at 375, 768, 1280 and 1440px widths;
   - the add-task flow step by step, with the fields it needs;
   - the calendar's behaviour and data;
   - a screenshot of each screen at 1440px in Night and in Dawn, saved in `design/audit-screens/`.
   Apply only token and colour fixes; make no structural changes.

Run the dev server, typecheck and lint after each step, and commit each step separately.
---

When Part 2 is done, bring `design/app-layout-audit.md` and `design/audit-screens/` back to the design project. The dashboard, add-task and calendar redesign will be built from them.
