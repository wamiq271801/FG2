/**
 * GET /api/stock?ids=<uuid[,uuid…]> — public live availability endpoint.
 *
 * The hydration-time availability refresh (useStock) hits this exactly once
 * per page. It returns ONLY { stock, isActive, isPreorder, availability }
 * per id — never any other product field. Uncached by design (route
 * handlers are dynamic under Cache Components unless they opt in).
 */

import { NextResponse } from "next/server";
import { getStocks } from "@/modules/catalog/stock";
import type { StockInfo } from "@/types";

const MAX_IDS = 100;
// Product ids are uuids — reject anything else early.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const idsParam = new URL(request.url).searchParams.get("ids") ?? "";
  const ids = idsParam
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, MAX_IDS)
    .filter((id) => UUID_RE.test(id));

  if (ids.length === 0) {
    return NextResponse.json({ stocks: {} });
  }

  try {
    const stocks = await getStocks(ids);
    const out: Record<string, StockInfo> = {};
    for (const [id, info] of stocks) out[id] = info;
    return NextResponse.json({ stocks: out });
  } catch (error) {
    console.error("[api/stock] live stock read failed", error);
    // A failed refresh must not break the page — clients keep the
    // server-rendered availability values.
    return NextResponse.json({ stocks: {} }, { status: 502 });
  }
}
