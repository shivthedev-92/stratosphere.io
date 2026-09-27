import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { ContactForm } from "@/components/contact-form";
import { EarthLimb, HeroSky } from "@/components/hero-sky";
import { ScreensCarousel } from "@/components/screens-carousel";
import { SiteNav } from "@/components/site-nav";

/**
 * Public landing page, "Launch hero" direction of design/handoff-landing:
 * sky hero, the in-app screens carousel, partnerships/contact, footer.
 */
export default function Home() {
  return (
    <div className="min-h-screen bg-canvas text-fg">
      <section className="hero-sky relative min-h-[760px] overflow-hidden sm:min-h-[960px]">
        <HeroSky />
        <EarthLimb />
        <SiteNav />
        <div className="relative z-[3] mx-auto flex max-w-[908px] flex-col items-center gap-7 px-6 pt-32 text-center sm:max-w-[min(908px,calc(100vw-232px))] sm:pt-44">
          {/* The handoff's "Now on the App Store" chip waits for the iPhone app to be published. */}
          <Link
            href="/signup"
            className="inline-flex items-center gap-2.5 rounded-full border border-line bg-surface py-1.5 pl-1.5 pr-3.5 backdrop-blur-md"
          >
            <span className="rounded-full bg-accent/20 px-2.5 py-0.5 text-xs font-semibold text-accent-soft">New</span>
            <span className="whitespace-nowrap text-[13px] font-medium text-fg-muted sm:text-sm">
              Sign in with Google or Microsoft
            </span>
            <ArrowRight size={14} aria-hidden="true" className="text-fg-muted" />
          </Link>
          <h1 className="m-0 text-[clamp(40px,5.4vw,76px)] font-semibold leading-[1.02] tracking-[-0.045em] [text-wrap:balance]">
            A calmer way to choose, reflect, and finish your day.
          </h1>
          <p className="m-0 max-w-[600px] text-[17px] leading-[1.55] text-fg-muted sm:text-[19px]">
            Stratosphere helps you plan action items, record how they felt, and use those reflections to make better
            decisions tomorrow.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/signup"
              className="inline-flex h-[54px] items-center gap-2 rounded-[14px] bg-accent px-6 text-base font-semibold text-white transition-colors duration-200 hover:bg-accent-hover"
              style={{ boxShadow: "0 10px 30px -10px var(--accent)" }}
            >
              Get started
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <Link
              href="/login"
              className="inline-flex h-[54px] items-center rounded-[14px] border border-line bg-[var(--btn2)] px-6 text-base font-semibold text-fg backdrop-blur-md transition-colors duration-200 hover:border-fg-subtle"
            >
              Sign in
            </Link>
            {/* TODO(app-store-badge): Apple's official "Download on the App Store" badge SVG, once the iPhone app is published. */}
          </div>
        </div>
      </section>

      <ScreensCarousel />

      <section id="contact" className="scroll-mt-8 bg-canvas">
        <div className="mx-auto grid w-full max-w-[1240px] gap-8 px-4 pb-24 sm:px-8 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="flex flex-col gap-4">
            <div className="text-[13px] font-semibold uppercase tracking-[0.08em] text-accent-soft">Partnerships</div>
            <h2 className="m-0 text-[34px] font-semibold leading-[1.08] tracking-[-0.035em] [text-wrap:balance]">
              Looking for business integration or team access?
            </h2>
            <p className="m-0 max-w-2xl text-lg leading-[1.55] text-fg-muted">
              Contact us for sales, workplace pilots, wellbeing programs, or custom productivity workflows. For product
              support, signed-in users can raise a ticket from Settings.
            </p>
          </div>
          <div className="rounded-panel border border-line bg-surface p-6 backdrop-blur-md">
            <ContactForm source="marketing" />
          </div>
        </div>
      </section>

      <footer className="border-t border-line bg-canvas">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-4 px-4 py-7 text-sm text-fg-muted sm:px-8">
          <span>© 2026 Stratosphere</span>
          <span className="flex gap-5">
            <Link href="/privacy" className="hover:text-fg">Privacy</Link>
            {/* No Terms page yet; the handoff's "Terms" link is left out until it exists. */}
            <Link href="/contact" className="hover:text-fg">Contact</Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
