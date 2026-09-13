import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, Copy, Loader2, Smartphone, WalletCards } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";

const PAYMENT_AMOUNT = 15000;
const LIPA_NUMBER = "251161660";
const BUSINESS_NAME = "ASSERT BRIDGE";

type PaymentStatus = "pending" | "approved" | "rejected";

type PaymentRequest = {
  id: string;
  phone: string;
  amount: number;
  status: PaymentStatus;
  created_at: string;
};

export const Route = createFileRoute("/payment")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Lipia Activation Fee — 1Vela" },
      {
        name: "description",
        content: "Maelekezo ya kulipia activation fee ya 15,000 TZS kwenye 1Vela.",
      },
    ],
  }),
  component: PaymentPage,
});

function PaymentPage() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [request, setRequest] = useState<PaymentRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  async function loadPaymentState() {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      navigate({ to: "/login", search: {} });
      return;
    }

    setUserId(auth.user.id);

    const { data: profile } = await supabase
      .from("profiles")
      .select("phone, activated")
      .eq("id", auth.user.id)
      .maybeSingle();

    if (profile?.phone) setPhone(profile.phone);

    const { data: latest } = await supabase
      .from("payment_requests")
      .select("id, phone, amount, status, created_at")
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    setRequest((latest as PaymentRequest | null) ?? null);
    setLoading(false);
  }

  useEffect(() => {
    void loadPaymentState();
  }, []);

  useEffect(() => {
    if (!userId || request?.status !== "pending") return;

    const timer = window.setInterval(() => {
      void loadPaymentState();
    }, 5000);

    return () => window.clearInterval(timer);
  }, [userId, request?.status]);

  async function copyNumber() {
    await navigator.clipboard.writeText(LIPA_NUMBER);
    toast.success("LIPA NAMBA imekopiwa");
  }

  async function submitPayment() {
    const cleanedPhone = phone.trim();
    if (!/^\+?[0-9][0-9\s-]{7,14}$/.test(cleanedPhone)) {
      toast.error("Weka namba ya simu uliyotumia kufanya malipo.");
      return;
    }

    setSubmitting(true);
    const { data, error } = await supabase
      .from("payment_requests")
      .insert({
        user_id: userId,
        phone: cleanedPhone,
        amount: PAYMENT_AMOUNT,
      })
      .select("id, phone, amount, status, created_at")
      .single();
    setSubmitting(false);

    if (error) {
      if (error.code === "23505") {
        toast.info("Tayari una ombi la malipo linalosubiri approval.");
        await loadPaymentState();
      } else {
        toast.error(error.message);
      }
      return;
    }

    setRequest(data as PaymentRequest);
    toast.success("Waiting for your Payment Approval");
  }

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="size-7 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-10">
      <header className="header-surface px-5 py-5 text-header-foreground">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <Link
            to="/account"
            aria-label="Rudi"
            className="grid size-10 place-items-center rounded-full bg-brand-dark/50"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <div>
            <img src="/1vela-logo.jpg" alt="1Vela" className="h-10 w-10 rounded-full bg-white object-contain shadow-sm ring-1 ring-primary/20" />
            <p className="text-xs opacity-80">Activation Payment</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 py-7">
        <div className="text-center">
          <div className="mx-auto grid size-16 place-items-center rounded-3xl bg-brand-tint text-primary">
            <WalletCards className="size-8" />
          </div>
          <h1 className="mt-4 font-display text-3xl font-extrabold">Lipia Activation Fee</h1>
          <p className="mt-2 text-muted-foreground">
            Lipia kisha weka namba ya simu uliyofanya malipo.
          </p>
        </div>

        <div className="mt-7 rounded-3xl border border-border bg-card p-5 shadow-card">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-muted-foreground">Activation Fee</p>
              <p className="mt-1 font-display text-3xl font-extrabold text-primary">
                {PAYMENT_AMOUNT.toLocaleString("en-US")} TZS
              </p>
            </div>
            <CheckCircle2 className="size-8 text-primary" />
          </div>
          <div className="mt-5 rounded-2xl bg-brand-tint p-4">
            <p className="text-sm font-bold text-muted-foreground">Jina la Biashara</p>
            <p className="mt-1 font-display text-xl font-extrabold">{BUSINESS_NAME}</p>
          </div>
        </div>

        <section className="mt-5 rounded-3xl border border-border bg-card p-5 shadow-card">
          <div className="mb-5 flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-2xl bg-brand-tint text-primary">
              <Smartphone className="size-5" />
            </div>
            <div>
              <h2 className="font-display text-xl font-extrabold">Njia za Malipo / USSD Menu</h2>
              <p className="text-sm text-muted-foreground">Chagua mtandao wako hapa chini.</p>
            </div>
          </div>

          <div className="grid gap-3">
            <Operator
              title="Vodacom M-Pesa"
              ussd="*150*00#"
              logo="https://brandlogos.net/wp-content/uploads/2025/04/vodacom-logo_brandlogos.net_4uzfe.png"
              steps={[
                <>Bonyeza <strong>*150*00#</strong></>,
                <>Chagua <strong>Lipa kwa M-PESA</strong></>,
                <>Chagua <strong>LIPA KWA SIMU / HALOPESA</strong></>,
                <>Weka LIPA NAMBA: <PaymentNumber onCopy={copyNumber} /></>,
                <>Weka kiasi <strong>15,000 TZS</strong></>,
                <>Weka namba ya siri na ruhusu muamala.</>,
              ]}
            />
            <Operator
              title="Mixx by Yas"
              ussd="*150*01#"
              logo="https://www.uminolan.co.tz/assets/images/supa-agent/mixx-by-yas-seeklogo2.png"
              steps={[
                <>Bonyeza <strong>*150*01#</strong></>,
                <>Chagua <strong>Lipa kwa simu</strong></>,
                <>Chagua <strong>Kwenda mitandao mingine</strong></>,
                <>Chagua <strong>HALOPESA</strong></>,
                <>Weka LIPA NAMBA: <PaymentNumber onCopy={copyNumber} /></>,
                <>Weka kiasi <strong>15,000 TZS</strong></>,
                <>Weka namba ya siri na ruhusu muamala.</>,
              ]}
            />
            <Operator
              title="Airtel Money"
              ussd="*150*60#"
              logo="https://nikulipe.com/wp-content/uploads/2022/09/Airtel_logo_PNG1.png"
              steps={[
                <>Bonyeza <strong>*150*60#</strong></>,
                <>Chagua <strong>Lipia Bili</strong></>,
                <>Chagua <strong>LIPA KWA SIMU (MITANDAO YOTE)</strong></>,
                <>Chagua <strong>LIPA KWA HALOPESA</strong></>,
                <>Weka kiasi <strong>15,000 TZS</strong></>,
                <>Ingiza kumbukumbu ya malipo: <PaymentNumber onCopy={copyNumber} /></>,
                <>Ingiza namba ya siri kuruhusu muamala.</>,
              ]}
            />
            <Operator
              title="Halopesa"
              ussd="*150*88#"
              logo="https://halopesa.co.tz/images/applications-system.png"
              steps={[
                <>Bonyeza <strong>*150*88#</strong></>,
                <>Chagua <strong>(5) Lipia Bidhaa</strong></>,
                <>Chagua <strong>HALOPESA</strong></>,
                <>Weka namba ya malipo: <PaymentNumber onCopy={copyNumber} /></>,
                <>Weka kiasi <strong>15,000 TZS</strong></>,
                <>Ingiza namba ya siri.</>,
                <>Bonyeza <strong>1</strong> kuruhusu muamala.</>,
              ]}
            />
          </div>

          <div className="mt-5 rounded-2xl border border-primary/20 bg-brand-tint p-4 text-center">
            <p className="text-sm font-bold text-muted-foreground">LIPA NAMBA</p>
            <button
              type="button"
              onClick={copyNumber}
              className="mt-1 inline-flex items-center gap-2 font-display text-2xl font-extrabold text-primary"
            >
              {LIPA_NUMBER}
              <Copy className="size-5" />
            </button>
            <p className="mt-1 text-sm font-semibold">Jina la Biashara: {BUSINESS_NAME}</p>
          </div>
        </section>

        <section className="mt-5 rounded-3xl border border-border bg-card p-5 shadow-card">
          <label className="grid gap-2">
            <span className="font-bold">Namba ya Simu</span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0712 345 678"
              className="input-base"
              disabled={request?.status === "pending" || request?.status === "approved"}
            />
          </label>

          {request?.status === "pending" ? (
            <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-4 text-sm font-bold text-amber-800">
              Waiting for your Payment Approval
            </div>
          ) : request?.status === "approved" ? (
            <div className="mt-4 rounded-2xl bg-brand-tint px-4 py-4 text-sm font-bold text-primary">
              Payment approved. Account yako imewashwa.
            </div>
          ) : request?.status === "rejected" ? (
            <div className="mt-4 rounded-2xl bg-destructive/10 px-4 py-4 text-sm font-bold text-destructive">
              Payment request imekataliwa. Hakikisha umeweka namba sahihi na umetuma 15,000 TZS, kisha jaribu tena.
            </div>
          ) : null}

          <button
            type="button"
            onClick={submitPayment}
            disabled={submitting || request?.status === "pending" || request?.status === "approved"}
            className="brand-gradient mt-4 flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-4 text-lg font-extrabold text-brand-foreground shadow-brand disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting && <Loader2 className="size-5 animate-spin" />}
            Nimelipia
          </button>

          <p className="mt-3 text-center text-xs font-semibold text-muted-foreground">
            Bonyeza baada ya kukamilisha malipo. Taarifa yako itatumwa kwa admin kwa ajili ya verification.
          </p>

          {request?.status === "approved" && (
            <Link
              to="/"
              className="mt-4 flex w-full justify-center rounded-2xl border border-primary py-3 font-extrabold text-primary"
            >
              Endelea Kuchat
            </Link>
          )}
        </section>
      </main>
    </div>
  );
}

function PaymentNumber({ onCopy }: { onCopy: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 font-extrabold text-primary">
      {LIPA_NUMBER}
      <button
        type="button"
        onClick={onCopy}
        className="rounded-lg bg-primary/10 px-2 py-1 text-xs text-primary"
      >
        Copy
      </button>
    </span>
  );
}

function Operator({
  title,
  ussd,
  logo,
  steps,
}: {
  title: string;
  ussd: string;
  logo: string;
  steps: ReactNode[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="overflow-hidden rounded-2xl border border-border">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 bg-card px-4 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-white p-2">
            <img src={logo} alt={title} className="max-h-8 max-w-9 object-contain" loading="lazy" />
          </span>
          <div>
            <p className="font-display text-lg font-extrabold">{title}</p>
            <p className="mt-0.5 text-sm font-semibold text-muted-foreground">{ussd}</p>
          </div>
        </div>
        <span className="text-xl font-bold text-primary">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="border-t border-border bg-muted/30 px-4 py-4">
          <ol className="grid gap-3">
            {steps.map((step, index) => (
              <li key={index} className="flex gap-3 text-sm leading-relaxed">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-xs font-extrabold text-primary-foreground">
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <p className="mt-4 rounded-xl bg-brand-tint px-3 py-2 text-sm font-bold">
            Jina la Biashara: {BUSINESS_NAME}
          </p>
        </div>
      )}
    </div>
  );
}
