"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Compass, ExternalLink, Layers } from "lucide-react";
import RrgCanvas, { RrgSectorItem } from "@/components/rrg-canvas";

export default function SectorsPage() {
  const [selectedSector, setSelectedSector] = useState<string>("NIFTY AUTO");
  const [data, setData] = useState<any>(null);

  const defaultSectors: RrgSectorItem[] = [
    {
      sector: "NIFTY AUTO",
      rsRatio: 103.4,
      rsMomentum: 101.8,
      quadrant: "Leading",
      topLeaders: ["BAJAJ-AUTO", "M&M", "TATAMOTORS"],
    },
    {
      sector: "NIFTY PHARMA",
      rsRatio: 102.1,
      rsMomentum: 102.4,
      quadrant: "Leading",
      topLeaders: ["SUNPHARMA", "CIPLA", "DRREDDY"],
    },
    {
      sector: "NIFTY METAL",
      rsRatio: 101.5,
      rsMomentum: 100.9,
      quadrant: "Leading",
      topLeaders: ["JINDALSTEL", "HINDALCO", "TATASTEEL"],
    },
    {
      sector: "NIFTY IT",
      rsRatio: 101.8,
      rsMomentum: 98.4,
      quadrant: "Weakening",
      topLeaders: ["COFORGE", "PERSISTENT", "TCS"],
    },
    {
      sector: "NIFTY CONSUMPTION",
      rsRatio: 100.9,
      rsMomentum: 99.2,
      quadrant: "Weakening",
      topLeaders: ["TRENT", "TITAN", "DMART"],
    },
    {
      sector: "NIFTY ENERGY",
      rsRatio: 98.6,
      rsMomentum: 97.5,
      quadrant: "Lagging",
      topLeaders: ["RELIANCE", "NTPC", "ONGC"],
    },
    {
      sector: "NIFTY FMCG",
      rsRatio: 97.4,
      rsMomentum: 98.1,
      quadrant: "Lagging",
      topLeaders: ["ITC", "HINDUNILVR", "NESTLEIND"],
    },
    {
      sector: "NIFTY REALTY",
      rsRatio: 98.2,
      rsMomentum: 102.1,
      quadrant: "Improving",
      topLeaders: ["DLF", "GODREJPROP", "OBEROIRLTY"],
    },
    {
      sector: "NIFTY PSU BANK",
      rsRatio: 99.1,
      rsMomentum: 101.5,
      quadrant: "Improving",
      topLeaders: ["SBIN", "CANBK", "BANKBARODA"],
    },
    {
      sector: "NIFTY INFRA",
      rsRatio: 100.4,
      rsMomentum: 100.3,
      quadrant: "Leading",
      topLeaders: ["LT", "ADANIPORTS", "GMRINFRA"],
    },
  ];

  useEffect(() => {
    async function loadSectorData() {
      try {
        const res = await fetch("/api/terminal/data");
        if (res.ok) {
          const json = await res.json();
          setData(json);
          if (
            Array.isArray(json?.breadth?.sectorRrgJson) &&
            json.breadth.sectorRrgJson.length > 0
          ) {
            setSelectedSector(json.breadth.sectorRrgJson[0].sector);
          }
        }
      } catch (err) {
        console.error("Sector fetch error:", err);
      }
    }
    loadSectorData();
  }, []);

  const rawSectors = data?.breadth?.sectorRrgJson;
  const sectorList: RrgSectorItem[] =
    Array.isArray(rawSectors) && rawSectors.length > 0
      ? rawSectors
      : defaultSectors;
  const currentSectorData =
    sectorList.find((s) => s.sector === selectedSector) ||
    sectorList[0] ||
    defaultSectors[0];

  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="border-b border-border pb-4 bg-surface p-4 sm:p-5 rounded-xl shadow-xs">
        <h1 className="text-base sm:text-lg font-bold uppercase tracking-wider text-text font-mono flex items-center gap-2">
          <Compass className="w-5 h-5 text-accent" />
          <span>Relative Rotation Graph (RRG) — Sector Matrix</span>
        </h1>
        <p className="text-xs text-text-muted font-mono mt-1">
          Benchmark: Nifty 500 • JdK RS-Ratio (X-Axis) vs JdK RS-Momentum (Y-Axis) across Indian Sectoral Indices
        </p>
      </div>

      {/* Main Grid: Canvas on Left, Quadrant Rail on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 flex flex-col items-center justify-center bg-surface border border-border rounded-xl p-3 sm:p-5 shadow-xs overflow-hidden">
          <RrgCanvas
            sectors={sectorList}
            selectedSector={selectedSector}
            onSelectSector={(s) => setSelectedSector(s)}
            width={680}
            height={500}
          />
          <div className="text-[11px] font-mono text-text-muted mt-3 flex items-center gap-3 sm:gap-4 flex-wrap justify-center">
            <span>Click any sector node to view constituent leaders</span>
            <span>•</span>
            <span className="text-emerald-700 font-semibold">Green = Leading</span>
            <span className="text-amber-700 font-semibold">Amber = Weakening</span>
            <span className="text-rose-700 font-semibold">Red = Lagging</span>
            <span className="text-sky-700 font-semibold">Sky = Improving</span>
          </div>
        </div>

        {/* Quadrant Rail */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-surface border border-border rounded-xl p-4 shadow-xs">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-text mb-3 flex items-center justify-between">
              <span>Sector Quadrant Rail</span>
              <span className="text-[10px] text-text-muted font-normal">
                Active: {selectedSector}
              </span>
            </h3>

            <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
              {sectorList.map((sec) => {
                const isSelected = sec.sector === selectedSector;
                return (
                  <div
                    key={sec.sector}
                    onClick={() => setSelectedSector(sec.sector)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? "bg-surface-2 border-accent shadow-xs"
                        : "bg-surface border-border hover:border-text-faint"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-text">
                        {sec.sector}
                      </span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold border ${
                          sec.quadrant === "Leading"
                            ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                            : sec.quadrant === "Weakening"
                            ? "bg-amber-50 text-amber-800 border-amber-300"
                            : sec.quadrant === "Lagging"
                            ? "bg-rose-50 text-rose-800 border-rose-300"
                            : "bg-sky-50 text-sky-800 border-sky-300"
                        }`}
                      >
                        {sec.quadrant}
                      </span>
                    </div>

                    <div className="flex items-center justify-between mt-2 text-[11px] font-mono text-text-muted">
                      <span>
                        Ratio: <b className="text-text">{sec.rsRatio.toFixed(1)}</b>
                      </span>
                      <span>
                        Momentum: <b className="text-text">{sec.rsMomentum.toFixed(1)}</b>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Selected Sector Leaders */}
      <div className="bg-surface border border-border rounded-xl p-4 sm:p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-accent" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-text font-mono">
              Top Swing Leaders in {selectedSector}
            </h3>
          </div>
          <span className="text-xs font-mono font-semibold text-emerald-700">
            Quadrant: {currentSectorData.quadrant}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
          {currentSectorData.topLeaders?.map((sym) => (
            <div
              key={sym}
              className="bg-surface-2 border border-border p-3.5 rounded-lg flex items-center justify-between hover:border-accent transition-colors shadow-2xs"
            >
              <div>
                <Link
                  href={`/stock/${sym}`}
                  className="font-mono font-bold text-sm text-text hover:text-accent tracking-tight"
                >
                  {sym}
                </Link>
                <div className="text-[11px] text-text-muted font-mono mt-0.5">
                  Stage 2 Uptrend • High Relative Strength
                </div>
              </div>

              <Link
                href={`/stock/${sym}`}
                className="p-1.5 rounded bg-surface border border-border text-text hover:text-accent transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
