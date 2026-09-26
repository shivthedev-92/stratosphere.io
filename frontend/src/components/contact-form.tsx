"use client";

import { FormEvent, useState } from "react";
import { api } from "@/lib/api";

type ContactFormProps = {
  defaultName?: string;
  defaultEmail?: string;
  source?: "web" | "marketing";
};

export function ContactForm({ defaultName = "", defaultEmail = "", source = "web" }: ContactFormProps) {
  const [name, setName] = useState(defaultName);
  const [email, setEmail] = useState(defaultEmail);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!subject.trim() || !message.trim()) return;

    setSaving(true);
    setStatus("");
    setError("");
    try {
      await api.createSupportTicket({
        name: name.trim() || null,
        email: email.trim() || null,
        subject: subject.trim(),
        message: message.trim(),
        source,
      });
      setSubject("");
      setMessage("");
      setStatus("Thanks. Your support ticket has been received.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send your message.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm text-fg-muted">Name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={160}
            className="w-full rounded-control border border-line-strong bg-surface px-3 py-2 text-sm text-fg outline-none focus:border-accent"
            placeholder="Your name"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-fg-muted">Email</span>
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            className="w-full rounded-control border border-line-strong bg-surface px-3 py-2 text-sm text-fg outline-none focus:border-accent"
            placeholder="you@example.com"
          />
        </label>
      </div>
      <label className="block">
        <span className="mb-1 block text-sm text-fg-muted">Subject</span>
        <input
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          required
          minLength={3}
          maxLength={180}
          className="w-full rounded-control border border-line-strong bg-surface px-3 py-2 text-sm text-fg outline-none focus:border-accent"
          placeholder="What do you need help with?"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm text-fg-muted">Message</span>
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          required
          minLength={10}
          maxLength={4000}
          rows={5}
          className="w-full resize-none rounded-control border border-line-strong bg-surface px-3 py-2 text-sm text-fg outline-none focus:border-accent"
          placeholder="Share the issue, device, and what you expected to happen."
        />
      </label>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {status ? <p className="text-sm text-low">{status}</p> : null}
      <button
        type="submit"
        disabled={saving || !subject.trim() || message.trim().length < 10}
        className="rounded-control bg-accent px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {saving ? "Sending..." : "Raise ticket"}
      </button>
    </form>
  );
}
