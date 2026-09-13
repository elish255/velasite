import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Clock3, Loader2, Phone, Wallet, CheckCircle2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";

type Withdrawal = {
  id: string;
  amount: number;
  phone: string;
  status: "pending" | "paid" | "rejected";
  created_at: string;
  processed_at: string | null;
};

export const Route = createFileRoute("/withdrawal")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Withdrawal — 1Vela" },
      { name: "description", content: "Request withdrawal na uone withdrawal history yako ya 1Vela." },
    ],
  }),
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

  async function load() {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      navigate({ to: "/login", search: {} });
      return;
    }

    const [{ data: profile }, { data: rows }] = await Promise.all([
      supabase.from("profiles").select("balance").eq("id", auth.user.id).maybeSingle(),
      supabase
        .from("withdrawal_requests")
        .select("id, amount, phone, status, created_at, processed_at")
        .eq("user_id", auth.user.id)
        .order("created_at", { ascending: false }),
    ]);

    setBalance(Number(profile?.balance ?? 0));
    setHistory((rows as Withdrawal[]) ?? []);
    setCount(rows?.length ?? 0);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const minimum = count === 0 ? 50000 : 100000;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(amount);

    if (balance < minimum) {
      toast.error("Insufficient balance");
      return;
    }
    if (!Number.isFinite(value) || value <= minimum) {
      toast.error(`Withdrawal amount must be greater than TZS ${minimum.toLocaleString("en-US")}`);
      return;
    }
    if (value > balance) {
      toast.error("Insufficient balance");
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.rpc("request_withdrawal", {
      p_amount: value,
      p_phone: phone.trim(),
    });
    setSubmitting(false);

    if (error) {
      toast.error(error.message.replace(/^.*?: /, ""));
      return;
    }

    toast.success("Your Amount will arrive at your Phone number within 24 hours");
    setAmount("");
    await load();
  }

  if (loading) {
    return <div className="grid min-h-screen place-items-center bg-background"><Loader2 className="size-7 animate-spin text-primary" /></div>;
  }

  return (
    <div className="min-h-screen bg-background pb-10">
      <header className="header-surface px-5 py-5 text-header-foreground">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <Link to="/" aria-label="Rudi" className="grid size-10 place-items-center rounded-full bg-brand-dark/50"><ArrowLeft className="size-5" /></Link>
          <Wallet className="size-6" />
          <div><p className="font-display text-xl font-extrabold">Withdrawal</p><p className="text-xs opacity-80">Request & history</p></div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 py-7">
        <div className="rounded-3xl bg-brand-tint p-6 shadow-card">
          <p className="text-sm font-bold text-muted-foreground">Available balance</p>
          <p className="mt-1 font-display text-3xl font-extrabold text-primary">TZS {balance.toLocaleString("en-US")}</p>
          <p className="mt-2 text-sm font-semibold text-muted-foreground">
            {count === 0 ? "First withdrawal: amount must be greater than TZS 50,000." : "Second and later withdrawals: amount must be greater than TZS 100,000."}
          </p>
        </div>

        <form onSubmit={submit} className="mt-5 rounded-3xl border border-border bg-card p-6 shadow-card">
          <h1 className="font-display text-2xl font-extrabold">Request withdrawal</h1>
          <label className="mt-5 block text-sm font-bold">Amount (TZS)</label>
          <input type="number" min={minimum + 1} step="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={`Greater than ${minimum.toLocaleString()}`} className="mt-2 h-13 w-full rounded-2xl border border-input bg-background px-4 outline-none focus:ring-2 focus:ring-ring" required />

          <label className="mt-4 block text-sm font-bold">Phone number</label>
          <div className="mt-2 flex items-center gap-2 rounded-2xl border border-input bg-background px-4 focus-within:ring-2 focus-within:ring-ring">
            <Phone className="size-5 text-muted-foreground" />
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07XXXXXXXX" className="h-13 w-full bg-transparent outline-none" required />
          </div>

          <button disabled={submitting} className="brand-gradient mt-5 flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-4 font-extrabold text-brand-foreground shadow-brand disabled:opacity-60">
            {submitting ? <Loader2 className="size-5 animate-spin" /> : <Wallet className="size-5" />}
            Withdrawal
          </button>
        </form>

        <section className="mt-8">
          <h2 className="font-display text-2xl font-extrabold">Withdrawal History</h2>
          <div className="mt-4 grid gap-3">
            {history.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-border bg-card p-7 text-center text-sm font-semibold text-muted-foreground">No withdrawal requests yet.</div>
            ) : history.map((item) => (
              <div key={item.id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
                <div className="flex items-center justify-between gap-3">
                  <div><p className="font-display text-lg font-extrabold">TZS {Number(item.amount).toLocaleString("en-US")}</p><p className="mt-1 text-xs text-muted-foreground">{item.phone} • {new Date(item.created_at).toLocaleString("en-GB")}</p></div>
                  <Status status={item.status} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function Status({ status }: { status: Withdrawal["status"] }) {
  const config = {
    pending: ["Pending", "bg-amber-50 text-amber-800", <Clock3 className="size-3.5" />],
    paid: ["Paid", "bg-brand-tint text-primary", <CheckCircle2 className="size-3.5" />],
    rejected: ["Rejected", "bg-destructive/10 text-destructive", <XCircle className="size-3.5" />],
  } as const;
  const [label, classes, icon] = config[status];
  return <span className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-extrabold ${classes}`}>{icon}{label}</span>;
}
