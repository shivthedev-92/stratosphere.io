import Link from "next/link";
import { BackgroundShell } from "@/components/background-shell";

export default function PrivacyPage() {
  return (
    <BackgroundShell className="min-h-screen px-5 py-12 text-fg" showSwitcher>
      <main className="relative z-10 mx-auto max-w-3xl rounded-card border border-line bg-surface p-6 sm:p-10">
        <h1 className="text-3xl font-black">Privacy notice</h1>
        <p className="mt-2 text-sm text-fg-subtle">Last updated: September 26, 2026</p>

        <div className="mt-8 space-y-6 text-sm leading-7 text-fg-muted">
          <section>
            <h2 className="text-lg font-bold text-fg">Data we store</h2>
            <p className="mt-2">
              Stratosphere stores account details, tasks, reflections, chat history, notification state, and support
              requests that you submit. Passwords, for accounts that have one, are stored as one-way hashes.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-fg">Signing in with Google or Microsoft</h2>
            <p className="mt-2">
              When you continue with Google or Microsoft, that company confirms who you are and shares your name, email
              address and an account ID with us. We never see your Google or Microsoft password, and we don&apos;t get
              access to your email, contacts or files.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-fg">Services that receive your data</h2>
            <ul className="mt-2 list-disc space-y-2 pl-5">
              <li>
                <span className="font-semibold text-fg">Anthropic (Claude)</span> powers Aster, the AI coach. When you
                chat, your message, recent conversation, and relevant tasks and reflections are sent to Anthropic to
                write the reply. Anthropic&apos;s commercial terms don&apos;t allow it to train its models on this data.
                Messages that trigger our crisis safety check are never sent to the AI.
              </li>
              <li>
                <span className="font-semibold text-fg">Telegram</span>, only if you connect it in Settings, delivers
                your reminders. It receives your first name and the task title, nothing else. You can disconnect at any time.
              </li>
              <li>
                <span className="font-semibold text-fg">Microsoft Azure</span> hosts the app and its database in India.
                Nightly database backups are kept in encrypted Azure storage for 30 days.
              </li>
            </ul>
          </section>
          <section>
            <h2 className="text-lg font-bold text-fg">Deletion and security</h2>
            <p className="mt-2">
              Signed-in users can permanently delete their account from Settings. Deleted data can remain in backups for up to 30 days, until those backups expire. The service uses encrypted HTTPS
              connections and restricted authentication cookies, but no internet service can guarantee absolute security.
              Please don&apos;t enter highly sensitive medical, financial or identity information.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-fg">Contact</h2>
            <p className="mt-2">
              Use the <Link href="/contact" className="text-accent-soft hover:text-fg">contact form</Link> for privacy
              questions or deletion requests you cannot complete in the application.
            </p>
          </section>
        </div>

        <Link href="/" className="mt-8 inline-block font-semibold text-accent-soft hover:text-accent-soft">
          Return home
        </Link>
      </main>
    </BackgroundShell>
  );
}
