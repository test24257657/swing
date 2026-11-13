import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import path from "path";
import fs from "fs";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export const dynamic = "force-dynamic";

// In-memory cache for fast tab navigation (15-minute TTL per symbol+tf)
const memoryCache = new Map<string, { timestamp: number; bars: any[] }>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol: rawSymbol } = await params;
  const symbol = rawSymbol?.toUpperCase().trim();

  if (!symbol) {
    return NextResponse.json({ bars: [] });
  }

  // Timeframe: D (daily), W (weekly), M (monthly) — default D
  const tf = (req.nextUrl.searchParams.get("tf") || "D").toUpperCase();
  const validTf = ["D", "W", "M"].includes(tf) ? tf : "D";

  const cacheKey = `${symbol}_${validTf}`;
  const now = Date.now();

  // 1. Check in-memory cache first
  const cached = memoryCache.get(cacheKey);
  if (cached && now - cached.timestamp < CACHE_TTL_MS && cached.bars.length > 0) {
    return NextResponse.json(
      { symbol, timeframe: validTf, bars: cached.bars, cached: true },
      {
        headers: {
          "Cache-Control": "public, max-age=900, stale-while-revalidate=3600",
        },
      }
    );
  }

  // 2. Check disk cache in data/bars_cache/
  const rootDir = process.cwd();
  const diskCacheDir = path.join(rootDir, "data", "bars_cache");
  const diskCacheFile = path.join(diskCacheDir, `${cacheKey}.json`);

  try {
    if (fs.existsSync(diskCacheFile)) {
      const stats = fs.statSync(diskCacheFile);
      if (now - stats.mtimeMs < CACHE_TTL_MS) {
        const diskContent = fs.readFileSync(diskCacheFile, "utf-8");
        const parsed = JSON.parse(diskContent);
        if (Array.isArray(parsed) && parsed.length > 0) {
          memoryCache.set(cacheKey, { timestamp: stats.mtimeMs, bars: parsed });
          return NextResponse.json(
            { symbol, timeframe: validTf, bars: parsed, cached: true },
            {
              headers: {
                "Cache-Control": "public, max-age=900, stale-while-revalidate=3600",
              },
            }
          );
        }
      }
    }
  } catch (e) {
    // continue to fetch
  }

  // 3. Fetch from Python script
  try {
    const pythonBin = path.join(rootDir, ".venv", "bin", "python");
    const scriptPath = path.join(rootDir, "pipeline", "get_stock_bars.py");

    const { stdout } = await execFileAsync(
      pythonBin,
      [scriptPath, symbol, validTf],
      {
        timeout: 30000,
        maxBuffer: 15 * 1024 * 1024,
      }
    );

    const bars = JSON.parse(stdout || "[]");

    // Cache if valid
    if (Array.isArray(bars) && bars.length > 0) {
      memoryCache.set(cacheKey, { timestamp: now, bars });
      try {
        if (!fs.existsSync(diskCacheDir)) {
          fs.mkdirSync(diskCacheDir, { recursive: true });
        }
        fs.writeFileSync(diskCacheFile, JSON.stringify(bars));
      } catch (e) {
        // disk write non-fatal
      }
    }

    return NextResponse.json(
      { symbol, timeframe: validTf, bars, cached: false },
      {
        headers: {
          "Cache-Control": "public, max-age=900, stale-while-revalidate=3600",
        },
      }
    );
  } catch (err: any) {
    console.error("Error fetching stock bars:", err);
    return NextResponse.json({ symbol, timeframe: validTf, bars: [] });
  }
}
