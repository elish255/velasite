import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

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

function optionalEnv(name: string, fallback = "") {
  return process.env[name] || fallback;
}

export function getFimipayConfig() {
  const directCreateUrl = optionalEnv("FIMIPAY_CREATE_PAYMENT_URL");
  const directStatusUrl = optionalEnv("FIMIPAY_ORDER_STATUS_URL");
  const baseUrl = optionalEnv("FIMIPAY_API_BASE_URL", "https://fimipay.com/api/v1").replace(/\/$/, "");
  return {
    baseUrl,
    apiKey: requiredEnv("FIMIPAY_API_KEY"),
    createPaymentUrl: directCreateUrl || `${baseUrl}${optionalEnv("FIMIPAY_CREATE_PAYMENT_PATH", "/payment/create_order")}`,
    orderStatusUrl: directStatusUrl || `${baseUrl}${optionalEnv("FIMIPAY_ORDER_STATUS_PATH", "/payment/order_status")}`,
    withdrawalPath: optionalEnv("FIMIPAY_WITHDRAWAL_PATH", "/withdrawal/create"),
    webhookSecret: optionalEnv("FIMIPAY_WEBHOOK_SECRET"),
    webhookSignatureHeader: optionalEnv("FIMIPAY_WEBHOOK_SIGNATURE_HEADER", "x-fimipay-signature"),
  };
}

function joinUrl(baseUrl: string, path: string, reference?: string) {
  const resolvedPath = reference
    ? path.replaceAll("{reference}", encodeURIComponent(reference))
    : path;
  if (/^https?:\/\//i.test(resolvedPath)) return resolvedPath;
  return `${baseUrl}/${resolvedPath.replace(/^\//, "")}`;
}

function parseJsonEnv(name: string): Record<string, unknown> {
  const raw = process.env[name];
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as Record<string, unknown>;
  } catch {
    throw new Error(`${name} must contain valid JSON.`);
  }
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return null;
}

function nestedData(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object") return {};
  const root = raw as Record<string, unknown>;
  const data = root.data;
  return data && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>) : root;
}

function normalizeStatus(raw: unknown): string | null {
  const data = nestedData(raw);
  const transaction = data.transaction;
  const transactionObject = transaction && typeof transaction === "object" ? (transaction as Record<string, unknown>) : {};
  const order = data.order;
  const orderObject = order && typeof order === "object" ? (order as Record<string, unknown>) : {};
  return firstString(
    data.payment_status,
    data.status,
    data.transaction_status,
    transactionObject.status,
    orderObject.status,
  );
}

export function normalizeFimipayResponse(raw: unknown, httpOk: boolean): FimipayResult {
  const data = nestedData(raw);
  const message = firstString(
    (raw as Record<string, unknown> | null)?.message,
    data.message,
    (raw as Record<string, unknown> | null)?.error,
  );
  const reference = firstString(
    data.reference,
    data.transaction_reference,
    data.order_id,
    data.order_reference,
    data.transaction_id,
    data.id,
  );
  const checkoutUrl = firstString(
    data.checkout_url,
    data.payment_url,
    data.authorization_url,
    data.redirect_url,
    data.redirect_link,
    data.url,
    data.link,
  );
  const status = normalizeStatus(raw);
  const successFlag = (raw as Record<string, unknown> | null)?.success ?? (raw as Record<string, unknown> | null)?.status;
  const ok = httpOk && (successFlag === undefined || successFlag === true || successFlag === "success" || successFlag === "SUCCESSFUL" || successFlag === "pending" || successFlag === "PENDING");
  return { ok, raw, reference, checkoutUrl, status, message };
}

async function fimipayFetch(path: string, init: RequestInit = {}) {
  const config = getFimipayConfig();
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  headers.set("Accept", "application/json");
  headers.set("Authorization", `Bearer ${config.apiKey}`);
  headers.set("X-API-Key", config.apiKey);

  const response = await fetch(joinUrl(config.baseUrl, path), {
    ...init,
    headers,
  });
  const text = await response.text();
  let json: unknown = text;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    // Keep the text response for diagnostics.
  }
  return { response, json };
}

export async function createFimipayPayment(input: {
  requestId: string;
  amount: number;
  phone: string;
  fullName: string;
  email: string;
  callbackUrl: string;
}) {
  const config = getFimipayConfig();
  const payload = {
    buyer_email: input.email,
    buyer_name: input.fullName,
    buyer_phone: input.phone,
    amount: input.amount,
    currency: optionalEnv("FIMIPAY_CURRENCY", "TZS"),
    payment_method: "mobile",
    order_id: input.requestId,
    reference: input.requestId,
    description: optionalEnv("FIMIPAY_PAYMENT_DESCRIPTION", "1Vela activation payment"),
    callback_url: input.callbackUrl,
    return_url: input.callbackUrl,
    ...parseJsonEnv("FIMIPAY_CREATE_PAYMENT_EXTRA_JSON"),
  };
  const result = await fimipayFetch(config.createPaymentUrl, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return normalizeFimipayResponse(result.json, result.response.ok);
}

export async function getFimipayOrderStatus(reference: string) {
  const config = getFimipayConfig();
  const result = await fimipayFetch(config.orderStatusUrl, {
    method: "POST",
    body: JSON.stringify({ order_id: reference }),
  });
  return normalizeFimipayResponse(result.json, result.response.ok);
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
  const config = getFimipayConfig();
  const payload = {
    amount: input.payoutAmount,
    requested_amount: input.amount,
    payout_amount: input.payoutAmount,
    fee: input.fee,
    currency: optionalEnv("FIMIPAY_CURRENCY", "TZS"),
    phone: input.phone,
    customer_phone: input.phone,
    customer_name: input.fullName,
    email: input.email,
    order_id: input.requestId,
    reference: input.requestId,
    description: optionalEnv("FIMIPAY_WITHDRAWAL_DESCRIPTION", "1Vela withdrawal"),
    ...parseJsonEnv("FIMIPAY_WITHDRAWAL_EXTRA_JSON"),
  };
  const result = await fimipayFetch(joinUrl(config.baseUrl, config.withdrawalPath), {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return normalizeFimipayResponse(result.json, result.response.ok);
}

export async function verifyFimipayWebhook(request: Request, rawBody: string) {
  const config = getFimipayConfig();
  if (!config.webhookSecret) return false;
  const signature = request.headers.get(config.webhookSignatureHeader);
  if (!signature) return false;
  const normalizedSignature = signature.replace(/^sha256=/i, "").trim().toLowerCase();
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(config.webhookSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signatureBytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody)));
  const digest = Array.from(signatureBytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return digest === normalizedSignature;
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
