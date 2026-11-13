import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const patternQuery = req.nextUrl.searchParams.get("pattern");
    const jsonPath = path.join(process.cwd(), "data", "pdf_pattern_scans.json");

    if (!fs.existsSync(jsonPath)) {
      return NextResponse.json({ patterns: {}, count: 0, stocks: [] });
    }

    const fileContent = fs.readFileSync(jsonPath, "utf-8");
    const allPatterns: Record<string, any[]> = JSON.parse(fileContent);

    // Compute counts per pattern
    const summary: Record<string, number> = {};
    for (const [key, list] of Object.entries(allPatterns)) {
      summary[key] = list.length;
    }

    if (patternQuery) {
      // Find matching pattern (case-insensitive)
      const matchedKey = Object.keys(allPatterns).find(
        (k) => k.toLowerCase() === patternQuery.toLowerCase()
      );
      const stocks = matchedKey ? allPatterns[matchedKey] : [];
      return NextResponse.json({
        pattern: matchedKey || patternQuery,
        count: stocks.length,
        stocks,
        summary,
      });
    }

    return NextResponse.json({
      summary,
      patterns: allPatterns,
    });
  } catch (error) {
    console.error("Pattern API error:", error);
    return NextResponse.json({ error: "Failed to read pattern data" }, { status: 500 });
  }
}

