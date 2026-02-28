import { NextRequest, NextResponse } from "next/server";

import {
  getMedicationSuggestions,
  MEDICATION_CATALOG,
} from "@/lib/compliance/medications";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() || "";

  if (q.length === 0) {
    return NextResponse.json({ ok: true, medications: MEDICATION_CATALOG });
  }

  if (q.length < 2) {
    return NextResponse.json(
      { ok: false, error: "Query must be at least 2 characters" },
      { status: 400 }
    );
  }

  const suggestions = await getMedicationSuggestions(q);
  return NextResponse.json({ ok: true, medications: suggestions });
}
