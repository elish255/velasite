import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  createFimipayPayment,
  createFimipayWithdrawal,
  getFimipayOrderStatus,
  normalizeFimipayResponse,
  verifyFimipayWebhook,
} from "./fimipay.server";
import { getAuthenticatedRequestUser } from "./server-auth";

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

function isSuccessStatus(status: string | null) {
  return ["success", "successful", "paid", "completed", "complete", "approved", "successed"].includes((status ?? "").toLowerCase());
}

function isFailureStatus(status: string | null) {
  return ["failed", "failure", "cancelled", "canceled", "rejected", "declined", "expired"].includes((status ?? "").toLowerCase());
}

async function updatePaymentProvider(requestId: string, result: ReturnType<typeof normalizeFimipayResponse>) {
  const isPaid = isSuccessStatus(result.status);
  const { error } = await supabaseAdmin
    .from("payment_requests")
    .update({
      provider: "automatic",
      provider_reference: result.reference,
      provider_status: result.status,
      provider_checkout_url: result.checkoutUrl,
      provider_payload: result.raw as never,
      paid_at: isPaid ? new Date().toISOString() : undefined,
    })
    .eq("id", requestId);
  if (error) throw error;

  if (isPaid) {
    const { error: activationError } = await supabaseAdmin.rpc("activate_automatic_payment", {
      p_request_id: requestId,
    });
    if (activationError) throw activationError;
  }
}

function paymentSelect() {
  return "id, user_id, phone, amount, status, provider, provider_reference, provider_status, provider_checkout_url, provider_payload, paid_at, created_at, approved_at";
}

export async function handleUnifiedFimipayApi(request: Request) {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let body: { action?: string; phone?: string; paymentId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  switch (body.action) {
    case "create":
      return handleFimipayPayment(request, body);
    case "status":
      return handleFimipayPaymentStatus(request, body);
    case "manual":
      return handleManualPayment(request, body);
    default:
      return json({ error: "Unknown payment action" }, 400);
  }
}

export async function handleFimipayPayment(request: Request, parsedBody?: { phone?: string }) {
  const auth = await getAuthenticatedRequestUser(request);
  if (!auth) return json({ error: "Unauthorized" }, 401);

  const body = parsedBody ?? ((await request.json()) as { phone?: string });
  const phone = body.phone?.trim() ?? "";
  if (!/^\+?[0-9][0-9\s-]{7,14}$/.test(phone)) {
    return json({ error: "Weka namba sahihi ya simu." }, 400);
  }

  const [{ data: userData }, { data: profile, error: profileError }] = await Promise.all([
    auth.supabase.auth.getUser(),
    auth.supabase.from("profiles").select("full_name, phone, activated, banned").eq("id", auth.userId).maybeSingle(),
  ]);

  if (profileError || !profile) return json({ error: "Profile not found" }, 404);
  if (profile.banned) return json({ error: "Akaunti yako imezuiwa." }, 403);
  if (profile.activated) return json({ error: "Account tayari imewashwa." }, 400);

  const { data: existing } = await auth.supabase
    .from("payment_requests")
    .select(paymentSelect())
    .eq("user_id", auth.userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    return json({ request: existing, message: "Tayari una payment inayosubiri." });
  }

  const amount = Number(process.env["VITE_ACTIVATION_FEE"] || process.env["ACTIVATION_FEE"] || 12000);
  const { data: created, error: createError } = await auth.supabase
    .from("payment_requests")
    .insert({ user_id: auth.userId, phone, amount, provider: "automatic" })
    .select(paymentSelect())
    .single();

  if (createError || !created) {
    return json({ error: createError?.message ?? "Payment request failed" }, 400);
  }

  try {
    const origin = new URL(request.url).origin;
    const result = await createFimipayPayment({
      requestId: created.id,
      amount,
      phone,
      fullName: profile.full_name || "1Vela User",
      email: userData.user?.email ?? "",
      callbackUrl: `${origin}/api/fimipay/webhook`,
    });

    await updatePaymentProvider(created.id, result);

    if (!result.ok) {
      return json({ error: result.message || "FimiPay payment initialization failed", requestId: created.id }, 502);
    }

    const { data: refreshed } = await supabaseAdmin
      .from("payment_requests")
      .select(paymentSelect())
      .eq("id", created.id)
      .maybeSingle();

    return json({
      request: refreshed ?? created,
      message: result.checkoutUrl ? "Ombi la malipo limeanzishwa." : "Ombi la malipo limetumwa. Angalia simu yako.",
      checkoutUrl: result.checkoutUrl,
      reference: result.reference,
      providerStatus: result.status,
    });
  } catch (error) {
    await supabaseAdmin.from("payment_requests").delete().eq("id", created.id).eq("status", "pending");
    return json({ error: error instanceof Error ? error.message : "FimiPay is not configured." }, 500);
  }
}

export async function handleFimipayPaymentStatus(request: Request, parsedBody?: { paymentId?: string }) {
  const auth = await getAuthenticatedRequestUser(request);
  if (!auth) return json({ error: "Unauthorized" }, 401);

  const url = new URL(request.url);
  const requestId = parsedBody?.paymentId || url.searchParams.get("requestId");
  if (!requestId) return json({ error: "paymentId is required" }, 400);

  const { data: payment } = await auth.supabase
    .from("payment_requests")
    .select(paymentSelect())
    .eq("id", requestId)
    .eq("user_id", auth.userId)
    .maybeSingle();
  if (!payment) return json({ error: "Payment request not found" }, 404);

  const { data: profile } = await auth.supabase.from("profiles").select("activated").eq("id", auth.userId).maybeSingle();
  if (profile?.activated || payment.status === "approved") {
    return json({ payment, activated: true, redirect: "/account" });
  }
  if (payment.provider !== "automatic" || !payment.provider_reference) return json({ payment, activated: false });

  try {
    const result = await getFimipayOrderStatus(payment.provider_reference);
    await updatePaymentProvider(payment.id, result);
    const { data: refreshed } = await supabaseAdmin
      .from("payment_requests")
      .select(paymentSelect())
      .eq("id", payment.id)
      .maybeSingle();
    const activated = isSuccessStatus(result.status);
    return json({ payment: refreshed ?? payment, providerStatus: result.status, activated, redirect: activated ? "/account" : undefined });
  } catch (error) {
    return json({ payment, activated: false, warning: error instanceof Error ? error.message : "Unable to check payment status." });
  }
}

export async function handleManualPayment(request: Request, parsedBody?: { phone?: string }) {
  const auth = await getAuthenticatedRequestUser(request);
  if (!auth) return json({ error: "Unauthorized" }, 401);

  const body = parsedBody ?? ((await request.json()) as { phone?: string });
  const phone = body.phone?.trim() ?? "";
  if (!/^\+?[0-9][0-9\s-]{7,14}$/.test(phone)) {
    return json({ error: "Weka namba sahihi ya simu." }, 400);
  }

  const [{ data: profile, error: profileError }, { data: existing }] = await Promise.all([
    auth.supabase.from("profiles").select("full_name, phone, activated, banned").eq("id", auth.userId).maybeSingle(),
    auth.supabase.from("payment_requests").select(paymentSelect()).eq("user_id", auth.userId).eq("status", "pending").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  if (profileError || !profile) return json({ error: "Profile not found" }, 404);
  if (profile.banned) return json({ error: "Akaunti yako imezuiwa." }, 403);
  if (profile.activated) return json({ error: "Account tayari imewashwa." }, 400);
  if (existing) {
    if (existing.provider === "manual") return json({ request: existing, message: "Taarifa ya malipo tayari imetumwa kwa admin." });
    return json({ error: "Una ombi la automatic payment linalosubiri. Subiri likamilike au jaribu tena baada ya ombi hilo kuisha." }, 409);
  }

  const amount = 12000;
  const { data: created, error: createError } = await supabaseAdmin
    .from("payment_requests")
    .insert({
      user_id: auth.userId,
      phone,
      amount,
      provider: "manual",
      provider_status: "user_claimed",
      provider_payload: { method: "lipa_namba", submitted_at: new Date().toISOString() } as never,
    })
    .select(paymentSelect())
    .single();

  if (createError || !created) return json({ error: createError?.message ?? "Payment request failed" }, 400);

  return json({
    ok: true,
    request: created,
    message: "Taarifa ya malipo imetumwa kwa admin. Subiri uthibitisho wa muamala.",
  });
}

export async function handleFimipayWithdrawal(request: Request) {
  const auth = await getAuthenticatedRequestUser(request);
  if (!auth) return json({ error: "Unauthorized" }, 401);

  const { data: adminRow } = await supabaseAdmin.from("admin_users").select("user_id").eq("user_id", auth.userId).maybeSingle();
  if (!adminRow) return json({ error: "Admin access only" }, 403);

  let body: { requestId?: string };
  try {
    body = (await request.json()) as { requestId?: string };
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  if (!body.requestId) return json({ error: "requestId is required" }, 400);

  const { data: withdrawal } = await supabaseAdmin
    .from("withdrawal_requests")
    .select("id, user_id, amount, fee, payout_amount, phone, status, provider_reference")
    .eq("id", body.requestId)
    .maybeSingle();
  if (!withdrawal) return json({ error: "Withdrawal not found" }, 404);
  if (!["pending", "processing"].includes(withdrawal.status)) return json({ error: "Withdrawal already reviewed" }, 400);

  const [{ data: profile }, { data: authUser }] = await Promise.all([
    supabaseAdmin.from("profiles").select("full_name, banned").eq("id", withdrawal.user_id).maybeSingle(),
    supabaseAdmin.auth.admin.getUserById(withdrawal.user_id),
  ]);
  if (!profile || profile.banned) return json({ error: "User is not eligible for payout" }, 400);

  try {
    const result = await createFimipayWithdrawal({
      requestId: withdrawal.id,
      amount: Number(withdrawal.amount),
      payoutAmount: Number(withdrawal.payout_amount ?? withdrawal.amount),
      fee: Number(withdrawal.fee ?? 0),
      phone: withdrawal.phone,
      fullName: profile.full_name || "1Vela User",
      email: authUser.user?.email ?? "",
    });

    await supabaseAdmin.from("withdrawal_requests").update({
      status: isSuccessStatus(result.status) ? "processing" : withdrawal.status,
      provider: "automatic",
      provider_reference: result.reference,
      provider_status: result.status,
      provider_payload: result.raw as never,
    }).eq("id", withdrawal.id);

    if (!result.ok) {
      return json({ error: result.message || "FimiPay payout failed", providerStatus: result.status }, 502);
    }

    if (isSuccessStatus(result.status)) {
      const { error: reviewError } = await auth.supabase.rpc("review_withdrawal", {
        p_request_id: withdrawal.id,
        p_status: "paid",
      });
      if (reviewError) return json({ error: reviewError.message }, 500);
    }

    return json({
      success: true,
      status: result.status,
      reference: result.reference,
      payoutAmount: Number(withdrawal.payout_amount ?? withdrawal.amount),
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "FimiPay is not configured." }, 500);
  }
}

export async function handleFimipayWebhook(request: Request) {
  const rawBody = await request.text();
  if (!(await verifyFimipayWebhook(request, rawBody))) return json({ error: "Invalid webhook signature" }, 401);

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const normalized = normalizeFimipayResponse(payload, true);
  const root = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const data = root.data && typeof root.data === "object" ? (root.data as Record<string, unknown>) : root;
  const transaction = data.transaction && typeof data.transaction === "object" ? (data.transaction as Record<string, unknown>) : {};
  const reference = normalized.reference ?? (typeof transaction.reference === "string" ? transaction.reference : null);
  if (!reference) return json({ received: true, matched: false });

  const { data: payment } = await supabaseAdmin.from("payment_requests").select("id, user_id, provider").eq("provider_reference", reference).maybeSingle();
  if (payment) {
    await supabaseAdmin.from("payment_requests").update({
      provider_status: normalized.status,
      provider_payload: payload as never,
      paid_at: isSuccessStatus(normalized.status) ? new Date().toISOString() : undefined,
    }).eq("id", payment.id);
    if (isSuccessStatus(normalized.status) && payment.provider === "automatic") {
      const { error: activationError } = await supabaseAdmin.rpc("activate_automatic_payment", { p_request_id: payment.id });
      if (activationError) return json({ error: activationError.message }, 500);
    }
    return json({ received: true, matched: true, type: "payment", activated: isSuccessStatus(normalized.status) && payment.provider === "automatic" });
  }

  const { data: withdrawal } = await supabaseAdmin.from("withdrawal_requests").select("id, user_id, amount, payout_amount, status").eq("provider_reference", reference).maybeSingle();
  if (withdrawal) {
    if (isSuccessStatus(normalized.status)) {
      await supabaseAdmin.from("withdrawal_requests").update({ status: "paid", provider_status: normalized.status, provider_payload: payload as never, processed_at: new Date().toISOString() }).eq("id", withdrawal.id);
      await supabaseAdmin.from("notifications").insert({ user_id: withdrawal.user_id, title: "Transfer Initiated", message: `Payout ya TZS ${Number(withdrawal.payout_amount ?? withdrawal.amount).toLocaleString("en-US")} imethibitishwa.` });
    } else if (isFailureStatus(normalized.status) && withdrawal.status !== "rejected") {
      await supabaseAdmin.from("withdrawal_requests").update({ status: "rejected", provider_status: normalized.status, provider_payload: payload as never, processed_at: new Date().toISOString() }).eq("id", withdrawal.id);
      await supabaseAdmin.rpc("system_refund_withdrawal", { p_request_id: withdrawal.id });
    }
    return json({ received: true, matched: true, type: "withdrawal" });
  }

  return json({ received: true, matched: false });
}
