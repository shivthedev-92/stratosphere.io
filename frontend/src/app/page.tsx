import Link from "next/link";
import { BackgroundShell } from "@/components/background-shell";
import { ContactForm } from "@/components/contact-form";
import { RhythmIllustration } from "@/components/illustrations";

const features = [
  {
    title: "Plan your day",
    body: "Create timed or moment-based action items, mark priority, and see what needs attention today.",
  },
  {
    title: "Reflect without pressure",
    body: "Add journal entries with emotion labels so the app captures context, not just completion.",
  },
  {
    title: "Review your rhythm",
    body: "Use calendar dots, progress charts, completed items, and chat history to understand patterns over time.",
  },
  {
    title: "Ask the life coach",
    body: "The AI assistant uses your tasks and reflections to help you decide the next useful step.",
  },
];

const appScreenshots = [
  {
    src: "/iphone-app-image-1.png",
    alt: "Stratosphere splash screen on iPhone",
    label: "Brand launch",
  },
  {
    src: "/iphone-app-image-2.png",
    alt: "Stratosphere mobile calendar dashboard",
    label: "Calendar view",
  },
  {
    src: "/iphone-app-image-3.png",
    alt: "Stratosphere mobile progress and action item list",
    label: "Progress tracking",
  },
];

export default function Home() {
  return (
    <BackgroundShell className="min-h-screen overflow-hidden text-white">
      <main className="relative z-10">
        <section className="relative flex min-h-[92vh] items-center px-6 py-20">
          <RhythmIllustration className="pointer-events-none absolute left-1/2 top-1/2 h-[560px] w-[980px] -translate-x-1/2 -translate-y-1/2 opacity-35" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(10,10,10,0.48)_44%,#0a0a0a_84%)]" />
          <div className="relative mx-auto grid w-full max-w-6xl gap-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
            <div className="max-w-3xl">
              <p className="text-sm font-bold uppercase text-sky-300">Stratosphere</p>
              <h1 className="mt-5 text-5xl font-black leading-tight sm:text-7xl">
                A calmer way to choose, reflect, and finish your day.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-neutral-300">
                Stratosphere helps you plan action items, record how they felt, and use those reflections to make
                better decisions tomorrow.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link
                  href="/signup"
                  className="rounded-lg bg-sky-600 px-6 py-3 font-bold transition-colors hover:bg-sky-500"
                >
                  Get started
                </Link>
                <Link
                  href="/login"
                  className="rounded-lg border border-neutral-600 px-6 py-3 font-bold transition-colors hover:border-neutral-400"
                >
                  Sign in
                </Link>
                <Link
                  href="/contact"
                  className="rounded-lg border border-neutral-700 px-6 py-3 font-bold text-neutral-200 transition-colors hover:border-neutral-500"
                >
                  Contact us
                </Link>
              </div>
              <div className="mt-6 inline-flex items-center gap-3 rounded-lg border border-white/10 bg-neutral-950/80 px-4 py-3 shadow-lg shadow-black/20">
                <img
                  src="/appstore.png"
                  alt=""
                  className="h-11 w-11 rounded-lg"
                />
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-400">Available on</p>
                  <p className="text-lg font-black leading-tight text-white">App Store</p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-neutral-950/80 p-5 shadow-xl shadow-black/20 backdrop-blur">
              <p className="text-sm font-bold text-neutral-300">Today</p>
              <div className="mt-5 space-y-3">
                {["Review action items", "Add reflection", "Ask coach for next step"].map((item, index) => (
                  <div key={item} className="flex items-center gap-3 rounded-lg bg-neutral-900 p-3">
                    <span className="grid h-8 w-8 place-items-center rounded-md bg-sky-600 text-sm font-black">
                      {index + 1}
                    </span>
                    <span className="text-sm font-semibold text-neutral-100">{item}</span>
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-lg border border-emerald-800/70 bg-emerald-950/40 p-4">
                <p className="text-sm font-bold text-emerald-200">Reflection</p>
                <p className="mt-2 text-sm text-emerald-100/80">
                  Calm, hopeful, and ready to close the loop.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto grid w-full max-w-6xl gap-4 px-6 py-12 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <article key={feature.title} className="rounded-lg border border-white/10 bg-neutral-950/70 p-5">
              <h2 className="text-lg font-black">{feature.title}</h2>
              <p className="mt-3 text-sm leading-6 text-neutral-400">{feature.body}</p>
            </article>
          ))}
        </section>

        <section className="mx-auto w-full max-w-6xl px-6 py-14">
          <div className="max-w-2xl">
            <p className="text-sm font-bold uppercase text-sky-300">Mobile experience</p>
            <h2 className="mt-3 text-3xl font-black">Your day, reflections, and progress in one iPhone app.</h2>
            <p className="mt-4 text-neutral-400">
              Open with a calm brand experience, review scheduled priorities on the calendar, and track completed work
              alongside the reflections that shaped it.
            </p>
          </div>
          <div className="mt-10 grid items-end gap-6 md:grid-cols-3">
            {appScreenshots.map((screenshot, index) => (
              <figure
                key={screenshot.src}
                className={`mx-auto w-full max-w-[280px] ${
                  index === 1 ? "md:-translate-y-6" : ""
                }`}
              >
                <div className="aspect-[9/19] overflow-hidden rounded-[2rem] border border-white/10 bg-neutral-950 shadow-2xl shadow-black/50">
                  <img
                    src={screenshot.src}
                    alt={screenshot.alt}
                    className="h-full w-full object-cover object-top"
                  />
                </div>
                <figcaption className="mt-4 text-center text-sm font-bold text-neutral-300">
                  {screenshot.label}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section className="mx-auto grid w-full max-w-6xl gap-8 px-6 py-14 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div>
            <p className="text-sm font-bold uppercase text-sky-300">Partnerships</p>
            <h2 className="mt-3 text-3xl font-black">Looking for business integration or team access?</h2>
            <p className="mt-4 max-w-2xl text-neutral-400">
              Contact us for sales, workplace pilots, wellbeing programs, or custom productivity workflows. For
              product support, signed-in users can raise a ticket from Settings.
            </p>
          </div>
          <div className="rounded-lg border border-white/10 bg-neutral-950/80 p-5">
            <ContactForm source="marketing" />
          </div>
        </section>
        <footer className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-8 text-sm text-neutral-500">
          <span>Stratosphere recruiter demonstration</span>
          <Link href="/privacy" className="hover:text-neutral-300">Privacy</Link>
        </footer>
      </main>
    </BackgroundShell>
  );
}
