import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Bell,
  CheckCircle2,
  Clock3,
  CreditCard,
  DollarSign,
  Loader2,
  LogOut,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  UserX,
  Wallet,
  XCircle,
} from "lucide-react";
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
  provider: string;
  provider_reference: string | null;
  provider_status: string | null;
  paid_at: string | null;
};

type Profile = {
  id: string;
  full_name: string;
  phone: string;
  balance: number;
  activated: boolean;
  banned: boolean;
  ban_reason: string | null;
};

type WithdrawalRequest = {
  id: string;
  user_id: string;
  amount: number;
  fee: number;
  payout_amount: number | null;
  phone: string;
  status: "pending" | "processing" | "paid" | "rejected";
  created_at: string;
  provider_reference: string | null;
  provider_status: string | null;
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
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastMessage, setBroadcastMessage] = useState("");

  const loadData = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      navigate({ to: "/login", search: {} });
      return;
    }
    const { data: adminRow } = await supabase.from("admin_users").select("user_id").eq("user_id", auth.user.id).maybeSingle();
    if (!adminRow) {
      setAuthorized(false);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    setAuthorized(true);

    const [{ data: paymentRows, error: paymentError }, { data: profileRows, error: profileError }, { data: withdrawalRows, error: withdrawalError }] = await Promise.all([
      supabase.from("payment_requests").select("id, user_id, phone, amount, status, created_at, provider, provider_reference, provider_status, paid_at").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, full_name, phone, balance, activated, banned, ban_reason").order("created_at", { ascending: false }),
      supabase.from("withdrawal_requests").select("id, user_id, amount, fee, payout_amount, phone, status, created_at, provider_reference, provider_status").order("created_at", { ascending: false }),
    ]);
    if (paymentError) toast.error(paymentError.message);
    if (profileError) toast.error(profileError.message);
    if (withdrawalError) toast.error(withdrawalError.message);
    setPayments((paymentRows as PaymentRequest[]) ?? []);
    setProfiles((profileRows as Profile[]) ?? []);
    setWithdrawals((withdrawalRows as WithdrawalRequest[]) ?? []);
    setLoading(false);
    setRefreshing(false);
  }, [navigate]);

  useEffect(() => { void loadData(); }, [loadData]);

  async function reviewDeposit(id: string, status: "approved" | "rejected") {
    setBusyId(id);
    const { error } = await supabase.rpc("review_activation_payment", { p_request_id: id, p_status: status });
    setBusyId(null);
    if (error) return toast.error(error.message);
    toast.success(status === "approved" ? "Deposit approved — account imewashwa." : "Deposit rejected.");
    await loadData();
  }

  async function reviewWithdrawal(id: string, status: "paid" | "rejected") {
    setBusyId(id);
    if (status === "rejected") {
      const { error } = await supabase.rpc("review_withdrawal", { p_request_id: id, p_status: "rejected" });
      setBusyId(null);
      if (error) return toast.error(error.message);
      toast.success("Withdrawal rejected and balance returned.");
      await loadData();
      return;
    }

    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) throw new Error("Session expired. Login again.");
      const response = await fetch("/api/fimipay/withdrawal", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ requestId: id }) });
      const data = await response.json() as { error?: string; status?: string; reference?: string };
      if (!response.ok) throw new Error(data.error || "FimiPay payout failed");
      toast.success(data.status ? `FimiPay payout: ${data.status}` : "Withdrawal sent to FimiPay.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "FimiPay payout failed");
    } finally {
      setBusyId(null);
      await loadData();
    }
  }

  async function setActivation(profile: Profile) {
    setBusyId(profile.id);
    const { error } = await supabase.rpc("admin_set_user_activation", { p_user_id: profile.id, p_activated: !profile.activated });
    setBusyId(null);
    if (error) return toast.error(error.message);
    toast.success(profile.activated ? "Account deactivated." : "Account activated.");
    await loadData();
  }

  async function setBan(profile: Profile) {
    const reason = profile.banned ? null : window.prompt("Sababu ya kum-ban user:", "Account policy violation");
    if (!profile.banned && reason === null) return;
    setBusyId(profile.id);
    const { error } = await supabase.rpc("admin_set_user_ban", { p_user_id: profile.id, p_banned: !profile.banned, p_reason: reason });
    setBusyId(null);
    if (error) return toast.error(error.message);
    toast.success(profile.banned ? "User unbanned." : "User banned.");
    await loadData();
  }

  async function adjustBalance(profile: Profile, direction: "add" | "subtract") {
    const value = Number(window.prompt(direction === "add" ? "Weka amount ya kuongeza TZS:" : "Weka amount ya kupunguza TZS:", "10000"));
    if (!Number.isFinite(value) || value <= 0) return;
    const reason = window.prompt("Sababu:", direction === "add" ? "Admin credit" : "Admin debit");
    if (!reason) return;
    setBusyId(profile.id);
    const { error } = await supabase.rpc("admin_adjust_balance", { p_user_id: profile.id, p_amount: direction === "add" ? value : -value, p_reason: reason });
    setBusyId(null);
    if (error) return toast.error(error.message);
    toast.success("Balance updated.");
    await loadData();
  }

  async function sendNotification(userId: string | null) {
    const title = userId ? window.prompt("Notification title:", "Ujumbe kutoka 1Vela") : broadcastTitle.trim();
    const message = userId ? window.prompt("Notification message:", "Tuna ujumbe mpya kwa ajili yako.") : broadcastMessage.trim();
    if (!title || !message) return;
    const { error } = await supabase.rpc("admin_send_notification", { p_user_id: userId, p_title: title, p_message: message });
    if (error) return toast.error(error.message);
    if (!userId) { setBroadcastTitle(""); setBroadcastMessage(""); }
    toast.success(userId ? "Notification sent to user." : "Notification sent to all users.");
  }

  async function signOut() { await supabase.auth.signOut(); navigate({ to: "/" }); }

  if (loading) return <div className="grid min-h-screen place-items-center bg-background"><Loader2 className="size-7 animate-spin text-primary" /></div>;
  if (!authorized) return <div className="grid min-h-screen place-items-center bg-background px-5"><div className="max-w-md rounded-3xl border border-border bg-card p-7 text-center shadow-card"><ShieldCheck className="mx-auto size-12 text-primary" /><h1 className="mt-4 font-display text-2xl font-extrabold">Admin access only</h1><p className="mt-2 text-sm text-muted-foreground">Akaunti hii haina ruhusa ya kufungua admin panel.</p><Link to="/" className="brand-gradient mt-5 flex justify-center rounded-2xl px-6 py-3 font-extrabold text-brand-foreground">Rudi Home</Link></div></div>;

  const pendingDeposits = payments.filter((p) => p.status === "pending");
  const pendingWithdrawals = withdrawals.filter((w) => w.status === "pending" || w.status === "processing");
  const activeUsers = profiles.filter((p) => p.activated && !p.banned);

  return (
    <div className="min-h-screen bg-background pb-12">
      <header className="header-surface px-5 py-5 text-header-foreground"><div className="mx-auto flex max-w-6xl items-center gap-3"><Link to="/account" aria-label="Dashboard" className="grid size-10 place-items-center rounded-full bg-brand-dark/50">←</Link><img src="/1vela-logo.jpg" alt="1Vela Admin" className="size-10 rounded-full bg-white object-contain" /><div><p className="font-extrabold">1Vela Admin</p><p className="text-xs opacity-80">Payments, users & notifications</p></div><div className="ml-auto flex gap-2"><button type="button" onClick={() => void loadData(true)} className="grid size-10 place-items-center rounded-full bg-brand-dark/50"><RefreshCw className={refreshing ? "size-4 animate-spin" : "size-4"} /></button><button type="button" onClick={signOut} className="grid size-10 place-items-center rounded-full bg-brand-dark/50"><LogOut className="size-4" /></button></div></div></header>

      <main className="mx-auto max-w-6xl px-5 py-7">
        <div className="grid gap-3 sm:grid-cols-4"><Stat icon={<Clock3 className="size-5" />} label="Pending deposits" value={pendingDeposits.length} /><Stat icon={<Wallet className="size-5" />} label="Pending withdrawals" value={pendingWithdrawals.length} /><Stat icon={<UserCheck className="size-5" />} label="Active users" value={activeUsers.length} /><Stat icon={<UserX className="size-5" />} label="Banned users" value={profiles.filter((p) => p.banned).length} /></div>

        <section className="mt-8 rounded-3xl border border-border bg-card p-6 shadow-card"><div className="flex items-center gap-3"><div className="grid size-11 place-items-center rounded-2xl bg-brand-tint text-primary"><Bell className="size-5" /></div><div><h2 className="font-display text-2xl font-extrabold">Broadcast Notification</h2><p className="text-sm text-muted-foreground">Tuma notification kwa users wote.</p></div></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><input value={broadcastTitle} onChange={(e) => setBroadcastTitle(e.target.value)} placeholder="Title" className="input-base" /><input value={broadcastMessage} onChange={(e) => setBroadcastMessage(e.target.value)} placeholder="Message" className="input-base" /></div><button type="button" onClick={() => void sendNotification(null)} className="brand-gradient mt-4 rounded-2xl px-5 py-3 font-extrabold text-brand-foreground">Send to All Users</button></section>

        <section className="mt-8"><SectionTitle title="Deposits / Activation Payments" icon={<CreditCard className="size-5" />} count={pendingDeposits.length} /><div className="mt-4 grid gap-3">{payments.length === 0 ? <Empty text="Hakuna deposit request bado." /> : payments.map((payment) => <div key={payment.id} className="rounded-3xl border border-border bg-card p-5 shadow-card"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-bold">Simu: {payment.phone}</p><p className="mt-1 text-sm text-muted-foreground">User ID: {payment.user_id}</p><p className="mt-1 text-sm text-muted-foreground">TZS {Number(payment.amount).toLocaleString("en-US")} • {new Date(payment.created_at).toLocaleString("en-GB")}</p><p className="mt-1 text-xs text-muted-foreground">Njia: {payment.provider === "manual" ? "LIPA NAMBA" : "Automatic Payment"} • {payment.provider_status || "waiting"}{payment.provider_reference ? ` • Ref: ${payment.provider_reference}` : ""}</p></div><Status status={payment.status} /></div>{payment.status === "pending" && <div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={busyId === payment.id} onClick={() => void reviewDeposit(payment.id, "rejected")} className="flex items-center gap-2 rounded-xl border border-destructive/30 px-4 py-2.5 text-sm font-extrabold text-destructive"><XCircle className="size-4" /> Reject</button><button type="button" disabled={busyId === payment.id} onClick={() => void reviewDeposit(payment.id, "approved")} className="brand-gradient flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-extrabold text-brand-foreground"><CheckCircle2 className="size-4" /> Approve & Activate</button></div>}</div>)}</div></section>

        <section className="mt-9"><SectionTitle title="Withdrawals" icon={<Wallet className="size-5" />} count={pendingWithdrawals.length} /><div className="mt-4 grid gap-3">{withdrawals.length === 0 ? <Empty text="Hakuna withdrawal request bado." /> : withdrawals.map((item) => <div key={item.id} className="rounded-3xl border border-border bg-card p-5 shadow-card"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-display text-xl font-extrabold text-primary">TZS {Number(item.amount).toLocaleString("en-US")}</p><p className="mt-1 text-sm font-semibold">Payout: TZS {Number(item.payout_amount ?? item.amount).toLocaleString("en-US")} • Fee: TZS {Number(item.fee ?? 0).toLocaleString("en-US")}</p><p className="mt-1 text-sm">Simu: {item.phone}</p><p className="mt-1 text-xs text-muted-foreground">User ID: {item.user_id} • {new Date(item.created_at).toLocaleString("en-GB")}</p><p className="mt-1 text-xs text-muted-foreground">Automatic payout: {item.provider_status || "waiting"}{item.provider_reference ? ` • Ref: ${item.provider_reference}` : ""}</p></div><Status status={item.status === "paid" ? "approved" : item.status} /></div>{item.status === "pending" && <div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={busyId === item.id} onClick={() => void reviewWithdrawal(item.id, "rejected")} className="flex items-center gap-2 rounded-xl border border-destructive/30 px-4 py-2.5 text-sm font-extrabold text-destructive"><XCircle className="size-4" /> Reject & Refund</button><button type="button" disabled={busyId === item.id} onClick={() => void reviewWithdrawal(item.id, "paid")} className="brand-gradient flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-extrabold text-brand-foreground"><DollarSign className="size-4" /> Approve & Send FimiPay</button></div>}{item.status === "processing" && <p className="mt-4 rounded-2xl bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700">FimiPay imepokea payout. Subiri provider confirmation/webhook.</p>}</div>)}</div></section>

        <section className="mt-9"><SectionTitle title="User Management" icon={<ShieldCheck className="size-5" />} count={profiles.length} /><div className="mt-4 grid gap-3">{profiles.map((profile) => <div key={profile.id} className="rounded-3xl border border-border bg-card p-5 shadow-card"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="font-display text-lg font-extrabold">{profile.full_name || "Unnamed user"}</p><p className="mt-1 text-sm text-muted-foreground">{profile.phone || "No phone"}</p><p className="mt-1 font-bold text-primary">TZS {Number(profile.balance).toLocaleString("en-US")}</p><div className="mt-2 flex flex-wrap gap-2"><Tag text={profile.activated ? "Active" : "Inactive"} /><Tag text={profile.banned ? "Banned" : "Not banned"} danger={profile.banned} /></div></div><div className="grid w-full gap-2 sm:w-auto sm:grid-cols-2"><button type="button" disabled={busyId === profile.id} onClick={() => void setActivation(profile)} className="rounded-xl border border-border px-4 py-2.5 text-sm font-extrabold">{profile.activated ? "Deactivate" : "Activate"}</button><button type="button" disabled={busyId === profile.id} onClick={() => void setBan(profile)} className={profile.banned ? "rounded-xl bg-primary px-4 py-2.5 text-sm font-extrabold text-white" : "rounded-xl bg-destructive/10 px-4 py-2.5 text-sm font-extrabold text-destructive"}>{profile.banned ? "Unban" : "Ban User"}</button><button type="button" onClick={() => void adjustBalance(profile, "add")} className="rounded-xl bg-brand-tint px-4 py-2.5 text-sm font-extrabold text-primary">+ Balance</button><button type="button" onClick={() => void adjustBalance(profile, "subtract")} className="rounded-xl border border-border px-4 py-2.5 text-sm font-extrabold">− Balance</button><button type="button" onClick={() => void sendNotification(profile.id)} className="sm:col-span-2 flex items-center justify-center gap-2 rounded-xl border border-primary/20 px-4 py-2.5 text-sm font-extrabold text-primary"><Bell className="size-4" /> Send Notification</button></div></div></div>)}</div></section>
      </main>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: number }) { return <div className="rounded-3xl border border-border bg-card p-5 shadow-card"><div className="flex items-center gap-3 text-primary">{icon}<span className="text-sm font-bold text-muted-foreground">{label}</span></div><p className="mt-2 font-display text-3xl font-extrabold">{value}</p></div>; }
function SectionTitle({ title, icon, count }: { title: string; icon: ReactNode; count: number }) { return <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><div className="text-primary">{icon}</div><div><h2 className="font-display text-2xl font-extrabold">{title}</h2></div></div><span className="rounded-full bg-brand-tint px-3 py-1.5 text-sm font-extrabold text-primary">{count}</span></div>; }
function Status({ status }: { status: string }) { const config: Record<string, string> = { pending: "bg-amber-50 text-amber-800", processing: "bg-blue-50 text-blue-700", approved: "bg-brand-tint text-primary", rejected: "bg-destructive/10 text-destructive" }; return <span className={`rounded-full px-3 py-1.5 text-xs font-extrabold capitalize ${config[status] ?? "bg-slate-100 text-slate-700"}`}>{status}</span>; }
function Tag({ text, danger = false }: { text: string; danger?: boolean }) { return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${danger ? "bg-destructive/10 text-destructive" : "bg-slate-100 text-slate-600"}`}>{text}</span>; }
function Empty({ text }: { text: string }) { return <div className="rounded-3xl border border-dashed border-border bg-card p-8 text-center text-sm font-semibold text-muted-foreground">{text}</div>; }
