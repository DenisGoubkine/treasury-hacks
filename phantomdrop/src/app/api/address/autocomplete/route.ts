import { NextRequest, NextResponse } from "next/server";

interface NominatimItem {
  display_name?: string;
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() || "";
  const rawLimit = Number(request.nextUrl.searchParams.get("limit") || "6");
  const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(10, rawLimit)) : 6;

  if (q.length < 3) {
    return NextResponse.json(
      { ok: false, error: "Query must be at least 3 characters." },
      { status: 400 }
    );
  }

  try {
    const params = new URLSearchParams({
      q,
      format: "jsonv2",
      limit: String(limit),
      countrycodes: "us",
      addressdetails: "1",
    });

    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      headers: {
        "User-Agent": "PhantomDrop/1.0 AddressAutocomplete",
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { ok: false, error: `Provider error (${response.status})` },
        { status: 502 }
      );
    }

    const data = (await response.json()) as NominatimItem[];
    const suggestions = Array.from(
      new Set(
        (Array.isArray(data) ? data : [])
          .map((item) => item.display_name?.trim() || "")
          .filter((value) => value.length > 0)
      )
    ).slice(0, limit);

    return NextResponse.json({ ok: true, suggestions });
  } catch {
    return NextResponse.json({ ok: false, error: "Address autocomplete failed." }, { status: 500 });
  }
}
