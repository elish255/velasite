import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, Loader2, Smartphone, WalletCards } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/payment")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Malipo — 1Vela" },
      { name: "description", content: "Lipia activation fee ya 1Vela kwa Automatic Push au Lipa Namba." },
    ],
  }),
  component: PaymentPage,
});

const LIPA_NAMBA = "251226427";
const LIPA_JINA = "INNOCENT EDWARD";
const PRICE = Number(import.meta.env.VITE_ACTIVATION_FEE || 12000);
type Method = "automatic" | "manual";

type PaymentRow = {
  id: string;
  phone: string;
  amount: number;
  status: "pending" | "approved" | "rejected";
  provider?: string | null;
  provider_reference: string | null;
  provider_status: string | null;
  provider_checkout_url?: string | null;
  paid_at?: string | null;
};

function PaymentPage() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [method, setMethod] = useState<Method>("automatic");
  const [paidPrompt, setPaidPrompt] = useState(false);
  const [firstPopup, setFirstPopup] = useState(false);
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [latestStatus, setLatestStatus] = useState<string | null>(null);
  const [request, setRequest] = useState<PaymentRow | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      if (!data.user) navigate({ to: "/login", search: {} });
      else setUserId(data.user.id);
    });
    return () => { mounted = false; };
  }, [navigate]);

  useEffect(() => {
    if (!userId) return;
    const check = async () => {
      const [{ data: profile }, { data: manual }] = await Promise.all([
        supabase.from("profiles").select("activated,phone,banned").eq("id", userId).maybeSingle(),
        supabase.from("payment_requests").select("id,phone,amount,status,provider,provider_reference,provider_status,provider_checkout_url,paid_at")
          .eq("user_id", userId).eq("provider", "manual").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (profile?.banned) { setMessage("Akaunti yako imezuiwa. Wasiliana na admin."); return; }
      if (profile?.activated) { navigate({ to: "/account" }); return; }
      if (profile?.phone && !phone) setPhone(profile.phone);
      setRequest((manual as PaymentRow | null) ?? null);
      setLatestStatus(manual?.status ?? null);
    };
    void check();
    const timer = setInterval(check, 5000);
    return () => clearInterval(timer);
  }, [userId, navigate]);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  async function callAutomatic(body: Record<string, unknown>) {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) throw new Error("Login session imekwisha. Ingia tena.");
    const response = await fetch(body.action === "status" ? `/api/fimipay/payment-status?requestId=${encodeURIComponent(String(body.requestId))}` : "/api/fimipay/payment", {
      method: body.action === "status" ? "GET" : "POST",
      headers: { ...(body.action === "status" ? {} : { "Content-Type": "application/json" }), Authorization: `Bearer ${token}` },
      ...(body.action === "status" ? {} : { body: JSON.stringify(body) }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data) throw new Error(data?.error || "Imeshindikana kuanzisha malipo.");
    return data as { request?: PaymentRow; paid?: boolean; failed?: boolean; status?: string; message?: string; error?: string; redirect?: string };
  }

  async function pollAutomaticPayment(requestId: string) {
    if (pollRef.current) clearInterval(pollRef.current);
    const check = async () => {
      try {
        const data = await callAutomatic({ action: "status", requestId });
        if (data.request) setRequest(data.request);
        setLatestStatus(data.status ?? null);
        if (data.paid || data.redirect === "/account") {
          if (pollRef.current) clearInterval(pollRef.current);
          navigate({ to: "/account" });
        } else if (data.failed) {
          if (pollRef.current) clearInterval(pollRef.current);
          setMessage("Ombi la malipo limeshindikana. Unaweza kujaribu tena.");
        }
      } catch (error) {
        console.error("Payment status check failed", error);
      }
    };
    await check();
    pollRef.current = setInterval(check, 4000);
  }

  async function startAutomaticPayment() {
    if (!phone.trim()) { setMessage("Weka namba ya simu unayotaka kulipia."); return; }
    setSaving(true);
    setMessage("Push inatumwa kwenye simu yako...");
    try {
      const data = await callAutomatic({ action: "create", phone: phone.trim() });
      if (data.request) setRequest(data.request);
      setLatestStatus(data.status ?? "PENDING");
      if (data.paid || data.redirect === "/account") { navigate({ to: "/account" }); return; }
      if (!data.request?.id) throw new Error(data.error || "Ombi la malipo halijaanzishwa.");
      setMessage(data.message || "Push imetumwa. Angalia simu yako na thibitisha malipo.");
      await pollAutomaticPayment(data.request.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Imeshindikana kuanzisha malipo.");
    } finally { setSaving(false); }
  }

  async function submitManualPayment() {
    if (!phone.trim()) { setMessage("Weka namba ya simu uliyotumia kufanya malipo."); return; }
    if (!userId) return;
    setSaving(true);
    const { data, error } = await supabase.from("payment_requests").insert({ user_id: userId, phone: phone.trim(), amount: PRICE, provider: "manual" })
      .select("id,phone,amount,status,provider,provider_reference,provider_status,provider_checkout_url,paid_at").single();
    setSaving(false);
    if (error) {
      setMessage("Taarifa haijatumwa. Kama tayari umetuma, subiri admin akuthibitishe.");
      return;
    }
    setRequest(data as PaymentRow);
    setLatestStatus("pending");
    setMessage("Taarifa ya malipo imetumwa. Subiri admin akuthibitishe.");
  }

  function handlePaidClick() {
    if (!paidPrompt) { setPaidPrompt(true); setFirstPopup(true); setMessage(null); return; }
    void submitManualPayment();
  }

  if (!userId) return <div className="grid min-h-screen place-items-center bg-background"><Loader2 className="size-7 animate-spin text-primary" /></div>;

  return (
    <div className="min-h-screen bg-background pb-10">
      <header className="header-surface px-5 py-5 text-header-foreground">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <Link to="/account" aria-label="Rudi" className="grid size-10 place-items-center rounded-full bg-brand-dark/50"><ArrowLeft className="size-5" /></Link>
          <img src="/1vela-logo.jpg" alt="1Vela" className="size-10 rounded-full bg-white object-contain" />
          <div><p className="font-extrabold">1Vela</p><p className="text-xs opacity-80">Activation Payment</p></div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-3 py-6">
        <div className="rounded-2xl bg-card p-5 shadow-card">
          <h1 className="text-center text-2xl font-extrabold">💳 FANYA MALIPO</h1>
          <p className="mt-2 text-center text-sm text-muted-foreground">Lipia TZS {PRICE.toLocaleString()} na account yako ita-activate baada ya malipo kuthibitishwa.</p>

          <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl bg-secondary p-1">
            <button onClick={() => { setMethod("automatic"); setMessage(null); }} className={`rounded-lg px-3 py-3 text-sm font-extrabold ${method === "automatic" ? "bg-primary text-primary-foreground" : ""}`}>⚡ Automatic Push</button>
            <button onClick={() => { setMethod("manual"); setMessage(null); }} className={`rounded-lg px-3 py-3 text-sm font-extrabold ${method === "manual" ? "bg-primary text-primary-foreground" : ""}`}>🧾 Lipa Namba</button>
          </div>

          {method === "automatic" ? (
            <div className="mt-5 rounded-2xl border border-primary/30 bg-primary/5 p-5">
              <div className="text-center text-5xl">⚡</div>
              <h2 className="mt-3 text-center text-xl font-extrabold">LIPA KWA PUSH</h2>
              <p className="mt-2 text-center text-sm text-muted-foreground">Weka namba ya simu ya M-Pesa/Mixx/Airtel Money/HaloPesa unayotaka kulipia.</p>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" placeholder="0712345678" className="mt-4 w-full rounded-xl border border-input bg-background px-3 py-3 outline-none" disabled={saving} />
              <button onClick={() => void startAutomaticPayment()} disabled={saving || !phone.trim()} className="cta-glow mt-3 w-full rounded-xl bg-primary px-4 py-3 font-extrabold text-primary-foreground disabled:opacity-60">
                {saving ? "Inatuma Push..." : `⚡ LIPA TZS ${PRICE.toLocaleString()} KWA PUSH`}
              </button>
              {request?.provider === "automatic" && request.provider_status && (
                <div className="mt-4 rounded-xl border border-border bg-background p-3 text-center text-sm">
                  <p className="font-extrabold">Status: {latestStatus || request.provider_status}</p>
                  <p className="mt-1 text-muted-foreground">Thibitisha ombi kwenye simu yako.</p>
                </div>
              )}
            </div>
          ) : (
            <ManualPayment paidPrompt={paidPrompt} firstPopup={firstPopup} phone={phone} setPhone={setPhone} saving={saving} onPaid={handlePaidClick} closePopup={() => setFirstPopup(false)} latestStatus={latestStatus} />
          )}

          {message && <p className="mt-4 rounded-xl bg-secondary px-4 py-3 text-center text-sm font-semibold">{message}</p>}
          <Link to="/" className="mt-4 block text-center font-bold">← Rudi nyuma</Link>
        </div>
      </main>
    </div>
  );
}

function ManualPayment({ paidPrompt, firstPopup, phone, setPhone, saving, onPaid, closePopup, latestStatus }: {
  paidPrompt: boolean; firstPopup: boolean; phone: string; setPhone: (v: string) => void; saving: boolean; onPaid: () => void; closePopup: () => void; latestStatus: string | null;
}) {
  return <>
    <div className="mt-5 rounded-xl border border-teal/40 bg-secondary p-4 text-center">
      <p className="text-xs font-bold tracking-widest text-muted-foreground">LIPA NAMBA</p>
      <div className="mt-1 flex items-center justify-center gap-2"><strong className="text-3xl text-primary">{LIPA_NAMBA}</strong><button onClick={() => navigator.clipboard?.writeText(LIPA_NAMBA)} className="rounded-lg border px-2 py-1 text-xs font-bold">Copy</button></div>
      <p className="mt-2 text-sm font-bold">Jina: {LIPA_JINA}</p>
    </div>

    <div className="mt-5 space-y-3">
      <PaymentMethod logo="https://brandlogos.net/wp-content/uploads/2025/04/vodacom-logo_brandlogos.net_4uzfe.png" name="Vodacom M-Pesa" steps={["*150*00#", "Lipa kwa M-PESA", `Lipa kwa namba ${LIPA_NAMBA}`, `Weka TZS ${PRICE.toLocaleString()}`]} />
      <PaymentMethod logo="https://www.uminolan.co.tz/assets/images/supa-agent/mixx-by-yas-seeklogo2.png" name="Mixx by Yas" steps={["*150*01#", "Lipa kwa simu", `Chagua namba ya malipo ${LIPA_NAMBA}`, `Weka TZS ${PRICE.toLocaleString()}`]} />
      <PaymentMethod logo="https://nikulipe.com/wp-content/uploads/2022/09/Airtel_logo_PNG1.png" name="Airtel Money" steps={["*150*60#", "Lipia Bili", `Ingiza namba ya malipo ${LIPA_NAMBA}`, `Weka TZS ${PRICE.toLocaleString()}`]} />
      <PaymentMethod logo="https://halopesa.co.tz/images/applications-system.png" name="Halopesa" steps={["*150*88#", "Lipia Bidhaa", `Weka namba ya malipo ${LIPA_NAMBA}`, `Weka TZS ${PRICE.toLocaleString()}`]} />
    </div>

    {paidPrompt && !firstPopup && <div className="mt-5 rounded-xl border border-primary/30 bg-primary/5 p-4"><p className="font-extrabold">Umeshalipia?</p><p className="mt-1 text-sm text-muted-foreground">Weka namba ya simu uliyotumia kufanya malipo.</p><input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" placeholder="0712345678" className="mt-3 w-full rounded-xl border border-input bg-background px-3 py-3 outline-none" /></div>}

    {firstPopup && <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-deep/70 p-4 backdrop-blur-sm"><div className="relative w-full max-w-sm rounded-2xl bg-card p-6 text-center shadow-card"><button onClick={closePopup} className="absolute right-4 top-3 text-2xl text-muted-foreground">×</button><div className="text-5xl">💳</div><h2 className="mt-3 text-2xl font-extrabold">FANYA MALIPO KISHA JARIBU TENA</h2><p className="mt-3 text-sm text-muted-foreground">Kamilisha malipo ya TZS {PRICE.toLocaleString()} kwa kutumia maelekezo hapo juu.</p><button onClick={closePopup} className="mt-5 w-full rounded-xl bg-primary px-4 py-3 font-extrabold text-primary-foreground">Sawa</button></div></div>}

    {latestStatus === "pending" && <div className="mt-4 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-center text-sm font-semibold">⏳ Malipo yako yapo kwenye review ya admin. Tafadhali subiri.</div>}
    {latestStatus === "rejected" && <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-center text-sm font-semibold">❌ Malipo haya yamekataliwa. Hakikisha taarifa za malipo ni sahihi kisha tuma tena.</div>}
    <button onClick={onPaid} disabled={saving} className="cta-glow mt-5 w-full rounded-xl bg-primary px-4 py-3 font-extrabold text-primary-foreground disabled:opacity-60">{saving ? "Inatuma..." : "✅ NIMELIPIA"}</button>
  </>;
}

function PaymentMethod({ logo, name, steps }: { logo: string; name: string; steps: string[] }) {
  const [open, setOpen] = useState(false);
  return <div className="overflow-hidden rounded-xl border border-border"><button onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-3 p-3 text-left"><img src={logo} alt={name} className="size-10 rounded-lg object-contain" /><span className="flex-1 font-extrabold">{name}</span><span>{open ? "⌃" : "⌄"}</span></button>{open && <ol className="space-y-2 border-t border-border bg-secondary/40 p-4 text-sm">{steps.map((s, i) => <li key={s}><span className="mr-2 inline-grid size-6 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{i + 1}</span>{s}</li>)}</ol>}</div>;
}
