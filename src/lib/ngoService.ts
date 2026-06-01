/**
 * NGO directory service — Supabase queries for ngo_organizations and ngo_applications.
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const db =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export type ServiceType = "legal" | "psych" | "shelter" | "hotline";

export interface NgoOrg {
  id: string;
  name: string;
  name_zh: string | null;
  service_type: ServiceType;
  coverage_area: string;
  phone: string | null;
  website: string | null;
  description: string | null;
  description_zh: string | null;
}

export interface NgoApplication {
  org_name: string;
  contact_name: string;
  service_type: ServiceType;
  coverage_area: string;
  phone?: string;
  website?: string;
  credential_description?: string;
}

/** Fetch all active NGOs, optionally filtered by service type */
export async function fetchNgos(serviceType?: ServiceType): Promise<NgoOrg[]> {
  if (!db) return SEED_NGOS;
  let query = db.from("ngo_organizations").select("*");
  if (serviceType) query = query.eq("service_type", serviceType);
  const { data, error } = await query;
  if (error || !data || data.length === 0) return SEED_NGOS;
  return data as NgoOrg[];
}

/** Submit an NGO application */
export async function submitNgoApplication(
  app: NgoApplication
): Promise<{ ok: boolean; error?: string }> {
  if (!db) return { ok: false, error: "Database not configured" };
  const { error } = await db.from("ngo_applications").insert(app);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Hardcoded seed data — shown when Supabase table is empty or unreachable */
export const SEED_NGOS: NgoOrg[] = [
  {
    id: "seed-1",
    name: "National Women's Hotline",
    name_zh: "全国妇女热线",
    service_type: "hotline",
    coverage_area: "全国 / Nationwide",
    phone: "12338",
    website: null,
    description: "24/7 confidential support for women in distress.",
    description_zh: "24小时保密支持热线，提供危机干预与转介服务。",
  },
  {
    id: "seed-2",
    name: "Beijing Legal Aid Center",
    name_zh: "北京法律援助中心",
    service_type: "legal",
    coverage_area: "北京 / Beijing",
    phone: "010-82251234",
    website: "http://www.bjlegalaid.gov.cn",
    description: "Free legal consultation and representation for vulnerable groups.",
    description_zh: "为弱势群体提供免费法律咨询与代理。",
  },
  {
    id: "seed-3",
    name: "Shanghai Psychological Aid",
    name_zh: "上海心理援助热线",
    service_type: "psych",
    coverage_area: "上海 / Shanghai",
    phone: "021-12320-5",
    website: null,
    description: "Crisis counseling and trauma support.",
    description_zh: "危机心理辅导与创伤支持。",
  },
  {
    id: "seed-4",
    name: "Guangzhou Women's Shelter",
    name_zh: "广州妇女庇护所",
    service_type: "shelter",
    coverage_area: "广州 / Guangzhou",
    phone: "020-81234567",
    website: null,
    description: "Emergency shelter and resettlement support.",
    description_zh: "紧急庇护与安置支持服务。",
  },
  {
    id: "seed-5",
    name: "Chengdu Trauma Counseling Center",
    name_zh: "成都创伤咨询中心",
    service_type: "psych",
    coverage_area: "成都 / Chengdu",
    phone: "028-87654321",
    website: null,
    description: "Specialist trauma-informed therapy for survivors.",
    description_zh: "为幸存者提供创伤知情治疗专项服务。",
  },
];
