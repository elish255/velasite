import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createFimipayPayment, createFimipayWithdrawal, getFimipayOrderStatus, normalizeFimipayResponse } from "./fimipay.server";
import { getAuthenticatedRequestUser } from "./server-auth";

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

function isSuccessStatus(status: string | null) {
  return ["success", "successful", "paid", "completed", "complete", "approved", "successed"].includes((status ?? "").toLowerCase());
}
function isFailureStatus(status: string | null) {
  return ["failed", "failure", "cancelled", "canceled", "rejected", "declined", "expired", "usercancelled"].includes((status ?? "").toLowerCase());
}

async function saveProviderResult(requestId: string, result: ReturnType<typeof normalizeFimipayResponse>) {
  const success = result.ok && isSuccessStatus(result.status);
  const failed = result.ok && isFailureStatus(result.status);
  const patch: any = {
    provider: "automatic",
    provider_reference: result.reference,
    provider_status: result.status,
    provider_checkout_url: result.checkoutUrl,
    provider_payload: result.raw as never,
  };
  if (success) {
    patch["status"] = "approved";
    patch["paid_at"] = new Date().toISOString();
  } else if (failed) {
    patch["status"] = "rejected";
  }
  const { data: payment } = await supabaseAdmin.from("payment_requests").update(patch).eq("id", requestId).select("id,user_id,status,amount,phone,provider_reference,provider_status,provider_checkout_url,paid_at").maybeSingle();
  if (success && payment) {
    await supabaseAdmin.from("profiles").update({ activated: true }).eq("id", payment.user_id).eq("banned", false);
    await supabaseAdmin.from("notifications").insert({ user_id: payment.user_id, title: "Malipo yamepokelewa", message: "Malipo yako yamehakikishwa. Account yako imewashwa." });
  }
  return payment;
}

export async function handleFimipayPayment(request: Request) {
  const auth = await getAuthenticatedRequestUser(request);
  if (!auth) return json({ error: "Unauthorized" }, 401);
  let body: { phone?: string; provider?: string };
  try { body = await request.json() as { phone?: string; provider?: string }; } catch { return json({ error: "Invalid JSON body" }, 400); }

  const phone = body.phone?.trim() ?? "";
  const provider = body.provider?.trim() ?? "Mpesa";
  if (!/^\+?[0-9][0-9\s-]{7,14}$/.test(phone)) return json({ error: "Weka namba sahihi ya simu." }, 400);
  if (!["Airtel", "Tigo", "Azampesa", "Halopesa", "Mpesa"].includes(provider)) return json({ error: "Chagua mtandao sahihi wa malipo." }, 400);

  const [{ data: userData }, { data: profile, error: profileError }] = await Promise.all([
    auth.supabase.auth.getUser(),
    auth.supabase.from("profiles").select("full_name,phone,activated,banned").eq("id", auth.userId).maybeSingle(),
  ]);
  if (profileError || !profile) return json({ error: "Profile not found" }, 404);
  if (profile.banned) return json({ error: "Akaunti yako imezuiwa." }, 403);
  if (profile.activated) return json({ alreadyActive: true, redirect: "/account" });

  const { data: pending } = await auth.supabase.from("payment_requests")
    .select("id,phone,amount,status,provider,provider_reference,provider_status,provider_checkout_url,paid_at")
    .eq("user_id", auth.userId).eq("provider", "automatic").eq("status", "pending")
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (pending) return json({
    request: pending,
    paymentId: pending.id,
    status: pending.provider_status || "PENDING",
    message: "Ombi la malipo tayari limetumwa. Angalia simu yako.",
  });

  const amount = 15000;
  const { data: created, error: createError } = await auth.supabase.from("payment_requests")
    .insert({ user_id: auth.userId, phone, amount, provider: "automatic" })
    .select("id,phone,amount,status,provider,provider_reference,provider_status,provider_checkout_url,paid_at").single();
  if (createError || !created) return json({ error: createError?.message ?? "Payment request failed" }, 400);

  try {
    const result = await createFimipayPayment({
      amount,
      phone,
      provider,
      fullName: profile.full_name || "1Vela User",
      email: userData.user?.email ?? "",
      externalId: created.id,
    });
    const saved = await saveProviderResult(created.id, result);
    if (!result.ok) {
      if (!result.reference && !result.status) await supabaseAdmin.from("payment_requests").delete().eq("id", created.id).eq("status", "pending");
      return json({ error: result.message || "Imeshindikana kutuma ombi la malipo.", request: saved ?? created }, 502);
    }
    return json({
      ok: true,
      request: saved ?? created,
      paymentId: created.id,
      paid: isSuccessStatus(result.status),
      status: result.status || "PENDING",
      checkoutUrl: result.checkoutUrl,
      message: isSuccessStatus(result.status) ? "Malipo yamepokelewa." : "Push imetumwa. Angalia simu yako na thibitisha malipo.",
      redirect: isSuccessStatus(result.status) ? "/account" : undefined,
    });
  } catch (error) {
    await supabaseAdmin.from("payment_requests").delete().eq("id", created.id).eq("status", "pending");
    return json({ error: error instanceof Error ? error.message : "Imeshindikana kuanzisha malipo." }, 500);
  }
}

export async function handleFimipayPaymentStatus(request: Request) {
  const auth = await getAuthenticatedRequestUser(request);
  if (!auth) return json({ error: "Unauthorized" }, 401);
  const url = new URL(request.url);
  const requestId = url.searchParams.get("requestId");
  if (!requestId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
    return json({ error: "requestId must be a valid payment UUID" }, 400);
  }

  const { data: payment } = await auth.supabase.from("payment_requests")
    .select("id,user_id,status,provider,provider_reference,provider_status,provider_checkout_url,amount,phone,paid_at")
    .eq("id", requestId).eq("user_id", auth.userId).maybeSingle();
  if (!payment) return json({ error: "Payment request not found" }, 404);
  if (payment.status === "approved") return json({ paid: true, status: "SUCCESS", request: payment, redirect: "/account" });
  if (payment.status === "rejected") return json({ paid: false, failed: true, status: payment.provider_status || "FAILED", request: payment });
  if (!payment.provider_reference) return json({ paid: false, status: payment.provider_status || "PENDING", request: payment });

  try {
    const result = await getFimipayOrderStatus(payment.provider_reference);
    if (!result.ok) {
      return json({
        paid: false,
        failed: false,
        status: payment.provider_status || "PENDING",
        request: payment,
        warning: result.message || "Malipo bado hayajathibitishwa na DaliPay.",
      });
    }

    const saved = await saveProviderResult(payment.id, result);
    const paid = isSuccessStatus(result.status);
    return json({
      paid,
      failed: isFailureStatus(result.status),
      status: result.status || "PENDING",
      request: saved ?? payment,
      redirect: paid ? "/account" : undefined,
    });
  } catch (error) {
    return json({ paid: false, status: payment.provider_status || "PENDING", request: payment, warning: error instanceof Error ? error.message : "Status check failed." });
  }
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

    if (!result.ok) {
      await supabaseAdmin.from("withdrawal_requests").update({
        provider: "fimipay",
        provider_reference: result.reference,
        provider_status: result.status,
        provider_payload: result.raw as never,
      }).eq("id", withdrawal.id);
      return json({ error: result.message || "FimiPay payout failed", providerStatus: result.status }, 502);
    }

    const providerPatch = {
      provider: "fimipay",
      provider_reference: result.reference,
      provider_status: result.status,
      provider_payload: result.raw as never,
    };

    if (isSuccessStatus(result.status)) {
      // The withdrawal request has already been debited when it was created.
      // Mark it paid directly instead of calling review_withdrawal after first
      // changing it to processing (which made the old RPC reject the request).
      const { error: paidError } = await supabaseAdmin.from("withdrawal_requests").update({
        ...providerPatch,
        status: "paid",
        processed_at: new Date().toISOString(),
        processed_by: auth.userId,
      }).eq("id", withdrawal.id).eq("status", withdrawal.status);
      if (paidError) return json({ error: paidError.message }, 500);
      await supabaseAdmin.from("notifications").insert({
        user_id: withdrawal.user_id,
        title: "Withdrawal imetumwa",
        message: `Payout ya TZS ${Number(withdrawal.payout_amount ?? withdrawal.amount).toLocaleString("en-US")} imetumwa kwenye namba yako.`,
      });
    } else {
      const { error: processingError } = await supabaseAdmin.from("withdrawal_requests").update({
        ...providerPatch,
        status: "processing",
      }).eq("id", withdrawal.id).eq("status", withdrawal.status);
      if (processingError) return json({ error: processingError.message }, 500);
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
  void request;
  return json({
    received: false,
    error: "Webhook signatures are not configured. Payment status is verified through authenticated polling.",
  }, 410);
}

