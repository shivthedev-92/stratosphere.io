"use client";

import { useEffect, useRef, useState } from "react";
import { api, type TelegramStatusOut } from "@/lib/api";

const POLL_MS = 3000;

/**
 * Connect / disconnect Telegram reminders.
 *
 * Linking is a round trip through Telegram: we fetch a one-time link, the
 * user opens it and presses Start, and the bot links the chat. We poll the
 * status until that lands (or the 10-minute link expires). The link is shown
 * as a button rather than opened automatically, because browsers block
 * pop-ups that are not a direct result of a click.
 */
export function TelegramSettings() {
  const [status, setStatus] = useState<TelegramStatusOut | null>(null);
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const timer = useRef<number | null>(null);

  const stopPolling = () => {
    if (timer.current !== null) window.clearInterval(timer.current);
    timer.current = null;
  };

  useEffect(() => {
    api.telegramStatus().then(setStatus).catch(() => setStatus(null));
    return stopPolling;
  }, []);

  useEffect(() => {
    if (!linkUrl || !expiresAt) return;
    timer.current = window.setInterval(async () => {
      if (Date.now() > expiresAt) {
        stopPolling();
        setLinkUrl(null);
        setError("That link expired. Choose Connect Telegram to get a new one.");
        return;
      }
      try {
        const next = await api.telegramStatus();
        if (next.linked) {
          stopPolling();
          setLinkUrl(null);
          setStatus(next);
        }
      } catch {
        // transient; keep polling until expiry
      }
    }, POLL_MS);
    return stopPolling;
  }, [linkUrl, expiresAt]);

  async function connect() {
    setBusy(true);
    setError("");
    try {
      const link = await api.telegramLink();
      setLinkUrl(link.url);
      setExpiresAt(new Date(link.expires_at).getTime());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not create a Telegram link");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    setError("");
    try {
      await api.telegramUnlink();
      setStatus(await api.telegramStatus());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not disconnect Telegram");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 rounded-lg border border-white/10 bg-neutral-950/60 p-4">
      <h3 className="text-base font-bold">Telegram reminders</h3>
      <p className="mt-1 text-sm text-neutral-400">
        Get a Telegram message when a timed task is due. Messages show the task title only,
        never your notes or reflections.
      </p>

      {status === null ? (
        <p className="mt-4 text-sm text-neutral-500">Loading…</p>
      ) : !status.available ? (
        <p className="mt-4 text-sm text-neutral-500">
          Telegram reminders aren&apos;t set up on this server yet.
        </p>
      ) : status.linked ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-emerald-700/60 bg-emerald-950/40 px-3 py-1 text-xs font-semibold text-emerald-300">
            Connected
          </span>
          <button
            type="button"
            onClick={disconnect}
            disabled={busy}
            className="rounded-lg border border-neutral-700 px-4 py-2 text-sm font-semibold hover:border-neutral-500 disabled:opacity-50"
          >
            Disconnect
          </button>
        </div>
      ) : linkUrl ? (
        <div className="mt-4 space-y-3">
          <a
            href={linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500"
          >
            Open Telegram
          </a>
          <p className="text-sm text-neutral-400">
            Press <span className="font-semibold text-neutral-200">Start</span> in the chat that
            opens. This page updates on its own once you&apos;re connected. The link works for
            10 minutes.
          </p>
        </div>
      ) : (
        <button
          type="button"
          onClick={connect}
          disabled={busy}
          className="mt-4 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
        >
          Connect Telegram
        </button>
      )}

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </div>
  );
}
