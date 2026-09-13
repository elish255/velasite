import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, Clock3, Loader2, LogOut, RefreshCw, ShieldCheck, XCircle } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";

type PaymentRequest = {
  id: string;
  user_id: string;
  phone: string;
  amount: number;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  approved_at: string | null;
};

type Profile = {
  id: string;
  full_name: string;
  phone: string;
  activated: boolean;
};

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({ meta: [{ title: "Admin — 1Vela" }] }),
  component: AdminPage,
});

function AdminPage() {
  const navigate = useNavigate();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [payments, setPayments] = useState<PaymentRequest[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadData = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);

    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      navigate({ to: "/login", search: {} });
      return;
    }

    const { data: adminRow, error: adminError } = await supabase
      .from("admin_users")
      .select("user_id")
      .eq("user_id", auth.user.id)
      .maybeSingle();

    if (adminError || !adminRow) {
      setAuthorized(false);
      setLoading(false);
      if (showSpinner) setRefreshing(false);
      return;
    }

    setAuthorized(true);

    const [{ data: paymentRows, error: paymentError }, { data: profileRows, error: profileError }] = await Promise.all([
      supabase
        .from("payment_requests")
        .select("id, user_id, phone, amount, status, created_at, approved_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("profiles")
        .select("id, full_name, phone, activated")
        .order("created_at", { ascending: false }),
    ]);

    if (paymentError) toast.error(paymentError.message);
    if (profileError) toast.error(profileError.message);
    setPayments((paymentRows as PaymentRequest[]) ?? []);
    setProfiles((profileRows as Profile[]) ?? []);
    setLoading(false);
    if (showSpinner) setRefreshing(false);
  }, [navigate]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function review(id: string, status: "approved" | "rejected") {
    setBusyId(id);
    const { error } = await supabase.rpc("review_activation_payment", {
      p_request_id: id,
      p_status: status,
    });
    setBusyId(null);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(status === "approved" ? "Payment approved — account imewashwa." : "Payment request imekataliwa.");
    await loadData();
  }

  async function toggleUser(profile: Profile) {
    setBusyId(profile.id);
    const { error } = await supabase
      .from("profiles")
      .update({ activated: !profile.activated })
      .eq("id", profile.id);
    setBusyId(null);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(profile.activated ? "Account imezimwa." : "Account imewashwa.");
    await loadData();
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="size-7 animate-spin text-primary" />
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-5">
        <div className="max-w-md rounded-3xl border border-border bg-card p-7 text-center shadow-card">
          <ShieldCheck className="mx-auto size-12 text-primary" />
          <h1 className="mt-4 font-display text-2xl font-extrabold">Admin access only</h1>
          <p className="mt-2 text-sm text-muted-foreground">Akaunti hii haina ruhusa ya kufungua admin panel.</p>
          <Link to="/" className="brand-gradient mt-5 flex justify-center rounded-2xl px-6 py-3 font-extrabold text-brand-foreground">
            Rudi Home
          </Link>
        </div>
      </div>
    );
  }

  const pending = payments.filter((p) => p.status === "pending");
  const approved = payments.filter((p) => p.status === "approved");
  const activeUsers = profiles.filter((p) => p.activated);

  return (
    <div className="min-h-screen bg-background pb-10">
      <header className="header-surface px-5 py-5 text-header-foreground">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <Link to="/account" aria-label="Rudi" className="grid size-10 place-items-center rounded-full bg-brand-dark/50">
            <ArrowLeft className="size-5" />
          </Link>
          <div>
            <img src="/1vela-logo.jpg" alt="1Vela Admin" className="h-10 w-auto max-w-[145px] rounded-xl object-contain" />
            <p className="text-xs opacity-80">Payment approvals & users</p>
          </div>
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={() => void loadData(true)} className="grid size-10 place-items-center rounded-full bg-brand-dark/50" aria-label="Refresh">
              <RefreshCw className={refreshing ? "size-4 animate-spin" : "size-4"} />
            </button>
            <button type="button" onClick={signOut} className="grid size-10 place-items-center rounded-full bg-brand-dark/50" aria-label="Logout">
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-7">
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat icon={<Clock3 className="size-5" />} label="Pending" value={pending.length} />
          <Stat icon={<CheckCircle2 className="size-5" />} label="Approved" value={approved.length} />
          <Stat icon={<ShieldCheck className="size-5" />} label="Active users" value={activeUsers.length} />
        </div>

        <section className="mt-7">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-extrabold">Payment Requests</h2>
              <p className="mt-1 text-sm text-muted-foreground">Approve malipo baada ya kuya-verify.</p>
            </div>
            <span className="rounded-full bg-brand-tint px-3 py-1.5 text-sm font-extrabold text-primary">{pending.length} pending</span>
          </div>

          <div className="mt-4 grid gap-3">
            {payments.length === 0 ? (
              <Empty text="Hakuna payment request bado." />
            ) : (
              payments.map((payment) => (
                <div key={payment.id} className="rounded-3xl border border-border bg-card p-5 shadow-card">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-bold">Simu iliyolipia: {payment.phone}</p>
                      <p className="mt-1 text-sm text-muted-foreground">User ID: {payment.user_id}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{new Date(payment.created_at).toLocaleString("en-GB")}</p>
                    </div>
                    <Status status={payment.status} />
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <p className="font-display text-xl font-extrabold text-primary">TZS {Number(payment.amount).toLocaleString("en-US")}</p>
                    {payment.status === "pending" && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={busyId === payment.id}
                          onClick={() => void review(payment.id, "rejected")}
                          className="flex items-center gap-2 rounded-xl border border-destructive/30 px-4 py-2.5 text-sm font-extrabold text-destructive disabled:opacity-50"
                        >
                          <XCircle className="size-4" /> Reject
                        </button>
                        <button
                          type="button"
                          disabled={busyId === payment.id}
                          onClick={() => void review(payment.id, "approved")}
                          className="brand-gradient flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-extrabold text-brand-foreground shadow-brand disabled:opacity-50"
                        >
                          {busyId === payment.id ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                          Approve & Activate
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="mt-9">
          <h2 className="font-display text-2xl font-extrabold">Users</h2>
          <p className="mt-1 text-sm text-muted-foreground">Manage activation status ya accounts.</p>
          <div className="mt-4 grid gap-3">
            {profiles.map((profile) => (
              <div key={profile.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-card">
                <div>
                  <p className="font-bold">{profile.full_name || "Unnamed user"}</p>
                  <p className="text-sm text-muted-foreground">{profile.phone || "No phone"}</p>
                </div>
                <button
                  type="button"
                  disabled={busyId === profile.id}
                  onClick={() => void toggleUser(profile)}
                  className={profile.activated ? "rounded-xl border border-border px-4 py-2 text-sm font-extrabold" : "brand-gradient rounded-xl px-4 py-2 text-sm font-extrabold text-brand-foreground shadow-brand"}
                >
                  {busyId === profile.id ? "..." : profile.activated ? "Deactivate" : "Activate"}
                </button>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-center gap-3 text-primary">{icon}<span className="text-sm font-bold text-muted-foreground">{label}</span></div>
      <p className="mt-2 font-display text-3xl font-extrabold">{value}</p>
    </div>
  );
}

function Status({ status }: { status: PaymentRequest["status"] }) {
  const config = {
    pending: "bg-amber-50 text-amber-800",
    approved: "bg-brand-tint text-primary",
    rejected: "bg-destructive/10 text-destructive",
  }[status];
  return <span className={`rounded-full px-3 py-1.5 text-xs font-extrabold capitalize ${config}`}>{status}</span>;
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-3xl border border-dashed border-border bg-card p-8 text-center text-sm font-semibold text-muted-foreground">{text}</div>;
}
