import Link from "next/link";
import { BackgroundShell } from "@/components/background-shell";
import { ContactForm } from "@/components/contact-form";

export default function ContactPage() {
  return (
    <BackgroundShell className="min-h-screen text-fg">
      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-6 py-14">
        <Link href="/" className="mb-8 text-sm font-semibold text-accent-soft hover:text-fg">
          Back to Stratosphere
        </Link>
        <section className="rounded-card border border-line bg-surface p-6 shadow-xl shadow-tint backdrop-blur">
          <p className="text-sm font-bold uppercase text-accent-soft">Contact us</p>
          <h1 className="mt-3 text-3xl font-black">Raise a support ticket</h1>
          <p className="mt-3 text-fg-muted">
            Tell us what happened and we will use the details to follow up, debug, or plan the next improvement.
          </p>
          <div className="mt-8">
            <ContactForm source="marketing" />
          </div>
        </section>
      </main>
    </BackgroundShell>
  );
}
