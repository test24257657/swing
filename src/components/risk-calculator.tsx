"use client";

import React, { useState } from "react";
import { formatINR, formatPct } from "@/lib/format";
import { Calculator, ShieldAlert, Target, TrendingUp } from "lucide-react";

interface RiskCalculatorProps {
  initialPrice?: number;
  initialStop?: number;
  symbol?: string;
}

export function RiskCalculator({
  initialPrice = 1000,
  initialStop = 950,
  symbol = "STOCK",
}: RiskCalculatorProps) {
  const [capital, setCapital] = useState<number>(1000000); // 10 Lakh
  const [riskPct, setRiskPct] = useState<number>(1.0); // 1%
  const [entryPrice, setEntryPrice] = useState<number>(initialPrice);
  const [stopPrice, setStopPrice] = useState<number>(initialStop);

  const riskPerShare = Math.max(0, entryPrice - stopPrice);
  const riskPctShare = entryPrice > 0 ? (riskPerShare / entryPrice) * 100 : 0;
  const maxRiskAmount = (capital * riskPct) / 100;
  const quantity = riskPerShare > 0 ? Math.floor(maxRiskAmount / riskPerShare) : 0;
  const totalPositionValue = quantity * entryPrice;
  const capitalAllocationPct = capital > 0 ? (totalPositionValue / capital) * 100 : 0;

  // Targets
  const target1Price = entryPrice + 2 * riskPerShare; // 2R
  const target2Price = entryPrice + 3.5 * riskPerShare; // 3.5R
  const profitTarget1 = quantity * (target1Price - entryPrice);
  const profitTarget2 = quantity * (target2Price - entryPrice);

  return (
    <div className="bg-terminal-card border border-terminal-border rounded-lg p-4 shadow-xl">
      <div className="flex items-center justify-between border-b border-terminal-border pb-3 mb-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-terminal-text">
          <Calculator className="w-4 h-4 text-terminal-accent" />
          <span>Position Sizing & 1% Risk Calculator — {symbol}</span>
        </div>
        <div className="text-xs text-terminal-muted">Institutional 1R Rule</div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div>
          <label className="text-[11px] font-mono text-terminal-muted uppercase block mb-1">
            Account Capital (₹)
          </label>
          <input
            type="number"
            value={capital}
            onChange={(e) => setCapital(Number(e.target.value) || 0)}
            className="w-full bg-terminal-bg border border-terminal-border rounded px-2.5 py-1.5 text-xs text-terminal-text font-mono focus:border-terminal-accent focus:outline-none"
          />
        </div>

        <div>
          <label className="text-[11px] font-mono text-terminal-muted uppercase block mb-1">
            Risk Per Trade (%)
          </label>
          <input
            type="number"
            step="0.1"
            value={riskPct}
            onChange={(e) => setRiskPct(Number(e.target.value) || 0)}
            className="w-full bg-terminal-bg border border-terminal-border rounded px-2.5 py-1.5 text-xs text-terminal-text font-mono focus:border-terminal-accent focus:outline-none"
          />
        </div>

        <div>
          <label className="text-[11px] font-mono text-terminal-muted uppercase block mb-1">
            Entry / Pivot Price (₹)
          </label>
          <input
            type="number"
            step="0.05"
            value={entryPrice}
            onChange={(e) => setEntryPrice(Number(e.target.value) || 0)}
            className="w-full bg-terminal-bg border border-terminal-border rounded px-2.5 py-1.5 text-xs text-terminal-text font-mono focus:border-terminal-accent focus:outline-none"
          />
        </div>

        <div>
          <label className="text-[11px] font-mono text-terminal-muted uppercase block mb-1">
            Stop Loss (₹)
          </label>
          <input
            type="number"
            step="0.05"
            value={stopPrice}
            onChange={(e) => setStopPrice(Number(e.target.value) || 0)}
            className="w-full bg-terminal-bg border border-terminal-border rounded px-2.5 py-1.5 text-xs text-terminal-text font-mono focus:border-terminal-accent focus:outline-none"
          />
        </div>
      </div>

      {/* Sizing Results */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-terminal-bg/60 p-3 rounded-lg border border-terminal-border/60 mb-4">
        <div>
          <div className="text-[10px] text-terminal-muted font-mono uppercase">Max ₹ Risk (1R)</div>
          <div className="text-base font-bold text-terminal-bear font-mono">
            {formatINR(maxRiskAmount)}
          </div>
        </div>

        <div>
          <div className="text-[10px] text-terminal-muted font-mono uppercase">Risk Per Share</div>
          <div className="text-base font-bold text-terminal-text font-mono">
            {formatINR(riskPerShare)} <span className="text-xs font-normal text-terminal-muted">({riskPctShare.toFixed(1)}%)</span>
          </div>
        </div>

        <div>
          <div className="text-[10px] text-terminal-muted font-mono uppercase">Max Position Size</div>
          <div className="text-base font-bold text-terminal-accent font-mono">
            {quantity.toLocaleString()} Shares
          </div>
        </div>

        <div>
          <div className="text-[10px] text-terminal-muted font-mono uppercase">Capital Deployed</div>
          <div className="text-base font-bold text-terminal-text font-mono">
            {formatINR(totalPositionValue, true)} <span className="text-xs font-normal text-terminal-muted">({capitalAllocationPct.toFixed(1)}%)</span>
          </div>
        </div>
      </div>

      {/* Targets (2R and 3.5R) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="border border-emerald-500/20 bg-emerald-500/5 p-3 rounded-lg flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
              <Target className="w-3.5 h-3.5" />
              <span>Target 1 (2R — Take 50% Off)</span>
            </div>
            <div className="text-sm font-mono font-bold text-slate-100 mt-0.5">
              {formatINR(target1Price)} <span className="text-xs text-emerald-400 font-normal">(+{((target1Price / entryPrice - 1) * 100).toFixed(1)}%)</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-terminal-muted font-mono">Expected Profit</div>
            <div className="text-xs font-bold text-emerald-400 font-mono">+{formatINR(profitTarget1)}</div>
          </div>
        </div>

        <div className="border border-cyan-500/20 bg-cyan-500/5 p-3 rounded-lg flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-cyan-400">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Target 2 (3.5R — Runner Target)</span>
            </div>
            <div className="text-sm font-mono font-bold text-slate-100 mt-0.5">
              {formatINR(target2Price)} <span className="text-xs text-cyan-400 font-normal">(+{((target2Price / entryPrice - 1) * 100).toFixed(1)}%)</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-terminal-muted font-mono">Expected Profit</div>
            <div className="text-xs font-bold text-cyan-400 font-mono">+{formatINR(profitTarget2)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RiskCalculator;
