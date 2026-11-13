"use client";

import { LogOut, Menu, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface MarketSnap {
  marketRegime: string | null;
  nifty50Close: number | null;
  nifty50ChangePct: number | null;
  indiaVix: number | null;
  asOf: string | null;
}

interface TopBarProps {
  onOpenMobileMenu?: () => void;
}

/**
 * 56px sticky top bar — fully responsive across mobile, tablet, and desktop.
 */
export function TopBar({ onOpenMobileMenu }: TopBarProps) {
  const router = useRouter();
  const [market, setMarket] = useState<MarketSnap | null>(null);
  const [currentTime, setCurrentTime] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch market header data from the V2 API
  useEffect(() => {
    let cancelled = false;
    async function fetchMarket() {
      try {
        const res = await fetch("/api/terminal/data");
        if (!res.ok) return;
        const json = await res.json();
        const b = json?.breadth ?? json ?? {};
        if (!cancelled) {
          setMarket({
            marketRegime: b.marketRegime ?? null,
            nifty50Close: b.nifty50Close ?? null,
            nifty50ChangePct: b.nifty50ChangePct ?? null,
            indiaVix: b.indiaVix ?? null,
            asOf: json?.asOf ?? null,
          });
        }
      } catch {
        // silently skip
      }
    }
    fetchMarket();
    const id = setInterval(fetchMarket, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // IST clock
  useEffect(() => {
    function tick() {
      setCurrentTime(
        new Date().toLocaleTimeString("en-IN", {
          timeZone: "Asia/Kolkata",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }) + " IST"
      );
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // ⌘K / Ctrl+K shortcut
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/login");
  };

  return (
    <>
      <header className="sticky top-0 z-30 flex h-[56px] w-full items-center gap-2 sm:gap-4 border-b border-border bg-surface/95 px-3 sm:px-6 backdrop-blur-sm">
        {/* Mobile menu button */}
        {onOpenMobileMenu && (
          <button
            onClick={onOpenMobileMenu}
            aria-label="Open navigation menu"
            className="md:hidden p-1.5 rounded-md text-text-secondary hover:text-text hover:bg-surface-2 transition-colors"
          >
            <Menu size={20} />
          </button>
        )}

        {/* Mobile Brand */}
        <div className="md:hidden flex items-center gap-1.5 mr-1">
          <div className="h-5 w-5 rounded-md bg-accent" />
          <span className="text-xs font-bold font-mono tracking-wide">
            SWING<span className="text-accent">/NSE</span>
          </span>
        </div>

        {/* Search trigger */}
        <button
          onClick={() => setSearchOpen(true)}
          className="flex h-[36px] flex-1 max-w-[260px] sm:max-w-[300px] items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 text-xs sm:text-sm text-text-secondary hover:text-text hover:border-accent transition-colors shadow-2xs"
        >
          <Search size={15} className="shrink-0 text-text-muted" />
          <span className="truncate font-medium">Search symbol… (⌘K)</span>
          <span className="hidden sm:flex ml-auto gap-1 shrink-0">
            <kbd className="rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[11px] font-semibold text-text-secondary shadow-2xs">
              ⌘
            </kbd>
            <kbd className="rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[11px] font-semibold text-text-secondary shadow-2xs">
              K
            </kbd>
          </span>
        </button>

        {/* Market indices — Nifty50 + India VIX */}
        {market && (
          <div className="hidden lg:flex items-center gap-4 text-xs sm:text-sm font-mono ml-3">
            {market.nifty50Close != null && (
              <div className="flex items-center gap-2 bg-surface border border-border px-3 py-1 rounded-md shadow-2xs">
                <span className="text-text-muted font-bold text-xs uppercase">NIFTY 50:</span>
                <span className="font-bold text-text">
                  {market.nifty50Close.toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
                {market.nifty50ChangePct != null && (
                  <span
                    className={`text-xs font-bold ${
                      market.nifty50ChangePct >= 0 ? "text-emerald-700" : "text-rose-700"
                    }`}
                  >
                    ({market.nifty50ChangePct >= 0 ? "+" : ""}
                    {market.nifty50ChangePct.toFixed(2)}%)
                  </span>
                )}
              </div>
            )}
            {market.indiaVix != null && (
              <div className="flex items-center gap-2 bg-surface border border-border px-3 py-1 rounded-md shadow-2xs">
                <span className="text-text-muted font-bold text-xs uppercase">VIX:</span>
                <span className="font-bold text-indigo-700">
                  {market.indiaVix.toFixed(2)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* IST clock */}
        <span className="hidden sm:inline font-mono text-xs font-semibold text-text-muted ml-auto">
          {currentTime || "—"}
        </span>

        {/* Logout */}
        <div className="flex items-center gap-1 sm:gap-2 ml-auto sm:ml-0">
          <button
            onClick={handleLogout}
            title="Sign out"
            aria-label="Sign out"
            className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:text-down-text hover:bg-surface-2 transition-colors"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Search Modal */}
      {searchOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/40 backdrop-blur-xs"
          onClick={() => setSearchOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-xl border border-border bg-surface p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 border-b border-border pb-3 mb-3">
              <Search size={16} className="text-text-muted shrink-0" />
              <input
                autoFocus
                placeholder="Type symbol (e.g. RELIANCE, TCS, LOTUSDEV)…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && searchQuery.trim()) {
                    setSearchOpen(false);
                    const q = searchQuery.trim();
                    setSearchQuery("");
                    router.push(`/stock/${q}`);
                  }
                  if (e.key === "Escape") setSearchOpen(false);
                }}
                className="w-full bg-transparent text-sm focus:outline-none font-mono text-text placeholder-text-muted"
              />
            </div>
            <div className="flex justify-between font-mono text-[11px] text-text-muted">
              <span>Press ENTER to open stock workbench</span>
              <span>ESC to close</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default TopBar;