import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, Copy, Loader2, Smartphone, WalletCards } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";

const PAYMENT_AMOUNT = 12000;
const LIPA_NUMBER = "251161660";

type PaymentRequest = {
  id: string;
  user_id?: string;
  phone: string;
  amount: number;
  status: "pending" | "approved" | "rejected";
  provider: string;
  provider_reference: string | null;
  provider_status: string | null;
  provider_checkout_url: string | null;
  paid_at?: string | null;
};

type ApiResponse = {
  ok?: boolean;
  request?: PaymentRequest;
  error?: string;
  message?: string;
  activated?: boolean;
  redirect?: string;
};

const failureStatuses = new Set(["failed", "failure", "cancelled", "canceled", "rejected", "declined", "expired"]);

export const Route = createFileRoute("/payment")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Activation Payment — 1Vela" },
      { name: "description", content: "Chagua njia ya kulipia activation ya 1Vela." },
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
  const [method, setMethod] = useState<"automatic" | "manual">("automatic");

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
        .select("id, user_id, phone, amount, status, provider, provider_reference, provider_status, provider_checkout_url, paid_at")
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

    const latestPayment = (latest as PaymentRequest | null) ?? null;
    setRequest(latestPayment);
    if (latestPayment?.provider === "manual") setMethod("manual");
    setLoading(false);
  }

  useEffect(() => {
    void loadPaymentState();
  }, []);

  useEffect(() => {
    if (!request?.id || request.status !== "pending") return;

    const timer = window.setInterval(async () => {
      if (request.provider === "automatic") {
        const token = (await supabase.auth.getSession()).data.session?.access_token;
        if (!token) return;
        const response = await fetch("/api/fimipay", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ action: "status", paymentId: request.id }),
        });
        const data = await response.json().catch(() => ({} as ApiResponse)) as ApiResponse;
        if (data.request) setRequest(data.request);
        if (data.activated || data.request?.status === "approved") {
          toast.success("Malipo yamepokelewa. Account yako imewashwa.");
          navigate({ to: "/account" });
        }
        return;
      }

      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const [{ data: latest }, { data: profile }] = await Promise.all([
        supabase
          .from("payment_requests")
          .select("id, user_id, phone, amount, status, provider, provider_reference, provider_status, provider_checkout_url, paid_at")
          .eq("id", request.id)
          .eq("user_id", auth.user.id)
          .maybeSingle(),
        supabase.from("profiles").select("activated").eq("id", auth.user.id).maybeSingle(),
      ]);
      if (latest) setRequest(latest as PaymentRequest);
      if (profile?.activated || latest?.status === "approved") {
        toast.success("Malipo yamethibitishwa. Account yako imewashwa.");
        navigate({ to: "/account" });
      }
    }, 5000);

    return () => window.clearInterval(timer);
  }, [request?.id, request?.status, request?.provider, navigate]);

  async function callApi(action: "create" | "manual") {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) {
      navigate({ to: "/login", search: {} });
      return null;
    }
    const response = await fetch("/api/fimipay", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action, phone: phone.trim() }),
    });
    const data = await response.json().catch(() => ({} as ApiResponse)) as ApiResponse;
    if (!response.ok) throw new Error(data.error || "Ombi la malipo limeshindikana.");
    return data;
  }

  async function startAutomaticPayment() {
    const cleanedPhone = phone.trim();
    if (!/^\+?[0-9][0-9\s-]{7,14}$/.test(cleanedPhone)) {
      toast.error("Weka namba sahihi ya simu.");
      return;
    }
    setSubmitting(true);
    try {
      const data = await callApi("create");
      if (!data) return;
      if (data.request) setRequest(data.request);
      if (data.activated) {
        navigate({ to: "/account" });
        return;
      }
      toast.success(data.message || "Ombi la malipo limetumwa. Angalia simu yako.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ombi la malipo limeshindikana.");
    } finally {
      setSubmitting(false);
    }
  }

  async function claimManualPayment() {
    const cleanedPhone = phone.trim();
    if (!/^\+?[0-9][0-9\s-]{7,14}$/.test(cleanedPhone)) {
      toast.error("Weka namba uliyotumia kulipia.");
      return;
    }
    setSubmitting(true);
    try {
      const data = await callApi("manual");
      if (!data) return;
      if (data.request) setRequest(data.request);
      toast.success(data.message || "Taarifa imetumwa kwa admin.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Taarifa haikutumwa.");
    } finally {
      setSubmitting(false);
    }
  }

  async function copyLipaNumber() {
    try {
      await navigator.clipboard.writeText(LIPA_NUMBER);
      toast.success("LIPA NAMBA imekopiwa.");
    } catch {
      toast.error("Imeshindikana ku-copy namba.");
    }
  }

  if (loading) return <div className="grid min-h-screen place-items-center bg-background"><Loader2 className="size-7 animate-spin text-primary" /></div>;

  const providerStatus = (request?.provider_status ?? "").toLowerCase();
  const isManualPending = request?.provider === "manual" && request.status === "pending";
  const isAutomaticPending = request?.provider === "automatic" && request.status === "pending" && !failureStatuses.has(providerStatus);
  const automaticFailed = request?.provider === "automatic" && failureStatuses.has(providerStatus);

  return (
    <div className="min-h-screen bg-background pb-10">
      <header className="header-surface px-5 py-5 text-header-foreground">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <Link to="/" aria-label="Rudi" className="grid size-10 place-items-center rounded-full bg-brand-dark/50"><ArrowLeft className="size-5" /></Link>
          <img src="/1vela-logo.jpg" alt="1Vela" className="size-10 rounded-full bg-white object-contain" />
          <div><p className="font-extrabold">1Vela</p><p className="text-xs opacity-80">Activation Payment</p></div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 py-7">
        <div className="text-center">
          <div className="mx-auto grid size-16 place-items-center rounded-3xl bg-brand-tint text-primary"><WalletCards className="size-8" /></div>
          <h1 className="mt-4 font-display text-3xl font-extrabold">Activation Fee {PAYMENT_AMOUNT.toLocaleString("en-US")} TZS</h1>
          <p className="mt-2 text-muted-foreground">Chagua njia unayotaka kutumia kulipia activation ya account yako.</p>
        </div>

        <div className="mt-7 grid grid-cols-2 rounded-2xl bg-slate-100 p-1">
          <button type="button" onClick={() => setMethod("automatic")} className={`rounded-xl px-4 py-3 text-sm font-extrabold ${method === "automatic" ? "bg-white text-primary shadow-sm" : "text-slate-500"}`}>Malipo Automatic</button>
          <button type="button" onClick={() => setMethod("manual")} className={`rounded-xl px-4 py-3 text-sm font-extrabold ${method === "manual" ? "bg-white text-primary shadow-sm" : "text-slate-500"}`}>LIPA NAMBA</button>
        </div>

        {method === "automatic" ? (
          <section className="mt-5 rounded-3xl border border-border bg-card p-6 shadow-card">
            <div className="flex items-center gap-3"><div className="grid size-11 place-items-center rounded-2xl bg-brand-tint text-primary"><Smartphone className="size-5" /></div><div><h2 className="font-display text-xl font-extrabold">Malipo Automatic</h2><p className="text-sm text-muted-foreground">Ombi la malipo litatumwa kwenye simu yako.</p></div></div>
            <label className="mt-6 grid gap-2"><span className="text-sm font-bold">Namba ya simu</span><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07XX XXX XXX" className="input-base" disabled={submitting || isAutomaticPending || isManualPending} /></label>
            <button type="button" onClick={() => void startAutomaticPayment()} disabled={submitting || isAutomaticPending || isManualPending} className="brand-gradient mt-5 flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-4 text-lg font-extrabold text-brand-foreground shadow-brand disabled:cursor-not-allowed disabled:opacity-60">
              {submitting ? <Loader2 className="size-5 animate-spin" /> : <Smartphone className="size-5" />}
              {isAutomaticPending ? "Ombi limetumwa / Inasubiri" : automaticFailed ? "Jaribu Tena" : "Lipa Sasa"}
            </button>
            {automaticFailed && <p className="mt-4 rounded-2xl bg-red-50 p-4 text-center text-sm font-bold text-red-700">Ombi la malipo halikukamilika. Hakuna fedha iliyothibitishwa. Unaweza kujaribu tena.</p>}
            <p className="mt-4 text-center text-xs font-semibold text-muted-foreground">Baada ya malipo kuthibitishwa, account itafunguka moja kwa moja.</p>
          </section>
        ) : (
          <section className="mt-5 rounded-3xl border border-border bg-card p-6 shadow-card">
            <div className="flex items-center gap-3"><div className="grid size-11 place-items-center rounded-2xl bg-brand-tint text-primary"><WalletCards className="size-5" /></div><div><h2 className="font-display text-xl font-extrabold">LIPA NAMBA</h2><p className="text-sm text-muted-foreground">Lipa manually kisha tuma uthibitisho.</p></div></div>
            <div className="mt-5 rounded-2xl bg-brand-tint p-5 text-center">
              <p className="text-xs font-extrabold uppercase tracking-widest text-primary">LIPA NAMBA</p>
              <p className="mt-2 text-3xl font-black tracking-wider text-slate-900">{LIPA_NUMBER}</p>
              <p className="mt-2 text-sm font-semibold text-slate-600">Kiasi: TZS {PAYMENT_AMOUNT.toLocaleString("en-US")}</p>
              <button type="button" onClick={() => void copyLipaNumber()} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-extrabold text-primary"><Copy className="size-4" /> Copy Number</button>
            </div>
            <label className="mt-6 grid gap-2"><span className="text-sm font-bold">Namba uliyotumia kulipia</span><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07XX XXX XXX" className="input-base" disabled={submitting || isManualPending || isAutomaticPending} /></label>
            <button type="button" onClick={() => void claimManualPayment()} disabled={submitting || isManualPending || isAutomaticPending} className="brand-gradient mt-5 flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-4 text-lg font-extrabold text-brand-foreground shadow-brand disabled:cursor-not-allowed disabled:opacity-60">
              {submitting ? <Loader2 className="size-5 animate-spin" /> : <CheckCircle2 className="size-5" />}
              {isManualPending ? "Taarifa Imetumwa" : "NIMELIPIA"}
            </button>
            <p className="mt-4 text-center text-xs font-semibold text-muted-foreground">Baada ya kugusa NIMELIPIA, admin atahakikisha muamala na akiidhinisha account yako itafunguka.</p>
          </section>
        )}

        {request && (
          <section className="mt-5 rounded-3xl border border-border bg-card p-6 shadow-card">
            <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-bold text-muted-foreground">Payment status</p><p className="mt-1 font-display text-2xl font-extrabold">{request.status === "approved" ? "Approved" : isManualPending ? "Inasubiri uthibitisho" : automaticFailed ? "Imeshindikana" : "Inasubiri"}</p></div><CheckCircle2 className={request.status === "approved" ? "size-8 text-primary" : "size-8 text-slate-300"} /></div>
            <div className="mt-5 grid gap-2 text-sm"><InfoRow label="Amount" value={`TZS ${Number(request.amount).toLocaleString("en-US")}`} /><InfoRow label="Phone" value={request.phone} /><InfoRow label="Method" value={request.provider === "manual" ? "LIPA NAMBA" : "Automatic Payment"} /></div>
            {isManualPending && <div className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-800">Taarifa yako imefika kwa admin. Subiri uthibitisho wa muamala.</div>}
            {request.status === "approved" && <button type="button" onClick={() => navigate({ to: "/account" })} className="mt-5 flex w-full items-center justify-center rounded-2xl bg-brand-tint px-5 py-3 font-extrabold text-primary">Endelea kwenye Dashboard</button>}
          </section>
        )}

        <p className="mt-5 text-center text-xs font-semibold text-muted-foreground">Usishiriki PIN yako na mtu mwingine.</p>
      </main>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4 border-b border-border pb-2 last:border-0"><span className="text-muted-foreground">{label}</span><span className="max-w-[65%] break-all text-right font-bold">{value}</span></div>;
}
