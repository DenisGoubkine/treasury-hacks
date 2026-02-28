import { NextRequest, NextResponse } from "next/server";

import {
  listMedicationCatalog,
} from "@/lib/compliance/medications";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() || "";
  const skip = Number(request.nextUrl.searchParams.get("skip") || "0");
  const limit = Number(request.nextUrl.searchParams.get("limit") || "24");

  if (q.length > 0 && q.length < 2) {
    return NextResponse.json(
      { ok: false, error: "Query must be at least 2 characters" },
      { status: 400 }
    );
  }

  const medications = await listMedicationCatalog({
    query: q,
    skip: Number.isFinite(skip) ? skip : 0,
    limit: Number.isFinite(limit) ? limit : 24,
  });
  return NextResponse.json({ ok: true, medications });
}
