import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const items = await prisma.watchlistAndPosition.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ items });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // Auth guard: only authenticated admins can mutate watchlists
  if (process.env.ADMIN_PASSWORD && !(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { symbol, listType, triggerPrice, stopLossPrice, entryPrice, quantity, setupTag, notes } = body;

    if (!symbol) {
      return NextResponse.json({ error: "Symbol is required" }, { status: 400 });
    }

    const item = await prisma.watchlistAndPosition.upsert({
      where: { symbol: symbol.toUpperCase() },
      create: {
        symbol: symbol.toUpperCase(),
        listType: listType || "WATCHLIST",
        triggerPrice: triggerPrice ? Number(triggerPrice) : null,
        stopLossPrice: stopLossPrice ? Number(stopLossPrice) : null,
        entryPrice: entryPrice ? Number(entryPrice) : null,
        quantity: quantity ? Number(quantity) : null,
        setupTag,
        notes,
      },
      update: {
        listType: listType || "WATCHLIST",
        triggerPrice: triggerPrice ? Number(triggerPrice) : null,
        stopLossPrice: stopLossPrice ? Number(stopLossPrice) : null,
        entryPrice: entryPrice ? Number(entryPrice) : null,
        quantity: quantity ? Number(quantity) : null,
        setupTag,
        notes,
      },
    });

    return NextResponse.json({ success: true, item });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  // Auth guard: only authenticated admins can mutate watchlists
  if (process.env.ADMIN_PASSWORD && !(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const symbol = searchParams.get("symbol");
    if (!symbol) {
      return NextResponse.json({ error: "Symbol is required" }, { status: 400 });
    }

    await prisma.watchlistAndPosition.delete({
      where: { symbol: symbol.toUpperCase() },
    });

    return NextResponse.json({ success: true, message: `Removed ${symbol}` });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
