import { ControlledSchedule } from "@/lib/compliance/types";

export type MedicationCatalogItem = {
  code: string;
  label: string;
  category: string;
  defaultSchedule: ControlledSchedule;
};

export const MEDICATION_CATALOG: MedicationCatalogItem[] = [
  {
    code: "amoxicillin_500mg_capsule",
    label: "Amoxicillin 500mg Capsule",
    category: "Antibiotic",
    defaultSchedule: "non_controlled",
  },
  {
    code: "atorvastatin_20mg_tablet",
    label: "Atorvastatin 20mg Tablet",
    category: "Cardiovascular",
    defaultSchedule: "non_controlled",
  },
  {
    code: "metformin_500mg_tablet",
    label: "Metformin 500mg Tablet",
    category: "Diabetes",
    defaultSchedule: "non_controlled",
  },
  {
    code: "lisinopril_10mg_tablet",
    label: "Lisinopril 10mg Tablet",
    category: "Cardiovascular",
    defaultSchedule: "non_controlled",
  },
  {
    code: "sertraline_50mg_tablet",
    label: "Sertraline 50mg Tablet",
    category: "Mental Health",
    defaultSchedule: "non_controlled",
  },
  {
    code: "fluoxetine_20mg_capsule",
    label: "Fluoxetine 20mg Capsule",
    category: "Mental Health",
    defaultSchedule: "non_controlled",
  },
  {
    code: "levothyroxine_50mcg_tablet",
    label: "Levothyroxine 50mcg Tablet",
    category: "Thyroid",
    defaultSchedule: "non_controlled",
  },
  {
    code: "truvada_200_300mg_tablet",
    label: "Truvada 200/300mg Tablet",
    category: "HIV/PrEP",
    defaultSchedule: "non_controlled",
  },
  {
    code: "testosterone_cypionate_200mg_ml",
    label: "Testosterone Cypionate 200mg/mL",
    category: "Hormone Therapy",
    defaultSchedule: "schedule_iii_v",
  },
  {
    code: "buprenorphine_naloxone_8_2mg_film",
    label: "Buprenorphine/Naloxone 8mg/2mg Film",
    category: "Addiction Care",
    defaultSchedule: "schedule_iii_v",
  },
  {
    code: "adderall_xr_20mg_capsule",
    label: "Adderall XR 20mg Capsule",
    category: "Mental Health",
    defaultSchedule: "schedule_ii",
  },
  {
    code: "vyvanse_30mg_capsule",
    label: "Vyvanse 30mg Capsule",
    category: "Mental Health",
    defaultSchedule: "schedule_ii",
  },
];

export const DEFAULT_MEDICATION_CODE = MEDICATION_CATALOG[0].code;

export function getMedicationByCode(code: string): MedicationCatalogItem | undefined {
  const normalized = code.trim();
  return MEDICATION_CATALOG.find((item) => item.code === normalized);
}
