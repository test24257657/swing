import { NextRequest, NextResponse } from "next/server";
import { fetchTVQuotes } from "@/lib/tv-scanner";

export const dynamic = "force-dynamic";


export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbolsParam = searchParams.get("symbols");

  if (!symbolsParam) {
    return NextResponse.json({ quotes: {} });
  }

  const symbols = symbolsParam
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  const quotesMap = await fetchTVQuotes(symbols);
  const quotesObj: Record<string, any> = {};
  quotesMap.forEach((val, key) => {
    quotesObj[key] = val;
  });

  return NextResponse.json({ quotes: quotesObj });
}
