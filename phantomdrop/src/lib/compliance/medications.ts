import { ControlledSchedule } from "@/lib/compliance/types";

export type MedicationCatalogItem = {
  code: string;
  label: string;
  category: string;
  defaultSchedule: ControlledSchedule;
  ndc?: string;
  activeIngredient?: string;
  strength?: string;
  dosageForm?: string;
  source: "local" | "fda";
};

interface OpenFdaMeta {
  results?: unknown[];
}

interface OpenFdaNdcResult {
  product_ndc?: string;
  brand_name?: string;
  generic_name?: string;
  dosage_form?: string;
  route?: string[];
  active_ingredients?: Array<{ name?: string; strength?: string }>;
}

interface ListMedicationOptions {
  query?: string;
  skip?: number;
  limit?: number;
}

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 50;
const NDC_BASE_URL = "https://api.fda.gov/drug/ndc.json";
const LABEL_BASE_URL = "https://api.fda.gov/drug/label.json";

const fdaDrugCache = new Map<string, MedicationCatalogItem[]>();

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

function normalizeCategory(label: string): string {
  if (/\b(insulin|metformin|glipizide|empagliflozin)\b/i.test(label)) return "Diabetes";
  if (/\b(sertraline|fluoxetine|adderall|vyvanse|escitalopram|bupropion)\b/i.test(label)) return "Mental Health";
  if (/\b(amoxicillin|azithromycin|cephalexin|doxycycline)\b/i.test(label)) return "Antibiotic";
  if (/\b(atorvastatin|lisinopril|amlodipine|losartan)\b/i.test(label)) return "Cardiovascular";
  if (/\b(testosterone|estradiol|progesterone)\b/i.test(label)) return "Hormone Therapy";
  return "General";
}

function dedupeByCode(items: MedicationCatalogItem[]): MedicationCatalogItem[] {
  const map = new Map<string, MedicationCatalogItem>();
  for (const item of items) {
    if (!map.has(item.code)) {
      map.set(item.code, item);
    }
  }
  return Array.from(map.values());
}

function mapNdcResultToMedication(item: OpenFdaNdcResult): MedicationCatalogItem | null {
  const label = item.brand_name?.trim() || item.generic_name?.trim() || "";
  if (!label) return null;

  const activeIngredient = item.active_ingredients?.[0]?.name?.trim();
  const strength = item.active_ingredients?.[0]?.strength?.trim();
  const dosageForm = item.dosage_form?.trim() || item.route?.[0]?.trim();
  const ndc = item.product_ndc?.trim();
  const key = ndc || `${label}|${activeIngredient || ""}|${strength || ""}|${dosageForm || ""}`;

  return {
    code: ndc ? `fda_ndc_${ndc.replace(/[^a-zA-Z0-9]/g, "_")}` : `fda_${stableHash16(key)}`,
    label,
    category: normalizeCategory(`${label} ${activeIngredient || ""}`),
    defaultSchedule: "non_controlled",
    ndc,
    activeIngredient,
    strength,
    dosageForm,
    source: "fda",
  };
}

async function fetchOpenFdaNdc(query: string, limit: number, skip: number): Promise<MedicationCatalogItem[]> {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  params.set("skip", String(skip));
  if (query.trim()) {
    const q = query.trim().replace(/"/g, '\\"');
    params.set(
      "search",
      `brand_name:"${q}" OR generic_name:"${q}" OR active_ingredients.name:"${q}"`
    );
  }

  const response = await fetch(`${NDC_BASE_URL}?${params.toString()}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as OpenFdaMeta;
  const results = (data.results || []) as OpenFdaNdcResult[];
  return dedupeByCode(results.map(mapNdcResultToMedication).filter((item): item is MedicationCatalogItem => Boolean(item)));
}

async function fetchOpenFdaLabelFallback(query: string, limit: number): Promise<MedicationCatalogItem[]> {
  if (!query.trim()) return [];
  const q = query.trim().replace(/"/g, '\\"');
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  params.set(
    "search",
    `openfda.brand_name:"${q}" OR openfda.generic_name:"${q}" OR openfda.substance_name:"${q}"`
  );

  const response = await fetch(`${LABEL_BASE_URL}?${params.toString()}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as {
    results?: Array<{
      id?: string;
      openfda?: {
        brand_name?: string[];
        generic_name?: string[];
        substance_name?: string[];
        product_ndc?: string[];
        dosage_form?: string[];
      };
    }>;
  };

  const mapped: Array<MedicationCatalogItem | null> = (data.results || []).map((result) => {
    const label =
      result.openfda?.brand_name?.[0] ||
      result.openfda?.generic_name?.[0] ||
      result.openfda?.substance_name?.[0] ||
      "";
    if (!label) return null;
    const ndc = result.openfda?.product_ndc?.[0];
    const key = ndc || result.id || label;
    return {
      code: ndc ? `fda_ndc_${ndc.replace(/[^a-zA-Z0-9]/g, "_")}` : `fda_${stableHash16(key)}`,
      label,
      category: normalizeCategory(label),
      defaultSchedule: "non_controlled" as const,
      ndc,
      activeIngredient: result.openfda?.substance_name?.[0],
      dosageForm: result.openfda?.dosage_form?.[0],
      source: "fda" as const,
    };
  });

  return dedupeByCode(mapped.filter((item): item is MedicationCatalogItem => item !== null));
}

export async function listMedicationCatalog(options: ListMedicationOptions = {}): Promise<MedicationCatalogItem[]> {
  const query = options.query?.trim() || "";
  const skip = Math.max(0, options.skip || 0);
  const limit = Math.min(MAX_LIMIT, Math.max(1, options.limit || DEFAULT_LIMIT));

  if (!query) {
    const local = MEDICATION_CATALOG.slice(skip, skip + limit);
    if (local.length >= limit || skip > 0) {
      return local;
    }
    const fda = await fetchOpenFdaNdc("", limit - local.length, 0);
    return dedupeByCode([...local, ...fda]).slice(0, limit);
  }

  const cacheKey = `${normalizeForComparison(query)}|${skip}|${limit}`;
  if (fdaDrugCache.has(cacheKey)) {
    return fdaDrugCache.get(cacheKey) || [];
  }

  const localMatches = MEDICATION_CATALOG.filter((item) => {
    const haystack = `${item.label} ${item.activeIngredient || ""} ${item.category}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  }).slice(0, Math.min(10, limit));

  let fdaMatches = await fetchOpenFdaNdc(query, limit, skip);
  if (fdaMatches.length === 0) {
    fdaMatches = await fetchOpenFdaLabelFallback(query, limit);
  }

  const merged = dedupeByCode([...localMatches, ...fdaMatches]).slice(0, limit);
  fdaDrugCache.set(cacheKey, merged);
  return merged;
}

export async function searchFdaDrug(
  query: string
): Promise<Array<{ name: string; activeIngredient: string; strength?: string; dosageForm?: string }>> {
  const matches = await listMedicationCatalog({ query, limit: 12, skip: 0 });
  return matches
    .filter((item) => item.source === "fda")
    .map((item) => ({
      name: item.label,
      activeIngredient: item.activeIngredient || "Unknown",
      strength: item.strength,
      dosageForm: item.dosageForm,
    }));
}

export async function validateMedicationExists(medicationLabel: string): Promise<boolean> {
  const normalized = normalizeForComparison(medicationLabel);
  const localMatch = MEDICATION_CATALOG.find(
    (item) => normalizeForComparison(item.label) === normalized
  );

  if (localMatch) {
    return true;
  }

  const results = await listMedicationCatalog({ query: medicationLabel, limit: 5, skip: 0 });
  return results.length > 0;
}

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
  const searchTerm = partialName.trim();
  if (searchTerm.length < 1) {
    return [];
  }
  const results = await listMedicationCatalog({ query: searchTerm, limit: 10, skip: 0 });
  return results.map((item) => ({
    label: item.label,
    category: item.category,
    source: item.source,
    activeIngredient: item.activeIngredient,
  }));
}
