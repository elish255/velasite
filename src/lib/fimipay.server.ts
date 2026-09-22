import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const CREATE_URL = process.env.FIMIPAY_CREATE_PAYMENT_URL || "https://fimipay.com/api/v1/payment/create_order";
const STATUS_URL = process.env.FIMIPAY_ORDER_STATUS_URL || "https://fimipay.com/api/v1/payment/order_status";

export type FimipayResult = {
  ok: boolean;
  raw: unknown;
  reference: string | null;
  checkoutUrl: string | null;
  status: string | null;
  message: string | null;
};

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return null;
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function dataOf(raw: unknown) {
  const root = object(raw);
  return object(root.data);
}

export function normalizeTanzaniaPhone(input: string) {
  const raw = input.replace(/[^0-9+]/g, "").trim();
  if (raw.startsWith("+255") && raw.length === 13) return raw.slice(1);
  if (raw.startsWith("255") && raw.length === 12) return raw;
  if (raw.startsWith("0") && raw.length === 10) return `255${raw.slice(1)}`;
  throw new Error("Weka namba sahihi ya Tanzania, mfano 0712345678.");
}

function normalizeStatus(raw: unknown) {
  const root = object(raw);
  const data = dataOf(raw);
  const transaction = object(data.transaction);
  const order = object(data.order);
  return firstString(
    data.payment_status,
    data.order_status,
    data.status,
    root.payment_status,
    root.order_status,
    root.status,
    transaction.status,
    order.status,
  );
}

export function normalizeFimipayResponse(raw: unknown, httpOk: boolean): FimipayResult {
  const root = object(raw);
  const data = dataOf(raw);
  const reference = firstString(
    data.order_id,
    data.orderId,
    data.reference,
    data.transaction_id,
    data.transaction_reference,
    root.order_id,
    root.reference,
    root.transaction_id,
    root.id,
  );
  const checkoutUrl = firstString(
    data.checkout_url,
    data.checkoutUrl,
    data.payment_url,
    data.paymentUrl,
    data.url,
    root.checkout_url,
    root.payment_url,
    root.url,
  );
  const status = normalizeStatus(raw);
  const message = firstString(root.message, data.message, root.error);
  const rootStatus = typeof root.status === "string" ? root.status.toLowerCase() : "";
  const ok = httpOk && ["", "success", "successful", "pending"].includes(rootStatus);
  return { ok, raw, reference, checkoutUrl, status, message };
}

async function fimipayFetch(url: string, body: Record<string, unknown>, timeoutMs: number) {
  const apiKey = requiredEnv("FIMIPAY_API_KEY");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "FimiPay-SDK/1.0",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await response.text();
    let json: unknown = {};
    try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
    return { response, json };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Ombi la malipo limechelewa. Jaribu tena.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function createFimipayPayment(input: {
  amount: number;
  phone: string;
  fullName: string;
  email: string;
}) {
  const phone = normalizeTanzaniaPhone(input.phone);
  const payload = {
    buyer_email: input.email,
    buyer_name: input.fullName || "1Vela User",
    buyer_phone: phone,
    amount: input.amount,
    currency: process.env.FIMIPAY_CURRENCY || "TZS",
    payment_method: "mobile",
  };
  const result = await fimipayFetch(CREATE_URL, payload, 20000);
  return normalizeFimipayResponse(result.json, result.response.ok);
}

export async function getFimipayOrderStatus(orderId: string) {
  const result = await fimipayFetch(STATUS_URL, { order_id: orderId }, 12000);
  return normalizeFimipayResponse(result.json, result.response.ok);
}

export function createUserSupabaseClient(accessToken: string) {
  const url = requiredEnv("SUPABASE_URL");
  const key = requiredEnv("SUPABASE_PUBLISHABLE_KEY");
  return createClient<Database>(url, key, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
  });
}

export function getBearerToken(request: Request) {
  const value = request.headers.get("authorization") ?? "";
  return value.startsWith("Bearer ") ? value.slice(7).trim() : "";
}


export async function createFimipayWithdrawal(input: {
  requestId: string;
  amount: number;
  payoutAmount: number;
  fee: number;
  phone: string;
  fullName: string;
  email: string;
}) {
  const apiKey = requiredEnv("FIMIPAY_API_KEY");
  const url = process.env.FIMIPAY_WITHDRAWAL_URL || process.env.FIMIPAY_WITHDRAWAL_PATH;
  if (!url) throw new Error("FIMIPAY_WITHDRAWAL_URL haijawekwa kwenye Vercel.");
  const target = /^https?:\/\//i.test(url)
    ? url
    : `${(process.env.FIMIPAY_API_BASE_URL || "").replace(/\/$/, "")}/${url.replace(/^\//, "")}`;
  const phone = normalizeTanzaniaPhone(input.phone);
  const payload = {
    amount: input.payoutAmount,
    requested_amount: input.amount,
    payout_amount: input.payoutAmount,
    fee: input.fee,
    currency: process.env.FIMIPAY_CURRENCY || "TZS",
    phone,
    customer_phone: phone,
    customer_name: input.fullName,
    email: input.email,
    order_id: input.requestId,
    reference: input.requestId,
    description: process.env.FIMIPAY_WITHDRAWAL_DESCRIPTION || "1Vela withdrawal",
  };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(target, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", "User-Agent": "FimiPay-SDK/1.0", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const text = await response.text();
    let json: unknown = {};
    try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
    return normalizeFimipayResponse(json, response.ok);
  } finally {
    clearTimeout(timeout);
  }
}
