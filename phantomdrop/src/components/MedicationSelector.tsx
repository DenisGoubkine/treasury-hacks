"use client";

import { useEffect, useMemo, useState } from "react";

import { MedicationCatalogItem } from "@/lib/compliance/medications";

interface MedicationSelectorProps {
  value: MedicationCatalogItem | null;
  onSelect: (item: MedicationCatalogItem) => void;
}

interface MedicationSearchResponse {
  ok: boolean;
  medications?: MedicationCatalogItem[];
  error?: string;
}

function useDebouncedValue(value: string, delayMs = 250): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

export default function MedicationSelector({ value, onSelect }: MedicationSelectorProps) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<MedicationCatalogItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const debouncedQuery = useDebouncedValue(query);

  const selectedCode = value?.code || "";
  const selected = useMemo(
    () => items.find((item) => item.code === selectedCode) || value,
    [items, selectedCode, value]
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setError("");
      try {
        const search = debouncedQuery.trim();
        const url =
          search.length >= 2
            ? `/api/compliance/doctor/medications?q=${encodeURIComponent(search)}&limit=24`
            : "/api/compliance/doctor/medications?limit=24";
        const response = await fetch(url);
        const body = (await response.json()) as MedicationSearchResponse;
        if (!response.ok || !body.ok) {
          throw new Error(body.error || "Unable to load medications");
        }
        if (cancelled) return;
        setItems(body.medications || []);
      } catch (err: unknown) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Unable to load medications";
        setItems([]);
        setError(message);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }
    load().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <p className="text-[10px] uppercase tracking-widest text-zinc-400">
          Search FDA + local catalog
        </p>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search medication name, ingredient, or NDC..."
          className="w-full bg-white border border-zinc-200 px-4 py-2.5 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-900 transition-colors"
        />
      </div>

      <select
        value={selectedCode}
        onChange={(e) => {
          const item = items.find((entry) => entry.code === e.target.value);
          if (item) onSelect(item);
        }}
        className="w-full bg-white border border-zinc-200 px-4 py-2.5 text-xs text-zinc-900 focus:outline-none focus:border-zinc-900 transition-colors appearance-none"
      >
        {items.length === 0 ? (
          <option value="">
            {isLoading ? "Loading medications..." : "No medications found"}
          </option>
        ) : (
          items.map((item) => (
            <option key={item.code} value={item.code}>
              {item.label}
              {item.strength ? ` · ${item.strength}` : ""}
              {item.ndc ? ` · NDC ${item.ndc}` : ""}
            </option>
          ))
        )}
      </select>

      {error ? (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2">{error}</p>
      ) : null}

      {selected ? (
        <div className="border border-zinc-100 bg-zinc-50 p-3 grid md:grid-cols-2 gap-2 text-xs text-zinc-600">
          <p>
            Source: <span className="text-zinc-900 font-semibold uppercase">{selected.source}</span>
          </p>
          <p>
            Category: <span className="text-zinc-900">{selected.category}</span>
          </p>
          <p>
            Ingredient: <span className="text-zinc-900">{selected.activeIngredient || "n/a"}</span>
          </p>
          <p>
            Form: <span className="text-zinc-900">{selected.dosageForm || "n/a"}</span>
          </p>
          <p>
            Strength: <span className="text-zinc-900">{selected.strength || "n/a"}</span>
          </p>
          <p>
            NDC: <span className="text-zinc-900">{selected.ndc || "n/a"}</span>
          </p>
        </div>
      ) : null}
    </div>
  );
}
