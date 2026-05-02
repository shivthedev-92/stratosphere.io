// ############################################################################
// #    _____ __             __                   __                     _     
// #   / ___// /__________ _/ /_____  _________  / /_  ___  ________    (_)___ 
// #   \__ \/ __/ ___/ __ `/ __/ __ \/ ___/ __ \/ __ \/ _ \/ ___/ _ \  / / __ \
// #  ___/ / /_/ /  / /_/ / /_/ /_/ (__  ) /_/ / / / /  __/ /  /  __/ / / /_/ /
// # /____/\__/_/   \__,_/\__/\____/____/ .___/_/ /_/\___/_/   \___(_)_/\____/ 
// #                                   /_/                                     
// ############################################################################
// # Copyright (c) 2024. Sivarajan kakamaniyan. All rights reserved.
// # Statosphere is a product of Sivarajan Kakamaniyan. 
// # Unauthorized copying of this file, via any medium is strictly prohibited.
// # Version 0.1.0 | 2024-06
// ############################################################################

import Link from "next/link";
import { RhythmIllustration } from "@/components/illustrations";

const QUOTE = "The secret of getting ahead is getting started.";

/** 
 * Home page component for the Stratosphere application.
 * This component renders the main landing page with a hero section and call-to-action buttons.
 */

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col overflow-hidden bg-neutral-950 text-white">
      <section className="relative flex flex-1 items-center justify-center px-6 py-20 text-center sm:py-24">
        <RhythmIllustration className="pointer-events-none absolute inset-x-1/2 top-1/2 h-[520px] w-[920px] -translate-x-1/2 -translate-y-1/2 opacity-35 blur-[0.2px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(10,10,10,0.42)_44%,#0a0a0a_82%)]" />
        <div className="relative z-10 flex max-w-3xl flex-col items-center gap-6">
          <span className="text-xs font-semibold uppercase tracking-widest text-sky-300">
            Your daily rhythm, redefined
          </span>
          <h1 className="text-4xl font-bold leading-tight sm:text-6xl">
            Build habits on your terms.{" "}
            <span className="text-emerald-300">No guilt. No pressure.</span>
          </h1>
          <blockquote className="max-w-xl text-lg italic text-neutral-300">
            &ldquo;{QUOTE}&rdquo;
          </blockquote>
          <div className="mt-4 flex flex-wrap justify-center gap-4">
          <Link
            href="/signup"
            className="rounded-lg bg-indigo-600 px-6 py-3 font-semibold transition-colors hover:bg-indigo-500"
          >
            Get started — it&apos;s free
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-neutral-600 px-6 py-3 font-semibold transition-colors hover:border-neutral-400"
          >
            Sign in
          </Link>
          </div>
        </div>
      </section>

      <footer className="relative z-10 px-4 pb-8 text-center text-xs text-neutral-600">
        Advice is based entirely on behaviour you choose to share. Any outcome rests with you, not this app.
      </footer>
    </main>
  );
}
