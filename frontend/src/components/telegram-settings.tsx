"use client";

import { Check, Copy } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { QrCode } from "@/components/qr-code";
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
 *
 * Three ways in, because the Start button is easy to miss: the button (best
 * on a phone), a QR code (on a computer: scan it and Telegram opens on the
 * phone, where reminders are read), and a "/start <code>" command to copy
 * and send by hand. When a chat with the bot already exists, Telegram only
 * sends the code after START/RESTART is tapped at the bottom of the chat.
 */

const timeShort = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

/** "https://t.me/<bot>?start=<code>" → { bot, command: "/start <code>" }. */
function parseLink(url: string): { bot: string; command: string } | null {
  try {
    const parsed = new URL(url);
    const code = parsed.searchParams.get("start");
    const bot = parsed.pathname.replace(/^\//, "");
    return code && bot ? { bot, command: `/start ${code}` } : null;
  } catch {
    return null;
  }
}
export function TelegramSettings() {
  const [status, setStatus] = useState<TelegramStatusOut | null>(null);
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Set when the initial status check fails, so the card offers a retry
  // instead of showing "Loading…" forever.
  const [loadFailed, setLoadFailed] = useState(false);
  const timer = useRef<number | null>(null);
  // Computers (fine pointer) get a QR code; a phone can't scan its own screen.
  const [showQr, setShowQr] = useState(false);
  const [copied, setCopied] = useState(false);
  const commandField = useRef<HTMLInputElement>(null);
  const [testState, setTestState] = useState<"idle" | "sending" | "sent">("idle");
  const [testMessage, setTestMessage] = useState("");

  useEffect(() => {
    setShowQr(window.matchMedia("(pointer: fine)").matches);
  }, []);

  const stopPolling = () => {
    if (timer.current !== null) window.clearInterval(timer.current);
    timer.current = null;
  };

  const loadStatus = () => {
    setLoadFailed(false);
    api
      .telegramStatus()
      .then(setStatus)
      .catch(() => setLoadFailed(true));
  };

  useEffect(() => {
    loadStatus();
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

  async function copyCommand(command: string) {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: select the text so it can be copied by hand.
      commandField.current?.select();
    }
  }

  async function sendTest() {
    setTestState("sending");
    setTestMessage("");
    try {
      await api.telegramTest();
      setTestState("sent");
      setTestMessage("Sent. Check Telegram: it should arrive within a few seconds.");
    } catch (err: unknown) {
      setTestState("idle");
      setTestMessage(err instanceof Error ? err.message : "Could not send a test message");
      // A blocked bot unlinks the chat on the server; show the new state.
      api.telegramStatus().then(setStatus).catch(() => undefined);
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
    <div className="mt-6 rounded-card border border-line bg-surface p-4">
      <h3 className="text-base font-bold">Telegram reminders</h3>
      <p className="mt-1 text-sm text-fg-muted">
        Get a Telegram message when a timed task is due. Messages show the task title only,
        never your notes or reflections.
      </p>

      {loadFailed ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p className="text-sm text-danger">Couldn&apos;t load your Telegram settings.</p>
          <button
            type="button"
            onClick={loadStatus}
            className="rounded-control border border-line-strong px-4 py-2 text-sm font-semibold hover:border-fg-subtle"
          >
            Retry
          </button>
        </div>
      ) : status === null ? (
        <p className="mt-4 text-sm text-fg-subtle">Loading…</p>
      ) : !status.available ? (
        <p className="mt-4 text-sm text-fg-subtle">
          Telegram reminders aren&apos;t set up on this server yet.
        </p>
      ) : status.linked ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-low/30 bg-low-bg px-3 py-1 text-xs font-semibold text-low">
            Connected
          </span>
          <button
            type="button"
            onClick={sendTest}
            disabled={testState === "sending"}
            className="rounded-control border border-line-strong px-4 py-2 text-sm font-semibold hover:border-fg-subtle disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {testState === "sending" ? "Sending…" : "Send test message"}
          </button>
          <button
            type="button"
            onClick={disconnect}
            disabled={busy}
            className="rounded-control border border-line-strong px-4 py-2 text-sm font-semibold hover:border-fg-subtle disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Disconnect
          </button>
        </div>
      ) : linkUrl ? (
        <LinkSteps
          url={linkUrl}
          expiresAt={expiresAt}
          showQr={showQr}
          copied={copied}
          commandField={commandField}
          onCopy={copyCommand}
        />
      ) : (
        <button
          type="button"
          onClick={connect}
          disabled={busy}
          className="mt-4 rounded-control bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Connect Telegram
        </button>
      )}

      {testMessage && status?.linked ? (
        <p role="status" className={`mt-3 text-sm ${testState === "sent" ? "text-fg-muted" : "text-danger"}`}>
          {testMessage}
        </p>
      ) : null}
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
    </div>
  );
}

function LinkSteps({
  url,
  expiresAt,
  showQr,
  copied,
  commandField,
  onCopy,
}: {
  url: string;
  expiresAt: number | null;
  showQr: boolean;
  copied: boolean;
  commandField: React.RefObject<HTMLInputElement | null>;
  onCopy: (command: string) => void;
}) {
  const parsed = parseLink(url);
  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap items-start gap-5">
        <div className="max-w-sm space-y-3">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-control bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover"
          >
            Open Telegram
          </a>
          <p className="text-sm text-fg-muted">
            Tap <span className="font-semibold text-fg">START</span> in the chat that opens. Chatted with
            the bot before? Tap <span className="font-semibold text-fg">START</span> or{" "}
            <span className="font-semibold text-fg">RESTART</span> at the bottom of the chat.
          </p>
          <p className="text-xs text-fg-subtle">
            This page updates on its own once you&apos;re connected.
            {expiresAt ? ` The link works until ${timeShort.format(expiresAt)}.` : ""}
          </p>
        </div>
        {showQr ? (
          <figure className="space-y-2">
            <QrCode value={url} label="QR code that opens the Stratosphere bot in Telegram" />
            <figcaption className="max-w-[168px] text-xs text-fg-subtle">
              Or scan with your phone&apos;s camera to connect on your phone.
            </figcaption>
          </figure>
        ) : null}
      </div>

      {parsed ? (
        <div className="rounded-control border border-line bg-field p-3">
          <p className="text-sm text-fg-muted">
            Button not working? Send this message to{" "}
            <span className="font-semibold text-fg">@{parsed.bot}</span> in Telegram:
          </p>
          <div className="mt-2 flex gap-2">
            <input
              ref={commandField}
              readOnly
              value={parsed.command}
              aria-label="Command to send to the bot"
              onFocus={(event) => event.currentTarget.select()}
              className="min-w-0 flex-1 rounded-control border border-line-strong bg-surface-solid px-3 py-2 font-mono text-xs text-fg"
            />
            <button
              type="button"
              onClick={() => onCopy(parsed.command)}
              className="inline-flex items-center gap-1.5 rounded-control border border-line-strong px-3 py-2 text-sm font-semibold hover:border-fg-subtle"
            >
              {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
