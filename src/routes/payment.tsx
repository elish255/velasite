import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, ExternalLink, Loader2, Smartphone, WalletCards } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";

const PAYMENT_AMOUNT = 12000;

type PaymentRequest = {
  id: string;
  phone: string;
  amount: number;
  status: "pending" | "approved" | "rejected";
  provider_reference: string | null;
  provider_status: string | null;
  provider_checkout_url: string | null;
  paid_at?: string | null;
};

export const Route = createFileRoute("/payment")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Activation Payment — 1Vela" },
      { name: "description", content: "Lipia activation fee kwa FimiPay Push kwenye 1Vela." },
    ],
  }),
  component: PaymentPage,
});

function PaymentPage() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [request, setRequest] = useState<PaymentRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  async function loadPaymentState() {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      navigate({ to: "/login", search: {} });
      return;
    }

    const [{ data: profile }, { data: latest }] = await Promise.all([
      supabase.from("profiles").select("phone, activated, banned").eq("id", auth.user.id).maybeSingle(),
      supabase
        .from("payment_requests")
        .select("id, phone, amount, status, provider_reference, provider_status, provider_checkout_url, paid_at")
        .eq("user_id", auth.user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (profile?.banned) {
      await supabase.auth.signOut();
      navigate({ to: "/login", search: {} });
      return;
    }
    if (profile?.activated) {
      navigate({ to: "/account" });
      return;
    }
    if (profile?.phone) setPhone(profile.phone);
    setRequest((latest as PaymentRequest | null) ?? null);
    setLoading(false);
  }

  useEffect(() => {
    void loadPaymentState();
  }, []);

  useEffect(() => {
    if (!request?.id || request.status !== "pending") return;
    const timer = window.setInterval(async () => {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;
      const response = await fetch("/api/fimipay", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "status", paymentId: request.id }),
      });
      if (response.ok) {
        const data = await response.json() as { request?: PaymentRequest };
        if (data.request) setRequest(data.request);
      }
    }, 5000);
    return () => window.clearInterval(timer);
  }, [request?.id, request?.status]);

  async function startPushPayment() {
    const cleanedPhone = phone.trim();
    if (!/^\+?[0-9][0-9\s-]{7,14}$/.test(cleanedPhone)) {
      toast.error("Weka namba sahihi ya simu ya mobile money.");
      return;
    }

    setSubmitting(true);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) {
        navigate({ to: "/login", search: {} });
        return;
      }
      const response = await fetch("/api/fimipay", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "create", phone: cleanedPhone }),
      });
      const data = await response.json() as { request?: PaymentRequest; checkoutUrl?: string | null; error?: string; message?: string };
      if (!response.ok) throw new Error(data.error || "FimiPay payment failed");
      if (data.request) setRequest(data.request);
      toast.success(data.message || "Payment push imetumwa. Angalia simu yako.");
      if (data.checkoutUrl) window.open(data.checkoutUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "FimiPay payment failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="grid min-h-screen place-items-center bg-background"><Loader2 className="size-7 animate-spin text-primary" /></div>;

  const providerPaid = ["success", "successful", "paid", "completed", "approved"].includes((request?.provider_status ?? "").toLowerCase());

  return (
    <div className="min-h-screen bg-background pb-10">
      <header className="header-surface px-5 py-5 text-header-foreground">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <Link to="/account" aria-label="Rudi" className="grid size-10 place-items-center rounded-full bg-brand-dark/50"><ArrowLeft className="size-5" /></Link>
          <img src="/1vela-logo.jpg" alt="1Vela" className="size-10 rounded-full bg-white object-contain" />
          <div><p className="font-extrabold">1Vela</p><p className="text-xs opacity-80">Automatic Payment / Push</p></div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 py-7">
        <div className="text-center">
          <div className="mx-auto grid size-16 place-items-center rounded-3xl bg-brand-tint text-primary"><WalletCards className="size-8" /></div>
          <h1 className="mt-4 font-display text-3xl font-extrabold">Activation Fee {PAYMENT_AMOUNT.toLocaleString("en-US")} TZS</h1>
          <p className="mt-2 text-muted-foreground">Weka namba yako ya mobile money. FimiPay itatuma payment push moja kwa moja.</p>
        </div>

        <section className="mt-7 rounded-3xl border border-border bg-card p-6 shadow-card">
          <div className="flex items-center gap-3"><div className="grid size-11 place-items-center rounded-2xl bg-brand-tint text-primary"><Smartphone className="size-5" /></div><div><h2 className="font-display text-xl font-extrabold">FimiPay Push</h2><p className="text-sm text-muted-foreground">Automatic payment request</p></div></div>
          <label className="mt-6 grid gap-2"><span className="text-sm font-bold">Namba ya simu</span><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07XX XXX XXX" className="input-base" disabled={submitting || request?.status === "pending"} /></label>
          <button type="button" onClick={() => void startPushPayment()} disabled={submitting || request?.status === "pending" || request?.status === "approved"} className="brand-gradient mt-5 flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-4 text-lg font-extrabold text-brand-foreground shadow-brand disabled:cursor-not-allowed disabled:opacity-60">
            {submitting ? <Loader2 className="size-5 animate-spin" /> : <Smartphone className="size-5" />}
            {request?.status === "pending" ? "Push Imetumwa / Inasubiri" : "Lipa kwa FimiPay Push"}
          </button>
        </section>

        {request && (
          <section className="mt-5 rounded-3xl border border-border bg-card p-6 shadow-card">
            <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-bold text-muted-foreground">Payment status</p><p className="mt-1 font-display text-2xl font-extrabold">{request.status === "approved" ? "Approved" : providerPaid ? "Payment Received" : request.status === "rejected" ? "Rejected" : "Pending"}</p></div><CheckCircle2 className={providerPaid || request.status === "approved" ? "size-8 text-primary" : "size-8 text-slate-300"} /></div>
            <div className="mt-5 grid gap-2 text-sm"><InfoRow label="Amount" value={`TZS ${Number(request.amount).toLocaleString("en-US")}`} /><InfoRow label="Phone" value={request.phone} /><InfoRow label="FimiPay status" value={request.provider_status || "waiting"} /><InfoRow label="Reference" value={request.provider_reference || "—"} /></div>
            {request.provider_checkout_url && <a href={request.provider_checkout_url} target="_blank" rel="noreferrer" className="mt-5 flex items-center justify-center gap-2 rounded-2xl border border-primary px-5 py-3 font-extrabold text-primary">Open FimiPay Checkout <ExternalLink className="size-4" /></a>}
            {providerPaid && request.status === "pending" && <div className="mt-5 rounded-2xl bg-brand-tint p-4 text-sm font-bold text-primary">Malipo yamepokelewa na FimiPay. Admin ata-review na ku-activate account yako.</div>}
            {request.status === "approved" && <Link to="/account" className="mt-5 flex items-center justify-center rounded-2xl bg-brand-tint px-5 py-3 font-extrabold text-primary">Endelea kwenye Dashboard</Link>}
          </section>
        )}

        <p className="mt-5 text-center text-xs font-semibold text-muted-foreground">Usishiriki PIN yako. FimiPay Push itatokea kwenye simu yako na uta-confirm wewe mwenyewe.</p>
      </main>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4 border-b border-border pb-2 last:border-0"><span className="text-muted-foreground">{label}</span><span className="max-w-[65%] break-all text-right font-bold">{value}</span></div>;
}
