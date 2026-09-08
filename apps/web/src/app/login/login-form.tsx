"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";

import { Button } from "@/components/ui";
import { getToken, login } from "@/lib/auth";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // already signed in → straight to the app
  useEffect(() => {
    if (getToken()) router.replace("/pulse");
  }, [router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email.trim(), password);
      router.replace("/pulse");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-6">
      <div className="w-full max-w-[380px]">
        <div className="mb-6 flex items-center gap-3">
          <div className="h-8 w-8 rounded-md bg-accent" />
          <div>
            <div className="text-[15px] font-semibold tracking-wide">
              SWING<span className="text-text-muted">/NSE</span>
            </div>
            <div className="text-[11px] text-text-muted">Swing &amp; momentum screener</div>
          </div>
        </div>

        <form
          onSubmit={onSubmit}
          className="rounded-lg border border-border bg-surface p-5 shadow-[0_1px_2px_rgba(9,9,11,0.04)]"
        >
          <h1 className="text-[15px] font-semibold">Sign in</h1>
          <p className="mt-1 text-[11px] text-text-muted">Use your terminal credentials.</p>

          <label className="mt-4 block">
            <span className="text-[11px] text-text-secondary">Email</span>
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 h-9 w-full rounded-md border border-border bg-bg px-2.5 text-[13px] focus:border-accent focus:outline-none"
            />
          </label>

          <label className="mt-3 block">
            <span className="text-[11px] text-text-secondary">Password</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 h-9 w-full rounded-md border border-border bg-bg px-2.5 text-[13px] focus:border-accent focus:outline-none"
            />
          </label>

          {error && (
            <div
              role="alert"
              className="mt-3 rounded-md border border-[rgba(220,38,38,0.28)] bg-[rgba(220,38,38,0.08)] px-2.5 py-2 text-[11px] text-down-text"
            >
              {error}
            </div>
          )}

          <Button type="submit" disabled={busy} className="mt-4 w-full">
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}
