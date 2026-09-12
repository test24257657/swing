"use client";

import { Bell, LayoutGrid, List, Plus, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useQueryState } from "nuqs";
import { type FormEvent, useState } from "react";

import { Screen, ScreenHeader } from "@/components/screen/screen-header";
import { Button, Card, Chip, DataSourceFooter, EmptyState, Skeleton, Tooltip } from "@/components/ui";
import { ApiError } from "@/lib/api/client";
import type { AlertKind, WatchlistAlert, WatchlistItem } from "@/lib/api/market-types";
import {
  useAddAlert,
  useAddWatchlistItem,
  useRemoveAlert,
  useRemoveWatchlistItem,
  useUpdateAlert,
  useWatchlist,
} from "@/lib/api/watchlist-hooks";
import { cn } from "@/lib/cn";
import { direction, pct, price } from "@/lib/format";
import { toSlug } from "@/lib/slug";

function toneClass(v: number | null | undefined) {
  const d = direction(v);
  return d === "up" ? "text-up-text" : d === "down" ? "text-down-text" : "text-text-secondary";
}

function unrealizedPct(item: WatchlistItem): number | null {
  return item.entry_price && item.ltp ? (item.ltp / item.entry_price - 1) * 100 : null;
}

export function WatchlistClient() {
  const q = useWatchlist();
  const [viewParam, setViewParam] = useQueryState("view");
  const view = viewParam === "grid" ? "grid" : "list";
  const [expanded, setExpanded] = useState<number | null>(null);

  if (q.isPending) {
    return (
      <Screen>
        <ScreenHeader title="Watchlist" subtitle="Symbols you're tracking, with entry price and EOD alerts." />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </Screen>
    );
  }

  if (q.isError) {
    return (
      <Screen>
        <ScreenHeader title="Watchlist" />
        <EmptyState
          title="Could not load your watchlist"
          description={String((q.error as Error).message)}
          actions={<Button onClick={() => q.refetch()}>Retry</Button>}
        />
      </Screen>
    );
  }

  const items = q.data!.data;
  const meta = q.data!.meta;
  const triggered = items.reduce((n, it) => n + it.alerts.filter((a) => a.triggered_at).length, 0);

  return (
    <Screen>
      <ScreenHeader
        title="Watchlist"
        subtitle={
          <>
            <span className="tnum">{items.length}</span> symbol{items.length === 1 ? "" : "s"} tracked
            {triggered > 0 && (
              <>
                {" · "}
                <span className="text-up-text">
                  {triggered} alert{triggered === 1 ? "" : "s"} triggered
                </span>
                {" since last close"}
              </>
            )}
          </>
        }
        actions={
          <div className="flex gap-0.5 rounded-md border border-border bg-surface p-0.5">
            <button
              onClick={() => setViewParam(null)}
              className={cn(
                "flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium",
                view === "list" ? "bg-[var(--color-accent-tint)] text-accent-hover" : "text-text-secondary hover:text-text",
              )}
            >
              <List size={12} /> Table
            </button>
            <button
              onClick={() => setViewParam("grid")}
              className={cn(
                "flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium",
                view === "grid" ? "bg-[var(--color-accent-tint)] text-accent-hover" : "text-text-secondary hover:text-text",
              )}
            >
              <LayoutGrid size={12} /> Cards
            </button>
          </div>
        }
      />

      <AddSymbolForm />

      {items.length === 0 ? (
        <EmptyState
          title="Nothing on the watchlist yet"
          description="Watchlists work best when they come from a screen. Run the screener and add a few setups — alerts get configured as you add."
          actions={
            <Link href="/screener">
              <Button>Open screener</Button>
            </Link>
          }
        />
      ) : view === "grid" ? (
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <GridCard
              key={item.id}
              item={item}
              expanded={expanded === item.id}
              onToggleExpand={() => setExpanded((e) => (e === item.id ? null : item.id))}
            />
          ))}
        </div>
      ) : (
        <Card className="mt-2 overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[640px]">
              <div
                className="grid gap-2 border-b border-border px-4 py-1.5 text-[11px] text-text-muted"
                style={{ gridTemplateColumns: "1.6fr 0.8fr 0.8fr 0.9fr 1.6fr 90px" }}
              >
                <span>Symbol</span>
                <span className="text-right">Entry</span>
                <span className="text-right">LTP</span>
                <span className="text-right">Unrealised</span>
                <span>Alerts</span>
                <span />
              </div>
              {items.map((item) => (
                <Row
                  key={item.id}
                  item={item}
                  expanded={expanded === item.id}
                  onToggleExpand={() => setExpanded((e) => (e === item.id ? null : item.id))}
                />
              ))}
            </div>
          </div>
          <div className="border-t border-border px-4 py-2.5">
            <DataSourceFooter meta={meta} />
          </div>
        </Card>
      )}
    </Screen>
  );
}

function AddSymbolForm() {
  const addItem = useAddWatchlistItem();
  const [open, setOpen] = useState(false);
  const [symbol, setSymbol] = useState("");
  const [entry, setEntry] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    addItem.mutate(
      { symbol: symbol.trim(), entry_price: entry ? Number(entry) : null },
      {
        onSuccess: () => {
          setSymbol("");
          setEntry("");
          setOpen(false);
        },
        onError: (err) => setError(err instanceof ApiError ? err.detail : "Could not add symbol."),
      },
    );
  }

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)} className="mb-2">
        <Plus size={13} /> Add symbol
      </Button>
    );
  }

  return (
    <form onSubmit={submit} className="mb-2 flex flex-wrap items-end gap-2 rounded-md border border-border bg-surface p-3">
      <label className="block">
        <span className="text-[11px] text-text-muted">Symbol</span>
        <input
          autoFocus
          value={symbol}
          onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          placeholder="TATAMOTORS"
          className="tnum mt-1 block w-36 rounded-md border border-border bg-surface px-2 py-1.5 text-[13px] outline-none focus:border-accent"
        />
      </label>
      <label className="block">
        <span className="text-[11px] text-text-muted">Entry price (optional)</span>
        <input
          type="number"
          step={0.05}
          value={entry}
          onChange={(e) => setEntry(e.target.value)}
          className="tnum mt-1 block w-32 rounded-md border border-border bg-surface px-2 py-1.5 text-[13px] outline-none focus:border-accent"
        />
      </label>
      <Button type="submit" size="sm" disabled={!symbol.trim() || addItem.isPending}>
        Add
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
        Cancel
      </Button>
      {error && <span className="text-[12px] text-down-text">{error}</span>}
    </form>
  );
}

function AlertPanel({ item }: { item: WatchlistItem }) {
  const addAlert = useAddAlert();
  const updateAlert = useUpdateAlert();
  const removeAlert = useRemoveAlert();
  const [kind, setKind] = useState<AlertKind>("price_above");
  const [threshold, setThreshold] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!threshold) return;
    addAlert.mutate(
      { itemId: item.id, kind, threshold: Number(threshold) },
      { onSuccess: () => setThreshold("") },
    );
  }

  return (
    <div className="bg-surface-2 px-4 py-3">
      <div className="text-[11px] font-semibold tracking-wide text-text-secondary">ALERTS · {item.symbol}</div>
      <div className="mt-2 flex flex-col gap-1.5">
        {item.alerts.length === 0 && <p className="text-[12px] text-text-muted">No alerts yet.</p>}
        {item.alerts.map((a) => (
          <AlertRow key={a.id} alert={a} onToggle={(enabled) => updateAlert.mutate({ id: a.id, enabled })} onRemove={() => removeAlert.mutate(a.id)} />
        ))}
      </div>
      <form onSubmit={submit} className="mt-3 flex items-center gap-2">
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as AlertKind)}
          className="rounded-md border border-border bg-surface px-2 py-1.5 text-[12px] outline-none focus:border-accent"
        >
          <option value="price_above">Alert if price rises above</option>
          <option value="price_below">Alert if price falls below</option>
        </select>
        <input
          type="number"
          step={0.05}
          value={threshold}
          onChange={(e) => setThreshold(e.target.value)}
          placeholder="Price"
          className="tnum w-28 rounded-md border border-border bg-surface px-2 py-1.5 text-[12px] outline-none focus:border-accent"
        />
        <Button type="submit" size="sm" variant="secondary" disabled={!threshold || addAlert.isPending}>
          <Plus size={12} /> Add alert
        </Button>
      </form>
      <div className="mt-2 font-mono text-[11px] text-text-faint">
        evaluated once nightly against that session&apos;s high/low — not live intraday
      </div>
    </div>
  );
}

function AlertRow({ alert, onToggle, onRemove }: { alert: WatchlistAlert; onToggle: (enabled: boolean) => void; onRemove: () => void }) {
  const label = alert.kind === "price_above" ? `Above ${price(alert.threshold)}` : `Below ${price(alert.threshold)}`;
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-surface px-2.5 py-1.5">
      <Bell size={12} className={alert.triggered_at ? "text-up-text" : "text-text-faint"} />
      <span className="text-[12px]">{label}</span>
      {alert.triggered_at ? (
        <Tooltip content={`Crossed ${price(alert.triggered_price)} on ${alert.triggered_at}`}>
          <Chip tone="up">triggered {alert.triggered_at}</Chip>
        </Tooltip>
      ) : (
        <button onClick={() => onToggle(!alert.enabled)} className="text-[11px] text-text-muted hover:text-text">
          {alert.enabled ? "enabled" : "disabled"}
        </button>
      )}
      <button onClick={onRemove} className="ml-auto text-text-faint hover:text-down-text">
        <X size={13} />
      </button>
    </div>
  );
}

function AlertSummary({ item }: { item: WatchlistItem }) {
  if (item.alerts.length === 0) return <span className="text-[11px] text-text-faint">no alerts</span>;
  const activeTriggered = item.alerts.filter((a) => a.triggered_at);
  if (activeTriggered.length > 0) {
    return <span className="truncate text-[11px] text-up-text">{activeTriggered.length} triggered</span>;
  }
  const enabled = item.alerts.filter((a) => a.enabled);
  return <span className="truncate text-[11px] text-text-secondary">{enabled.length} active</span>;
}

function Row({ item, expanded, onToggleExpand }: { item: WatchlistItem; expanded: boolean; onToggleExpand: () => void }) {
  const removeItem = useRemoveWatchlistItem();
  const pl = unrealizedPct(item);
  return (
    <div className="border-b border-border last:border-0">
      <div
        className="tnum grid items-center gap-2 px-4 py-2.5"
        style={{ gridTemplateColumns: "1.6fr 0.8fr 0.8fr 0.9fr 1.6fr 90px" }}
      >
        <Link href={`/chart/${toSlug(item.symbol)}?back=${encodeURIComponent("/watchlist")}`} className="min-w-0 hover:text-accent">
          <div className="text-[13px] font-medium">{item.symbol}</div>
          <div className="truncate text-[11px] text-text-muted">{item.name}</div>
        </Link>
        <span className="text-right text-[13px] text-text-secondary">{item.entry_price != null ? price(item.entry_price) : "—"}</span>
        <span className="text-right text-[13px]">{item.ltp != null ? price(item.ltp) : "—"}</span>
        <span className={cn("text-right text-[13px] font-medium", toneClass(pl))}>{pl == null ? "—" : pct(pl)}</span>
        <button onClick={onToggleExpand} className="flex items-center gap-2 text-left">
          <AlertSummary item={item} />
          <span className="text-[11px] font-medium text-accent">{expanded ? "close" : "edit"}</span>
        </button>
        <div className="flex justify-end">
          <button onClick={() => removeItem.mutate(item.id)} className="text-text-faint hover:text-down-text">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      {expanded && <AlertPanel item={item} />}
    </div>
  );
}

function GridCard({ item, expanded, onToggleExpand }: { item: WatchlistItem; expanded: boolean; onToggleExpand: () => void }) {
  const removeItem = useRemoveWatchlistItem();
  const pl = unrealizedPct(item);
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <Link href={`/chart/${toSlug(item.symbol)}?back=${encodeURIComponent("/watchlist")}`} className="hover:text-accent">
          <div className="text-[15px] font-semibold">{item.symbol}</div>
          <div className="mt-0.5 text-[11px] text-text-muted">{item.name}</div>
        </Link>
        <button onClick={() => removeItem.mutate(item.id)} className="text-text-faint hover:text-down-text">
          <Trash2 size={14} />
        </button>
      </div>
      <div className="tnum mt-3 grid grid-cols-3 gap-2 border-t border-border pt-3">
        <div>
          <div className="text-[11px] text-text-muted">Entry</div>
          <div className="text-[13px]">{item.entry_price != null ? price(item.entry_price) : "—"}</div>
        </div>
        <div>
          <div className="text-[11px] text-text-muted">LTP</div>
          <div className="text-[13px]">{item.ltp != null ? price(item.ltp) : "—"}</div>
        </div>
        <div>
          <div className="text-[11px] text-text-muted">Unrealised</div>
          <div className={cn("text-[13px] font-medium", toneClass(pl))}>{pl == null ? "—" : pct(pl)}</div>
        </div>
      </div>
      <button onClick={onToggleExpand} className="mt-3 flex w-full items-center justify-between text-left">
        <AlertSummary item={item} />
        <span className="text-[11px] font-medium text-accent">{expanded ? "close" : "edit alerts"}</span>
      </button>
      {expanded && (
        <div className="-mx-4 -mb-4 mt-3">
          <AlertPanel item={item} />
        </div>
      )}
    </Card>
  );
}
