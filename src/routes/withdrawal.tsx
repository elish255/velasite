import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, Clock3, Loader2, Phone, Wallet, X, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";

type Withdrawal = {
  id: string;
  amount: number;
  phone: string;
  status: "pending" | "processing" | "paid" | "rejected";
  created_at: string;
  processed_at: string | null;
  fee: number;
  payout_amount: number | null;
  provider_reference: string | null;
};

export const Route = createFileRoute("/withdrawal")({
  ssr: false,
  head: () => ({ meta: [{ title: "Withdrawal — 1Vela" }] }),
  component: WithdrawalPage,
});

function WithdrawalPage() {
  const navigate = useNavigate();
  const [balance, setBalance] = useState(0);
  const [count, setCount] = useState(0);
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [history, setHistory] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [initiated, setInitiated] = useState<Withdrawal | null>(null);

  async function load() {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      navigate({ to: "/login", search: {} });
      return;
    }

    const [{ data: profile }, { data: rows }] = await Promise.all([
      supabase.from("profiles").select("balance, banned").eq("id", auth.user.id).maybeSingle(),
      supabase
        .from("withdrawal_requests")
        .select("id, amount, phone, status, created_at, processed_at, fee, payout_amount, provider_reference")
        .eq("user_id", auth.user.id)
        .order("created_at", { ascending: false }),
    ]);

    if (profile?.banned) {
      await supabase.auth.signOut();
      navigate({ to: "/login", search: {} });
      return;
    }
    setBalance(Number(profile?.balance ?? 0));
    setHistory((rows as Withdrawal[]) ?? []);
    setCount(rows?.length ?? 0);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const minimum = count === 0 ? 50000 : 100000;
  const previewAmount = Number(amount) || 0;
  const previewFee = Math.round(previewAmount * 0.05 * 100) / 100;
  const previewPayout = Math.max(0, previewAmount - previewFee);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(amount);
    if (balance < minimum) return toast.error("Insufficient balance");
    if (!Number.isFinite(value) || value <= minimum) return toast.error(`Withdrawal amount must be greater than TZS ${minimum.toLocaleString("en-US")}`);
    if (value > balance) return toast.error("Insufficient balance");
    if (!/^\+?[0-9][0-9\s-]{7,14}$/.test(phone.trim())) return toast.error("Weka namba sahihi ya simu.");

    setSubmitting(true);
    const { data, error } = await supabase.rpc("request_withdrawal", { p_amount: value, p_phone: phone.trim() });
    setSubmitting(false);
    if (error) {
      toast.error(error.message.replace(/^.*?: /, ""));
      return;
    }

    const created = data as unknown as Withdrawal;
    setInitiated(created);
    setAmount("");
    window.dispatchEvent(new Event("vela:balance-updated"));
    await load();
  }

  if (loading) return <div className="grid min-h-screen place-items-center bg-background"><Loader2 className="size-7 animate-spin text-primary" /></div>;

  return (
    <div className="min-h-screen bg-background pb-10">
      <header className="header-surface px-5 py-5 text-header-foreground"><div className="mx-auto flex max-w-2xl items-center gap-3"><Link to="/account" aria-label="Rudi" className="grid size-10 place-items-center rounded-full bg-brand-dark/50"><ArrowLeft className="size-5" /></Link><img src="/1vela-logo.jpg" alt="1Vela" className="size-10 rounded-full bg-white object-contain" /><div><p className="font-extrabold">Withdrawal</p><p className="text-xs opacity-80">1Vela payout</p></div></div></header>

      <main className="mx-auto max-w-2xl px-5 py-7">
        <div className="rounded-3xl bg-brand-tint p-6 shadow-card"><p className="text-sm font-bold text-muted-foreground">Available balance</p><p className="mt-1 font-display text-3xl font-extrabold text-primary">TZS {balance.toLocaleString("en-US")}</p><p className="mt-2 text-sm font-semibold text-muted-foreground">First withdrawal: greater than TZS 50,000. Later withdrawals: greater than TZS 100,000.</p></div>

        <form onSubmit={submit} className="mt-5 rounded-3xl border border-border bg-card p-6 shadow-card">
          <h1 className="font-display text-2xl font-extrabold">Request withdrawal</h1>
          <label className="mt-5 block text-sm font-bold">Amount (TZS)</label>
          <input type="number" min={minimum + 1} step="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={`Greater than ${minimum.toLocaleString()}`} className="input-base mt-2" required />
          <label className="mt-4 block text-sm font-bold">Phone number</label>
          <div className="mt-2 flex items-center gap-2 rounded-2xl border border-input bg-background px-4 focus-within:ring-2 focus-within:ring-ring"><Phone className="size-5 text-muted-foreground" /><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07XXXXXXXX" className="h-13 w-full bg-transparent outline-none" required /></div>

          {previewAmount > 0 && <div className="mt-5 rounded-2xl border border-border bg-slate-50 p-4 text-sm"><Row label="Requested Amount" value={`${previewAmount.toLocaleString("en-US")} TZS`} /><Row label="Processing Fee (5%)" value={`${previewFee.toLocaleString("en-US")} TZS`} /><div className="my-2 h-px bg-border" /><Row label="Total Payout" value={`${previewPayout.toLocaleString("en-US")} TZS`} strong /></div>}

          <button disabled={submitting} className="brand-gradient mt-5 flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-4 font-extrabold text-brand-foreground shadow-brand disabled:opacity-60">{submitting ? <Loader2 className="size-5 animate-spin" /> : <Wallet className="size-5" />} Confirm Withdrawal</button>
        </form>

        <section className="mt-8"><h2 className="font-display text-2xl font-extrabold">Withdrawal History</h2><div className="mt-4 grid gap-3">{history.length === 0 ? <div className="rounded-3xl border border-dashed border-border bg-card p-7 text-center text-sm font-semibold text-muted-foreground">No withdrawal requests yet.</div> : history.map((item) => <div key={item.id} className="rounded-2xl border border-border bg-card p-4 shadow-card"><div className="flex items-center justify-between gap-3"><div><p className="font-display text-lg font-extrabold">TZS {Number(item.amount).toLocaleString("en-US")}</p><p className="mt-1 text-xs text-muted-foreground">Payout: TZS {Number(item.payout_amount ?? item.amount).toLocaleString("en-US")} • {item.phone}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString("en-GB")}</p></div><Status status={item.status} /></div></div>)}</div></section>
      </main>

      {initiated && <TransferModal withdrawal={initiated} onClose={() => setInitiated(null)} />}
    </div>
  );
}

function TransferModal({ withdrawal, onClose }: { withdrawal: Withdrawal; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-sm"><div className="w-full max-w-md rounded-[28px] bg-white p-7 shadow-2xl"><div className="flex justify-end"><button type="button" onClick={onClose} aria-label="Close"><X className="size-5 text-slate-400" /></button></div><div className="mt-4 text-center"><div className="mx-auto grid size-16 place-items-center rounded-full bg-primary/10 text-primary"><CheckCircle2 className="size-9" /></div><h2 className="mt-5 text-2xl font-extrabold text-slate-900">Transfer Initiated</h2><p className="mt-2 text-slate-500">Your withdrawal request has been received.</p></div><div className="mt-7 rounded-2xl bg-slate-100 p-5"><Row label="Sent To" value={withdrawal.phone} /><Row label="Amount" value={`${Number(withdrawal.payout_amount ?? withdrawal.amount).toLocaleString("en-US")} TZS`} green /><Row label="Ref ID" value={withdrawal.provider_reference || withdrawal.id.slice(0, 18).toUpperCase()} /></div><button type="button" onClick={onClose} className="mt-6 w-full rounded-xl bg-slate-800 px-5 py-4 text-lg font-extrabold text-white">Done</button></div></div>;
}

function Row({ label, value, strong = false, green = false }: { label: string; value: string; strong?: boolean; green?: boolean }) { return <div className={`flex items-center justify-between gap-4 py-2 ${strong ? "text-lg font-extrabold text-slate-900" : "text-sm"}`}><span className="text-slate-500">{label}</span><span className={green ? "font-extrabold text-primary" : "font-bold text-slate-700"}>{value}</span></div>; }

function Status({ status }: { status: Withdrawal["status"] }) { const config = { pending: ["Pending", "bg-amber-50 text-amber-800", <Clock3 className="size-3.5" />], processing: ["Processing", "bg-blue-50 text-blue-700", <Clock3 className="size-3.5" />], paid: ["Paid", "bg-brand-tint text-primary", <CheckCircle2 className="size-3.5" />], rejected: ["Rejected", "bg-destructive/10 text-destructive", <XCircle className="size-3.5" />] } as const; const [label, classes, icon] = config[status]; return <span className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-extrabold ${classes}`}>{icon}{label}</span>; }
