import { ControlledSchedule } from "@/lib/compliance/types";

export type MedicationCatalogItem = {
  code: string;
  label: string;
  category: string;
  defaultSchedule: ControlledSchedule;
  ndc?: string; // National Drug Code from FDA
  activeIngredient?: string;
  strength?: string;
  dosageForm?: string;
  source: "local" | "fda"; // Where this drug came from
};

// Simple in-memory cache for FDA lookups (clears on server restart)
const fdaDrugCache = new Map<string, MedicationCatalogItem | null>();

function normalizeForComparison(str: string): string {
  return str.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function stableHash16(input: string): string {
  // Browser/server-safe lightweight hash for deterministic FDA option IDs.
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return (hash >>> 0).toString(16).padStart(8, "0").repeat(2).slice(0, 16);
}

export const MEDICATION_CATALOG: MedicationCatalogItem[] = [
  {
    code: "amoxicillin_500mg_capsule",
    label: "Amoxicillin 500mg Capsule",
    category: "Antibiotic",
    defaultSchedule: "non_controlled",
    source: "local",
  },
  {
    code: "atorvastatin_20mg_tablet",
    label: "Atorvastatin 20mg Tablet",
    category: "Cardiovascular",
    defaultSchedule: "non_controlled",
    source: "local",
  },
  {
    code: "metformin_500mg_tablet",
    label: "Metformin 500mg Tablet",
    category: "Diabetes",
    defaultSchedule: "non_controlled",
    source: "local",
  },
  {
    code: "lisinopril_10mg_tablet",
    label: "Lisinopril 10mg Tablet",
    category: "Cardiovascular",
    defaultSchedule: "non_controlled",
    source: "local",
  },
  {
    code: "sertraline_50mg_tablet",
    label: "Sertraline 50mg Tablet",
    category: "Mental Health",
    defaultSchedule: "non_controlled",
    source: "local",
  },
  {
    code: "fluoxetine_20mg_capsule",
    label: "Fluoxetine 20mg Capsule",
    category: "Mental Health",
    defaultSchedule: "non_controlled",
    source: "local",
  },
  {
    code: "levothyroxine_50mcg_tablet",
    label: "Levothyroxine 50mcg Tablet",
    category: "Thyroid",
    defaultSchedule: "non_controlled",
    source: "local",
  },
  {
    code: "truvada_200_300mg_tablet",
    label: "Truvada 200/300mg Tablet",
    category: "HIV/PrEP",
    defaultSchedule: "non_controlled",
    source: "local",
  },
  {
    code: "testosterone_cypionate_200mg_ml",
    label: "Testosterone Cypionate 200mg/mL",
    category: "Hormone Therapy",
    defaultSchedule: "schedule_iii_v",
    source: "local",
  },
  {
    code: "buprenorphine_naloxone_8_2mg_film",
    label: "Buprenorphine/Naloxone 8mg/2mg Film",
    category: "Addiction Care",
    defaultSchedule: "schedule_iii_v",
    source: "local",
  },
  {
    code: "adderall_xr_20mg_capsule",
    label: "Adderall XR 20mg Capsule",
    category: "Mental Health",
    defaultSchedule: "schedule_ii",
    source: "local",
  },
  {
    code: "vyvanse_30mg_capsule",
    label: "Vyvanse 30mg Capsule",
    category: "Mental Health",
    defaultSchedule: "schedule_ii",
    source: "local",
  },
];

export const DEFAULT_MEDICATION_CODE = MEDICATION_CATALOG[0].code;

export function getMedicationByCode(code: string): MedicationCatalogItem | undefined {
  const normalized = code.trim();
  return MEDICATION_CATALOG.find((item) => item.code === normalized);
}

/**
 * Search OpenFDA for drug information
 * Returns drug details if found (name, active ingredients, strength, etc)
 * Useful for doctors to lookup and verify medications
 */
export async function searchFdaDrug(
  query: string
): Promise<Array<{ name: string; activeIngredient: string; strength?: string; dosageForm?: string }>> {
  try {
    // OpenFDA API limit: queries must be at least 2 characters
    if (!query || query.trim().length < 2) {
      return [];
    }

    // Search in both brand name and generic name
    const searchParam = encodeURIComponent(query.trim());
    const url = `https://api.fda.gov/drug/label.json?search=brand_name:"${searchParam}" OR generic_name:"${searchParam}"&limit=10`;

    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`FDA API error: ${response.status}`);
      return [];
    }

    const data = (await response.json()) as {
      results?: Array<{
        brand_name?: string[];
        generic_name?: string[];
        active_ingredient?: Array<{ name: string; strength: string }>;
        dosage_form?: string[];
      }>;
    };

    if (!data.results || data.results.length === 0) {
      return [];
    }

    return data.results.map((result) => ({
      name: (result.brand_name?.[0] || result.generic_name?.[0] || "Unknown") as string,
      activeIngredient: (result.active_ingredient?.[0]?.name || "Unknown") as string,
      strength: result.active_ingredient?.[0]?.strength,
      dosageForm: result.dosage_form?.[0],
    }));
  } catch (error) {
    console.error("Failed to search FDA database:", error);
    return [];
  }
}

/**
 * Validate if a medication exists in FDA database or local catalog
 * Returns true if drug is found and valid
 */
export async function validateMedicationExists(medicationLabel: string): Promise<boolean> {
  // Check local catalog first (fast path)
  const normalized = normalizeForComparison(medicationLabel);
  const localMatch = MEDICATION_CATALOG.find(
    (item) => normalizeForComparison(item.label) === normalized
  );

  if (localMatch) {
    return true;
  }

  // Check cache
  const cacheKey = normalizeForComparison(medicationLabel);
  if (fdaDrugCache.has(cacheKey)) {
    return fdaDrugCache.get(cacheKey) !== null;
  }

  // Query FDA
  const fdaResults = await searchFdaDrug(medicationLabel);
  const found = fdaResults.length > 0;

  // Cache the result (null if not found)
  fdaDrugCache.set(cacheKey, found ? { code: "", label: "", category: "", defaultSchedule: "non_controlled", source: "fda" } : null);

  return found;
}

/**
 * Get suggestions for medication based on partial name
 * Combines local catalog + FDA results
 */
export async function getMedicationSuggestions(
  partialName: string
): Promise<
  Array<{
    label: string;
    category: string;
    source: "local" | "fda";
    activeIngredient?: string;
  }>
> {
  const searchTerm = partialName.trim().toLowerCase();

  if (searchTerm.length === 0) {
    return [];
  }

  // Get local matches
  const localMatches = MEDICATION_CATALOG.filter((item) =>
    item.label.toLowerCase().includes(searchTerm)
  ).slice(0, 5);

  // Get FDA matches (only if local results are sparse)
  let fdaMatches: typeof localMatches = [];
  if (localMatches.length < 3) {
    const fdaResults = await searchFdaDrug(partialName);
    fdaMatches = fdaResults.slice(0, 5).map((result) => ({
      code: `fda_${stableHash16(result.name)}`,
      label: result.name,
      category: "FDA Lookup",
      defaultSchedule: "non_controlled" as const,
      source: "fda" as const,
      activeIngredient: result.activeIngredient,
    }));
  }

  return [
    ...localMatches.map((item) => ({ label: item.label, category: item.category, source: "local" as const, activeIngredient: item.activeIngredient })),
    ...fdaMatches,
  ];
}
