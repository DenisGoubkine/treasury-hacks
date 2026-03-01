import { NextRequest, NextResponse } from "next/server";

interface PhotonFeatureProperties {
  name?: string;
  housenumber?: string;
  street?: string;
  city?: string;
  state?: string;
  postcode?: string;
  countrycode?: string;
}

interface PhotonFeature {
  properties?: PhotonFeatureProperties;
}

interface PhotonResponse {
  features?: PhotonFeature[];
}

interface NominatimItem {
  display_name?: string;
}

function formatPhotonAddress(props: PhotonFeatureProperties): string {
  const line1 = [props.housenumber, props.street].filter(Boolean).join(" ").trim();
  const line2 = [props.city, props.state, props.postcode].filter(Boolean).join(", ").trim();
  const named = props.name?.trim();

  if (line1 && line2) return `${line1}, ${line2}`;
  if (line1) return line1;
  if (named && line2) return `${named}, ${line2}`;
  return named || line2;
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
    const photonParams = new URLSearchParams({
      q,
      limit: String(limit),
      lang: "en",
    });

    const photonResponse = await fetch(`https://photon.komoot.io/api/?${photonParams.toString()}`, {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (photonResponse.ok) {
      const photonData = (await photonResponse.json()) as PhotonResponse;
      const photonSuggestions = Array.from(
        new Set(
          (Array.isArray(photonData.features) ? photonData.features : [])
            .map((feature) => feature.properties || {})
            .filter((props) => (props.countrycode || "").toLowerCase() === "us")
            .map((props) => formatPhotonAddress(props))
            .filter((value) => value.length > 0)
        )
      ).slice(0, limit);

      if (photonSuggestions.length > 0) {
        return NextResponse.json({ ok: true, suggestions: photonSuggestions });
      }
    }

    const nominatimParams = new URLSearchParams({
      q,
      format: "jsonv2",
      limit: String(limit),
      countrycodes: "us",
      addressdetails: "1",
    });

    const response = await fetch(`https://nominatim.openstreetmap.org/search?${nominatimParams.toString()}`, {
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
