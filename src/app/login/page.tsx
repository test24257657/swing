"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, TrendingUp, ArrowRight, ShieldCheck, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Authentication failed");
        setLoading(false);
        return;
      }

      router.push("/");
    } catch {
      setError("Connection error. Ensure server is active.");
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-4"
      style={{ backgroundColor: "var(--color-bg)" }}
    >
      <div
        className="w-full max-w-md rounded-xl border p-8 shadow-lg"
        style={{
          backgroundColor: "var(--color-surface)",
          borderColor: "var(--color-border-strong)",
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{
              backgroundColor: "var(--color-accent-tint)",
              border: "1px solid var(--color-accent-border)",
            }}
          >
            <TrendingUp className="w-5 h-5" style={{ color: "var(--color-accent)" }} />
          </div>
          <div>
            <h1
              className="text-xl font-bold tracking-tight flex items-center gap-1.5"
              style={{ color: "var(--color-text)" }}
            >
              SWING
              <span style={{ color: "var(--color-accent)" }}>/NSE</span>
            </h1>
            <p
              className="text-xs font-mono uppercase tracking-wider"
              style={{ color: "var(--color-text-muted)" }}
            >
              Institutional Trading Workbench
            </p>
          </div>
        </div>

        {/* Info box */}
        <div
          className="mb-6 p-3 rounded-lg text-xs space-y-1"
          style={{
            backgroundColor: "var(--color-surface-2)",
            border: "1px solid var(--color-border)",
          }}
        >
          <div
            className="flex items-center gap-1.5 font-medium"
            style={{ color: "var(--color-text-secondary)" }}
          >
            <ShieldCheck className="w-4 h-4" style={{ color: "var(--color-up)" }} />
            <span>Private Personal Terminal</span>
          </div>
          <p style={{ color: "var(--color-text-muted)" }}>
            Restricted to authorized session. Enter terminal password.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div
            className="mb-4 p-3 rounded-lg text-xs flex items-center gap-2"
            style={{
              backgroundColor: "rgba(220,38,38,0.07)",
              border: "1px solid rgba(220,38,38,0.25)",
              color: "var(--color-down-text)",
            }}
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              className="block text-xs font-mono uppercase mb-1.5"
              style={{ color: "var(--color-text-muted)" }}
            >
              Terminal Access Password
            </label>
            <div className="relative">
              <input
                type="password"
                required
                autoFocus
                placeholder="Enter password..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg pl-9 pr-4 py-2.5 text-sm font-mono transition-all focus:outline-none"
                style={{
                  backgroundColor: "var(--color-surface-2)",
                  border: "1px solid var(--color-border-strong)",
                  color: "var(--color-text)",
                }}
              />
              <Lock
                className="w-4 h-4 absolute left-3 top-3"
                style={{ color: "var(--color-text-muted)" }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full font-semibold py-2.5 px-4 rounded-lg text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: "var(--color-accent)",
              color: "#ffffff",
            }}
          >
            <span>{loading ? "Verifying Session..." : "Access Terminal"}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div
          className="mt-8 pt-4 border-t text-center"
          style={{ borderColor: "var(--color-border)" }}
        >
          <span
            className="text-[11px] font-mono"
            style={{ color: "var(--color-text-muted)" }}
          >
            NSE & BSE Indian Equities • Quant & Momentum Systems
          </span>
        </div>
      </div>
    </div>
  );
}
