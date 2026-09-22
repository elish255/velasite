import type { IncomingMessage, ServerResponse } from "node:http";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const FIMIPAY_API_KEY = process.env.FIMIPAY_API_KEY;
const FIMIPAY_AMOUNT = Number(process.env.FIMIPAY_AMOUNT || process.env.VITE_ACTIVATION_FEE || "12000");
const FIMIPAY_CURRENCY = process.env.FIMIPAY_CURRENCY || "TZS";
const CREATE_URL = process.env.FIMIPAY_CREATE_PAYMENT_URL || "https://fimipay.com/api/v1/payment/create_order";
const STATUS_URL = process.env.FIMIPAY_ORDER_STATUS_URL || "https://fimipay.com/api/v1/payment/order_status";

type JsonObject = Record<string, unknown>;
type VercelRequest = IncomingMessage & { body?: unknown };
type VercelResponse = ServerResponse & { statusCode: number; json: (body: unknown) => void };

function sendJson(res: VercelResponse, body: unknown, status = 200) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function required(name: string, value: string | undefined) {
  if (!value) throw new Error(`Missing server environment variable: ${name}`);
  return value;
}

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return undefined;
}

function normalizePhone(input: string) {
  const raw = input.replace(/[^0-9+]/g, "").trim();
  if (raw.startsWith("+255") && raw.length === 13) return raw.slice(1);
  if (raw.startsWith("255") && raw.length === 12) return raw;
  if (raw.startsWith("0") && raw.length === 10) return `255${raw.slice(1)}`;
  throw new Error("Weka namba ya Tanzania kwa mfano 0712345678 au +255712345678");
}

function extractOrderId(payload: JsonObject) {
  const data = asObject(payload.data);
  return firstString(payload.order_id, payload.orderId, data.order_id, data.orderId, data.reference, data.transaction_id);
}

function extractStatus(payload: JsonObject) {
  const data = asObject(payload.data);
  return firstString(data.payment_status, data.order_status, payload.payment_status, payload.order_status)?.toLowerCase();
}

function extractCheckoutUrl(payload: JsonObject) {
  const data = asObject(payload.data);
  return firstString(payload.checkout_url, payload.checkoutUrl, payload.payment_url, payload.paymentUrl, payload.url,
    data.checkout_url, data.checkoutUrl, data.payment_url, data.paymentUrl, data.url) || null;
}

function isProviderSuccess(payload: JsonObject) {
  return String(payload.status || "").toLowerCase() === "success";
}

function isPaid(status?: string) { return status === "success"; }
function isFailed(status?: string) {
  return !!status && ["cancelled", "usercancelled", "rejected", "failed", "failure", "expired", "declined"].includes(status);
}

async function fimipay(url: string, body: unknown, timeoutMs: number) {
  const apiKey = required("FIMIPAY_API_KEY", FIMIPAY_API_KEY);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  try {
    console.log("FimiPay request", { endpoint: url, action: url === CREATE_URL ? "create_order" : "order_status", phone: typeof body === "object" && body ? "provided" : "missing" });
    const requestInit: RequestInit = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "FimiPay-SDK/1.0",
        "Authorization": `Bearer ${apiKey}`,
      },
      signal: controller.signal,
    };
    const requestBody = JSON.stringify(body);
    if (requestBody !== undefined) requestInit.body = requestBody;
    const response = await fetch(url, requestInit);
    const text = await response.text();
    let payload: JsonObject;
    try { payload = text ? JSON.parse(text) as JsonObject : {}; } catch { payload = { raw: text }; }
    console.log("FimiPay response", {
      httpStatus: response.status,
      durationMs: Date.now() - startedAt,
      providerStatus: typeof payload.status === "string" ? payload.status : undefined,
      paymentStatus: extractStatus(payload),
      orderId: extractOrderId(payload),
      message: typeof payload.message === "string" ? payload.message : undefined,
    });
    if (!response.ok) {
      const message = firstString(payload.message, payload.error, payload.detail) || `FimiPay HTTP ${response.status}`;
      throw new Error(`${message} (HTTP ${response.status})`);
    }
    return payload;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`FimiPay haijajibu ndani ya sekunde ${Math.ceil(timeoutMs / 1000)}. Jaribu tena.`);
    }
    throw error;
  } finally { clearTimeout(timeout); }
}

async function getBody(req: VercelRequest): Promise<JsonObject> {
  if (req.body && typeof req.body === "object") return req.body as JsonObject;
  if (typeof req.body === "string") return JSON.parse(req.body) as JsonObject;
  return new Promise((resolve, reject) => {
    let raw = "";
    req.setEncoding("utf8");
    req.on("data", (chunk: string) => { raw += chunk; if (raw.length > 1_000_000) reject(new Error("Request body too large")); });
    req.on("end", () => { try { resolve(raw.trim() ? JSON.parse(raw) as JsonObject : {}); } catch { reject(new Error("Invalid JSON body")); } });
    req.on("error", reject);
  });
}

function authHeader(req: VercelRequest) {
  const value = req.headers.authorization || req.headers.Authorization;
  return Array.isArray(value) ? value[0] : value;
}

async function getUser(req: VercelRequest) {
  const auth = authHeader(req);
  if (!auth?.startsWith("Bearer ")) throw new Error("Login session is required");
  const client = createClient(required("SUPABASE_URL", SUPABASE_URL), required("SUPABASE_PUBLISHABLE_KEY", SUPABASE_PUBLISHABLE_KEY));
  const { data, error } = await client.auth.getUser(auth.slice(7).trim());
  if (error || !data.user) throw new Error("Invalid or expired login session");
  return data.user;
}

function adminClient() {
  return createClient(required("SUPABASE_URL", SUPABASE_URL), required("SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY)", SUPABASE_SECRET_KEY), {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
  });
}

async function main(req: VercelRequest) {
  const user = await getUser(req);
  const body = await getBody(req);
  const action = typeof body.action === "string" ? body.action : "create";
  const admin = adminClient();

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id,full_name,phone,activated")
    .eq("id", user.id)
    .single();
  if (profileError || !profile) throw new Error(`Profile not found${profileError?.message ? `: ${profileError.message}` : ""}`);
  if (profile.activated) return { ok: true, alreadyActive: true, redirect: "/account" };

  if (action === "create") {
    const phone = normalizePhone(String(body.phone || profile.phone || ""));
    if (!Number.isFinite(FIMIPAY_AMOUNT) || FIMIPAY_AMOUNT <= 0) throw new Error("Invalid FIMIPAY_AMOUNT");

    // Prevent duplicate pushes while a previous order is still processing.
    const { data: existing } = await admin.from("automatic_payments")
      .select("id,order_id,status,checkout_url,provider_status,phone,amount")
      .eq("user_id", user.id)
      .in("status", ["pending", "processing"])
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (existing) return { ok: true, paid: false, paymentId: existing.id, orderId: existing.order_id, checkoutUrl: existing.checkout_url, status: existing.provider_status || "pending", message: "Push tayari imetumwa. Angalia simu yako." };

    const provider = await fimipay(CREATE_URL, {
      buyer_email: user.email || "",
      buyer_name: profile.full_name || "1Vela User",
      buyer_phone: phone,
      amount: FIMIPAY_AMOUNT,
      currency: FIMIPAY_CURRENCY,
      payment_method: "mobile",
    }, 15000);

    if (!isProviderSuccess(provider)) {
      throw new Error(firstString(provider.message, provider.error) || "FimiPay imeshindwa kuanzisha malipo.");
    }

    const orderId = extractOrderId(provider);
    if (!orderId) throw new Error("FimiPay response did not contain an order ID");
    const providerStatus = extractStatus(provider) || "pending";
    const checkoutUrl = extractCheckoutUrl(provider);

    const { data: row, error } = await admin.from("automatic_payments").insert({
      user_id: user.id,
      order_id: orderId,
      amount: FIMIPAY_AMOUNT,
      currency: FIMIPAY_CURRENCY,
      phone,
      status: isPaid(providerStatus) ? "paid" : "processing",
      checkout_url: checkoutUrl,
      provider_status: providerStatus,
      provider_response: provider,
    }).select("id,order_id,status,checkout_url,provider_status,phone,amount").single();
    if (error) throw new Error(`Push imetumwa lakini haiku-save kwenye database: ${error.message}`);

    if (isPaid(providerStatus)) {
      const { error: activationError } = await admin.from("profiles").update({ activated: true }).eq("id", user.id);
      if (activationError) throw activationError;
      return { ok: true, paid: true, paymentId: row.id, orderId, redirect: "/account", status: providerStatus };
    }

    return { ok: true, paid: false, paymentId: row.id, orderId, checkoutUrl, status: providerStatus, message: "Push imetumwa. Angalia simu yako na thibitisha malipo." };
  }

  if (action === "status") {
    const paymentId = String(body.paymentId || "");
    if (!paymentId) throw new Error("paymentId is required");
    const { data: payment, error } = await admin.from("automatic_payments")
      .select("id,user_id,order_id,status,provider_status,checkout_url,phone,amount")
      .eq("id", paymentId).eq("user_id", user.id).single();
    if (error || !payment) throw new Error("Payment not found");
    if (payment.status === "paid" || profile.activated) return { ok: true, paid: true, status: "success", redirect: "/account", request: payment };
    if (!payment.order_id) throw new Error("Payment order ID is missing");

    const provider = await fimipay(STATUS_URL, { order_id: payment.order_id }, 10000);
    const providerStatus = extractStatus(provider) || "pending";
    if (isPaid(providerStatus)) {
      const { error: updateError } = await admin.from("automatic_payments").update({ status: "paid", provider_status: providerStatus, provider_response: provider, updated_at: new Date().toISOString() }).eq("id", payment.id);
      if (updateError) throw updateError;
      const { error: activationError } = await admin.from("profiles").update({ activated: true }).eq("id", user.id);
      if (activationError) throw activationError;
      return { ok: true, paid: true, status: providerStatus, redirect: "/account", request: { ...payment, status: "paid", provider_status: providerStatus } };
    }
    const nextStatus = isFailed(providerStatus) ? "failed" : "processing";
    await admin.from("automatic_payments").update({ status: nextStatus, provider_status: providerStatus, provider_response: provider, updated_at: new Date().toISOString() }).eq("id", payment.id);
    return { ok: true, paid: false, failed: nextStatus === "failed", status: providerStatus, paymentStatus: nextStatus, request: { ...payment, status: nextStatus, provider_status: providerStatus } };
  }

  throw new Error("Unknown action");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") { res.statusCode = 204; res.setHeader("Access-Control-Allow-Origin", "*"); res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type"); res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS"); return res.end(); }
  if (req.method !== "POST") return sendJson(res, { ok: false, error: "Method not allowed" }, 405);
  try { return sendJson(res, await main(req), 200); }
  catch (error) {
    console.error("FimiPay API error:", error);
    return sendJson(res, { ok: false, error: error instanceof Error ? error.message : "Internal server error" }, 400);
  }
}
