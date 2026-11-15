"use client";

import React from "react";
import { Info } from "lucide-react";
import IndexCard from "./IndexCard";
import { mockIndices } from "@/data/mockIndices";

export function IndicesSection({ indices = mockIndices }) {
  return (
    <div className="space-y-2.5 pt-2">
      {/* Header */}
      <div className="flex items-center gap-1.5 pb-1">
        <span className="text-xs font-bold text-[#17233B] uppercase tracking-wider">
          Indices
        </span>
        <span title="Benchmark indices and macro indicators">
          <Info size={13} className="text-[#94A3B8] cursor-pointer" />
        </span>
      </div>

      {/* Horizontal grid of 7 indices */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2.5">
        {indices.map((idx) => (
          <IndexCard key={idx.id} item={idx} />
        ))}
      </div>
    </div>
  );
}

export default IndicesSection;
