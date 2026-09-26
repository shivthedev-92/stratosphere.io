import Link from "next/link";
import { BackgroundShell } from "@/components/background-shell";

export default function PrivacyPage() {
  return (
    <BackgroundShell className="min-h-screen px-5 py-12 text-white" showSwitcher>
      <main className="relative z-10 mx-auto max-w-3xl rounded-lg border border-white/10 bg-neutral-950/80 p-6 sm:p-10">
        <h1 className="text-3xl font-black">Privacy notice</h1>
        <p className="mt-2 text-sm text-neutral-500">Last updated: June 24, 2026</p>

        <div className="mt-8 space-y-6 text-sm leading-7 text-neutral-300">
          <section>
            <h2 className="text-lg font-bold text-white">Data we store</h2>
            <p className="mt-2">
              Stratosphere stores account details, tasks, reflections, chat history, notification state, and support
              requests that you submit. Passwords are stored as one-way hashes.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-white">How data is used</h2>
            <p className="mt-2">
              Data is used to provide the application and respond to support requests. If the AI coach is enabled,
              relevant tasks, reflections, and chat messages are sent to the configured AI provider to produce a reply.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-white">Deletion and security</h2>
            <p className="mt-2">
              Signed-in users can permanently delete their account from Settings. The service uses encrypted HTTPS
              connections and restricted authentication cookies, but no internet service can guarantee absolute security.
              Do not enter highly sensitive medical, financial, or identity information into this demonstration.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-white">Contact</h2>
            <p className="mt-2">
              Use the <Link href="/contact" className="text-sky-300 hover:text-sky-200">contact form</Link> for privacy
              questions or deletion requests you cannot complete in the application.
            </p>
          </section>
        </div>

        <Link href="/" className="mt-8 inline-block font-semibold text-indigo-300 hover:text-indigo-200">
          Return home
        </Link>
      </main>
    </BackgroundShell>
  );
}
