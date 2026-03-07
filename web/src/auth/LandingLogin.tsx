import { useState } from "react";
import type { FormEvent } from "react";
import { Background, BackgroundVariant, ReactFlow } from "@xyflow/react";
import {
  createDevBypassSession,
  isDevAuthBypassEnabled,
  requestEmailOtp,
  type AuthSession,
  verifyEmailOtp,
} from "../lib/auth";

type LandingLoginProps = {
  onSuccess: (session: AuthSession) => void;
};

export default function LandingLogin({ onSuccess }: LandingLoginProps) {
  const devBypassEnabled = isDevAuthBypassEnabled();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sentCode, setSentCode] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleRequestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return;

    if (devBypassEnabled) {
      setEmail(normalizedEmail);
      setSentCode(true);
      setErrorMessage(null);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await requestEmailOtp(normalizedEmail);
      setEmail(normalizedEmail);
      setSentCode(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send code";
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedCode = code.trim();
    if (!normalizedCode) return;

    if (devBypassEnabled) {
      const session = createDevBypassSession(email);
      onSuccess(session);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const session = await verifyEmailOtp({ email, code: normalizedCode });
      onSuccess(session);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to verify code";
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-(--canvas-bg) text-(--panel-fg)">
      <div className="absolute inset-0">
        <ReactFlow
          nodes={[]}
          edges={[]}
          fitView
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag={false}
          zoomOnScroll={false}
          zoomOnPinch={false}
          zoomOnDoubleClick={false}
          preventScrolling={false}
          style={{ backgroundColor: "var(--canvas-bg)" }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={18}
            size={1.5}
            color="var(--flow-grid-dots)"
          />
        </ReactFlow>
      </div>
      <div className="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center px-6 py-10">
        <section
          className="relative z-10 w-full max-w-md rounded-2xl border border-(--control-border) bg-(--panel-bg) p-6 shadow-(--shadow-3) backdrop-blur-sm sm:p-7"
          style={{ boxShadow: "0 0 0 1px var(--control-border), 0 16px 44px rgba(139, 92, 246, 0.28)" }}
        >
          <div className="mb-6 text-center">
            <h1 className="text-3xl font-semibold tracking-tight text-(--panel-fg) sm:text-4xl">
              branchLM
            </h1>
          </div>

          {!sentCode ? (
            <form className="space-y-3.5" onSubmit={handleRequestCode}>
              <label
                className="block text-xs font-medium text-(--panel-fg) sm:text-sm"
                htmlFor="email"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@domain.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-lg border border-(--control-border) bg-(--control-bg) px-3.5 py-2.5 text-sm text-(--control-fg) outline-none transition focus:border-(--button-border-hover) focus:ring-4 focus:ring-(--focus-ring)"
              />
              {errorMessage ? (
                <p className="text-xs text-red-300">{errorMessage}</p>
              ) : (
                <p className="text-xs text-(--panel-muted)">
                  {devBypassEnabled
                    ? "DEV MODE: email delivery bypass is active."
                    : "We&apos;ll email you a one-time sign-in code."}
                </p>
              )}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-lg border border-(--button-border) bg-(--button-bg) px-3.5 py-2.5 text-sm font-medium text-(--button-fg) transition hover:border-(--button-border-hover) hover:bg-(--button-bg-hover) focus:outline-none focus:ring-4 focus:ring-(--focus-ring) disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? "Sending..." : "Send code"}
              </button>
            </form>
          ) : (
            <form className="space-y-3.5" onSubmit={handleVerifyCode}>
              <label
                className="block text-xs font-medium text-(--panel-fg) sm:text-sm"
                htmlFor="code"
              >
                Verification code
              </label>
              <input
                id="code"
                name="code"
                type="text"
                required
                autoComplete="one-time-code"
                inputMode="numeric"
                placeholder="123456"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                className="w-full rounded-lg border border-(--control-border) bg-(--control-bg) px-3.5 py-2.5 text-sm text-(--control-fg) outline-none transition focus:border-(--button-border-hover) focus:ring-4 focus:ring-(--focus-ring)"
              />
              <p className="text-xs text-(--panel-muted)">
                Enter the code sent to {email}.
              </p>
              {errorMessage ? <p className="text-xs text-red-300">{errorMessage}</p> : null}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-lg border border-(--button-border) bg-(--button-bg) px-3.5 py-2.5 text-sm font-medium text-(--button-fg) transition hover:border-(--button-border-hover) hover:bg-(--button-bg-hover) focus:outline-none focus:ring-4 focus:ring-(--focus-ring) disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? "Verifying..." : "Verify code"}
              </button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
