"use client";

import React, { useEffect, useRef, useState } from "react";

export interface RrgSectorItem {
  sector: string;
  rsRatio: number;
  rsMomentum: number;
  quadrant: "Leading" | "Weakening" | "Lagging" | "Improving";
  tail5d?: Array<{ rsRatio: number; rsMomentum: number }>;
  topLeaders?: string[];
}

interface RrgCanvasProps {
  sectors: RrgSectorItem[];
  selectedSector?: string | null;
  onSelectSector?: (sector: string) => void;
  width?: number;
  height?: number;
}

export function RrgCanvas({
  sectors,
  selectedSector,
  onSelectSector,
  width = 720,
  height = 540,
}: RrgCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredSector, setHoveredSector] = useState<RrgSectorItem | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // High-DPI support
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const minVal = 94;
    const maxVal = 106;
    const range = maxVal - minVal;

    const toX = (val: number) => ((val - minVal) / range) * (width - 60) + 30;
    const toY = (val: number) => height - (((val - minVal) / range) * (height - 60) + 30);

    const centerX = toX(100);
    const centerY = toY(100);

    // Clear background — clean white
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    // Draw Quadrant Background tints
    // Top-Right: Leading (Green tint)
    ctx.fillStyle = "rgba(22, 163, 74, 0.06)";
    ctx.fillRect(centerX, 0, width - centerX, centerY);

    // Top-Left: Weakening (Amber tint)
    ctx.fillStyle = "rgba(217, 119, 6, 0.06)";
    ctx.fillRect(0, 0, centerX, centerY);

    // Bottom-Left: Lagging (Red tint)
    ctx.fillStyle = "rgba(220, 38, 38, 0.06)";
    ctx.fillRect(0, centerY, centerX, height - centerY);

    // Bottom-Right: Improving (Sky tint)
    ctx.fillStyle = "rgba(2, 132, 199, 0.06)";
    ctx.fillRect(centerX, centerY, width - centerX, height - centerY);

    // Quadrant Grid Crosshairs
    ctx.strokeStyle = "rgba(9, 9, 11, 0.12)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(centerX, 0);
    ctx.lineTo(centerX, height);
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();

    // Quadrant Labels (dark rich colors on light background)
    ctx.font = "bold 11px ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillStyle = "#15803d";
    ctx.fillText("LEADING ↗", width - 15, 25);

    ctx.textAlign = "left";
    ctx.fillStyle = "#b45309";
    ctx.fillText("↖ WEAKENING", 15, 25);

    ctx.textAlign = "left";
    ctx.fillStyle = "#b91c1c";
    ctx.fillText("↙ LAGGING", 15, height - 15);

    ctx.textAlign = "right";
    ctx.fillStyle = "#0369a1";
    ctx.fillText("IMPROVING ↘", width - 15, height - 15);

    // Axis Labels
    ctx.fillStyle = "#71717a";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.fillText("RS-Ratio (Benchmark: Nifty 500) →", width / 2, height - 6);

    // Draw Tails and Sector Dots
    sectors.forEach((sec) => {
      const isSelected = selectedSector === sec.sector;
      const isHovered = hoveredSector?.sector === sec.sector;

      // Color by quadrant
      let dotColor = "#16a34a"; // leading
      if (sec.quadrant === "Weakening") dotColor = "#d97706";
      if (sec.quadrant === "Lagging") dotColor = "#dc2626";
      if (sec.quadrant === "Improving") dotColor = "#0284c7";

      // Draw 5-day tail if available
      if (sec.tail5d && sec.tail5d.length > 1) {
        ctx.beginPath();
        sec.tail5d.forEach((pt, i) => {
          const tx = toX(pt.rsRatio);
          const ty = toY(pt.rsMomentum);
          if (i === 0) ctx.moveTo(tx, ty);
          else ctx.lineTo(tx, ty);
        });
        ctx.strokeStyle = isSelected || isHovered ? dotColor : `${dotColor}66`;
        ctx.lineWidth = isSelected || isHovered ? 2 : 1;
        ctx.stroke();
      }

      // Draw Head Dot
      const x = toX(sec.rsRatio);
      const y = toY(sec.rsMomentum);

      ctx.beginPath();
      ctx.arc(x, y, isSelected || isHovered ? 6 : 4, 0, Math.PI * 2);
      ctx.fillStyle = dotColor;
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Label
      ctx.font = isSelected || isHovered ? "bold 11px monospace" : "10px monospace";
      ctx.fillStyle = isSelected || isHovered ? "#18181b" : "#52525b";
      ctx.textAlign = x > width - 80 ? "right" : "left";
      ctx.fillText(sec.sector.replace("NIFTY ", ""), x > width - 80 ? x - 8 : x + 8, y + 3);
    });
  }, [sectors, selectedSector, hoveredSector, width, height]);

  // Click & Hover handler
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const minVal = 94;
    const maxVal = 106;
    const range = maxVal - minVal;
    const toX = (val: number) => ((val - minVal) / range) * (width - 60) + 30;
    const toY = (val: number) => height - (((val - minVal) / range) * (height - 60) + 30);

    let found: RrgSectorItem | null = null;
    for (const sec of sectors) {
      const sx = toX(sec.rsRatio);
      const sy = toY(sec.rsMomentum);
      const dist = Math.hypot(mx - sx, my - sy);
      if (dist < 14) {
        found = sec;
        break;
      }
    }
    setHoveredSector(found);
  };

  const handleClick = () => {
    if (hoveredSector && onSelectSector) {
      onSelectSector(hoveredSector.sector);
    }
  };

  return (
    <div className="relative inline-block border border-border rounded-xl overflow-hidden bg-surface shadow-xs w-full max-w-full">
      <canvas
        ref={canvasRef}
        style={{ width: "100%", maxWidth: `${width}px`, height: "auto", aspectRatio: `${width}/${height}` }}
        className="cursor-crosshair w-full h-auto block"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredSector(null)}
        onClick={handleClick}
      />
      {hoveredSector && (
        <div className="absolute top-3 left-3 bg-surface/95 backdrop-blur-xs border border-border p-2.5 rounded-lg text-xs shadow-lg pointer-events-none z-10">
          <div className="font-bold text-text flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                hoveredSector.quadrant === "Leading"
                  ? "bg-emerald-600"
                  : hoveredSector.quadrant === "Weakening"
                  ? "bg-amber-600"
                  : hoveredSector.quadrant === "Lagging"
                  ? "bg-rose-600"
                  : "bg-sky-600"
              }`}
            />
            {hoveredSector.sector}
          </div>
          <div className="text-text-muted mt-1 flex gap-3 font-mono">
            <span>
              RS-Ratio: <b className="text-text">{hoveredSector.rsRatio.toFixed(2)}</b>
            </span>
            <span>
              RS-Mom: <b className="text-text">{hoveredSector.rsMomentum.toFixed(2)}</b>
            </span>
          </div>
          {hoveredSector.topLeaders && (
            <div className="text-text-muted mt-1 text-[11px] font-mono">
              Top Leaders: <span className="text-accent font-medium">{hoveredSector.topLeaders.slice(0, 3).join(", ")}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default RrgCanvas;
