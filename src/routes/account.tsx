import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Bell,
  CheckCircle2,
  ChevronRight,
  LogOut,
  Menu,
  MoreHorizontal,
  Search,
  Send,
  Share2,
  Wallet,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";

type Profile = {
  full_name: string;
  phone: string;
  balance: number;
  activated: boolean;
  banned: boolean;
  ban_reason: string | null;
};

type Notification = {
  id: string;
  user_id: string | null;
  title: string;
  message: string;
  created_at: string;
  read_at: string | null;
};

export const Route = createFileRoute("/account")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Dashboard — 1Vela" },
      { name: "description", content: "Dashboard ya mapato na balance ya 1Vela." },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [withdrawn, setWithdrawn] = useState(0);
  const [bonus, setBonus] = useState(0);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  async function loadDashboard() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) {
      navigate({ to: "/login", search: {} });
      return;
    }

    const [{ data: row }, { data: notificationRows }, { data: withdrawalRows }, { data: rewardRows }] = await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, phone, balance, activated, banned, ban_reason")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("notifications")
        .select("id, user_id, title, message, created_at, read_at")
        .or(`user_id.eq.${user.id},user_id.is.null`)
        .order("created_at", { ascending: false })
        .limit(12),
      supabase
        .from("withdrawal_requests")
        .select("amount, status")
        .eq("user_id", user.id),
      supabase
        .from("chat_reward_transactions")
        .select("amount")
        .eq("user_id", user.id),
    ]);

    const nextProfile = row as Profile | null;
    if (nextProfile?.banned) {
      await supabase.auth.signOut();
      toast.error(nextProfile.ban_reason || "Akaunti yako imezuiwa.");
      navigate({ to: "/login", search: {} });
      return;
    }

    if (nextProfile && !nextProfile.activated) {
      navigate({ to: "/payment" });
      return;
    }

    setEmail(user.email ?? "");
    setProfile(nextProfile);
    setNotifications((notificationRows as Notification[]) ?? []);
    setWithdrawn((withdrawalRows ?? []).reduce((sum, item) => sum + Number(item.amount ?? 0), 0));
    setBonus((rewardRows ?? []).reduce((sum, item) => sum + Number(item.amount ?? 0), 0));
    setLoading(false);
  }

  useEffect(() => {
    void loadDashboard();
    const handler = () => void loadDashboard();
    window.addEventListener("vela:balance-updated", handler);
    return () => window.removeEventListener("vela:balance-updated", handler);
  }, []);

  const balance = Number(profile?.balance ?? 0);
  const netIncome = balance + withdrawn;
  const expensePercent = netIncome > 0 ? Math.min(100, Math.round((withdrawn / netIncome) * 100)) : 0;
  const balancePercent = netIncome > 0 ? Math.min(100, Math.max(4, Math.round((balance / netIncome) * 100))) : 4;
  const latestBroadcast = notifications.find((item) => item.user_id === null);
  const unreadCount = notifications.filter((item) => item.user_id !== null && !item.read_at).length;

  const greetingName = useMemo(() => {
    const name = profile?.full_name?.trim();
    return name ? name.split(/\s+/)[0] : "Member";
  }, [profile?.full_name]);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  async function markRead(id: string) {
    const current = notifications.find((item) => item.id === id);
    if (current?.user_id !== null) await supabase.rpc("mark_notification_read", { p_notification_id: id });
    setNotifications((items) => items.map((item) => item.id === id ? { ...item, read_at: new Date().toISOString() } : item));
  }

  async function shareDashboard() {
    const shareData = { title: "1Vela", text: "Join 1Vela and chat with people from around the world.", url: window.location.origin };
    try {
      if (navigator.share) await navigator.share(shareData);
      else {
        await navigator.clipboard.writeText(window.location.origin);
        toast.success("Link ya 1Vela imekopiwa.");
      }
    } catch {
      // User cancelled native share.
    }
  }

  if (loading) {
    return <div className="grid min-h-screen place-items-center bg-background"><div className="size-8 animate-spin rounded-full border-4 border-primary/20 border-t-primary" /></div>;
  }

  return (
    <div className="min-h-screen bg-[#f4f7fb] pb-10">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-[76px] max-w-5xl items-center px-5">
          <img src="/1vela-logo.jpg" alt="1Vela" className="size-11 rounded-xl object-contain" />
          <button type="button" className="ml-8 grid size-11 place-items-center rounded-xl text-slate-700" aria-label="Menu" onClick={() => setMenuOpen((value) => !value)}><Menu className="size-6" /></button>
          <div className="ml-2 hidden h-11 w-px bg-slate-200 sm:block" />
          <button type="button" className="ml-3 grid size-11 place-items-center rounded-xl text-slate-700" aria-label="Search"><Search className="size-5" /></button>
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={() => setNotificationsOpen((value) => !value)} className="relative grid size-11 place-items-center rounded-xl text-slate-700" aria-label="Notifications">
              <Bell className="size-5" />
              {unreadCount > 0 && <span className="absolute right-2 top-2 grid size-4 place-items-center rounded-full bg-primary text-[9px] font-extrabold text-white">{Math.min(9, unreadCount)}</span>}
            </button>
            <button type="button" className="grid size-11 place-items-center rounded-xl text-slate-700"><MoreHorizontal className="size-6" /></button>
          </div>
        </div>
        {menuOpen && (
          <div className="border-t border-slate-100 bg-white px-5 py-4">
            <div className="mx-auto flex max-w-5xl flex-wrap gap-2">
              <Link to="/" className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold">Start Chat</Link>
              <Link to="/withdrawal" className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold">Withdrawal</Link>
              <Link to="/payment" className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold">Activation</Link>
              <button type="button" onClick={signOut} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold">Logout</button>
            </div>
          </div>
        )}
        {notificationsOpen && (
          <div className="absolute right-4 top-[68px] z-40 w-[min(92vw,380px)] rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
            <div className="flex items-center justify-between px-2 py-1"><p className="font-extrabold">Notifications</p><button type="button" onClick={() => setNotificationsOpen(false)}><X className="size-4" /></button></div>
            <div className="mt-2 max-h-80 overflow-auto">
              {notifications.length === 0 ? <p className="p-4 text-sm text-slate-500">Hakuna notification.</p> : notifications.map((item) => (
                <button key={item.id} type="button" onClick={() => void markRead(item.id)} className={`w-full rounded-xl p-3 text-left ${item.read_at ? "bg-white" : "bg-primary/5"}`}>
                  <p className="font-bold">{item.title}</p>
                  <p className="mt-1 text-sm text-slate-600">{item.message}</p>
                  <p className="mt-1 text-[11px] text-slate-400">{new Date(item.created_at).toLocaleString("en-GB")}</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-5xl px-5 py-8">
        {latestBroadcast && (
          <section className="relative overflow-hidden rounded-[28px] bg-slate-700 px-6 py-7 text-white shadow-lg">
            <div className="mx-auto max-w-3xl">
              <span className="inline-flex rounded-full bg-sky-500/20 px-4 py-2 text-xs font-extrabold tracking-widest text-sky-300">SYSTEM BROADCAST</span>
              <h2 className="mt-5 text-2xl font-extrabold">{latestBroadcast.title}</h2>
              <p className="mt-3 whitespace-pre-line text-base font-medium leading-7 text-slate-100">{latestBroadcast.message}</p>
            </div>
          </section>
        )}

        <section className="mt-8 flex items-center gap-4">
          <div className="grid size-16 place-items-center rounded-full bg-gradient-to-br from-primary to-cyan-400 text-2xl font-extrabold text-white">{greetingName.slice(0, 1).toUpperCase()}</div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Welcome back, {greetingName}</h1>
            <p className="mt-1 text-slate-400">Here's how your earnings are looking today.</p>
          </div>
        </section>

        <button type="button" onClick={() => document.documentElement.classList.toggle("dark")} className="mt-6 grid size-12 place-items-center rounded-2xl bg-white text-slate-700 shadow-sm" aria-label="Toggle theme">☾</button>

        <section className="mt-8 overflow-hidden rounded-[30px] bg-gradient-to-br from-teal-600 to-cyan-500 p-7 text-white shadow-xl">
          <p className="text-sm font-extrabold tracking-[0.18em] text-white/75">↗ NET INCOME</p>
          <div className="mt-4 flex items-baseline gap-3"><p className="text-5xl font-extrabold tracking-tight">{netIncome.toLocaleString("en-US")}</p><span className="text-2xl text-white/70">TZS</span></div>
          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            <Metric label="EXPENSES" value={`${withdrawn.toLocaleString("en-US")} TZS`} />
            <Metric label="BONUS" value={`${bonus.toLocaleString("en-US")} TZS`} />
          </div>
        </section>

        <div className="mt-4 grid grid-cols-3 gap-3 overflow-x-auto">
          <button type="button" onClick={() => void shareDashboard()} className="flex min-w-0 items-center justify-center gap-2 rounded-full bg-white px-4 py-4 font-bold text-slate-800 shadow-sm"><Share2 className="size-5" /> <span>Share</span></button>
          <Link to="/" className="flex min-w-0 items-center justify-center gap-2 rounded-full bg-white px-4 py-4 font-bold text-slate-800 shadow-sm"><Send className="size-5" /> <span>Pay Client</span></Link>
          <Link to="/withdrawal" className="flex min-w-0 items-center justify-center gap-2 rounded-full bg-white px-4 py-4 font-bold text-slate-800 shadow-sm"><Wallet className="size-5" /> <span>Cash Out</span></Link>
        </div>

        <div className="mt-8 grid gap-5">
          <BalanceCard label="1VELA" title="Balance" amount={balance} percent={balancePercent} positive />
          <BalanceCard label="1VELA" title="Withdrawal" amount={withdrawn} percent={expensePercent} />
        </div>

        <section className="mt-7 rounded-[28px] bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between"><h2 className="text-2xl font-extrabold text-slate-900">Other Balances</h2><ChevronRight className="size-5 text-slate-400" /></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <SmallBalance title="Current Balance" value={`TZS ${balance.toLocaleString("en-US")}`} />
            <SmallBalance title="Total Earned" value={`TZS ${netIncome.toLocaleString("en-US")}`} />
          </div>
        </section>

        {!profile?.activated && (
          <section className="mt-7 rounded-[28px] border border-amber-200 bg-amber-50 p-6">
            <p className="font-extrabold text-amber-900">Account bado haija-activate</p>
            <p className="mt-1 text-sm text-amber-800">Chagua njia ya malipo kwenye ukurasa wa activation ili kuendelea.</p>
            <Link to="/payment" className="mt-4 inline-flex rounded-2xl bg-amber-900 px-5 py-3 font-extrabold text-white">Activate Account</Link>
          </section>
        )}

        {email && <p className="mt-8 text-center text-xs text-slate-400">{email}</p>}
        <button type="button" onClick={signOut} className="mx-auto mt-4 flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold text-slate-500"><LogOut className="size-4" /> Logout</button>
        <div className="mt-5 flex justify-center"><span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-bold text-slate-500"><CheckCircle2 className="size-4 text-primary" /> 1Vela Dashboard</span></div>
      </main>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-white/15 p-4 backdrop-blur"><p className="text-sm font-extrabold text-white/70">{label}</p><p className="mt-2 text-xl font-extrabold">{value}</p></div>;
}

function BalanceCard({ label, title, amount, percent, positive = false }: { label: string; title: string; amount: number; percent: number; positive?: boolean }) {
  return (
    <div className={`rounded-[28px] border-l-[6px] bg-white p-6 shadow-sm ${positive ? "border-primary" : "border-pink-500"}`}>
      <div className="flex items-start justify-between gap-3"><span className="rounded-lg bg-slate-50 px-3 py-2 text-xs font-extrabold tracking-wide text-slate-500">{label}</span><p className="text-2xl font-extrabold text-slate-900">{amount.toLocaleString("en-US")}</p></div>
      <p className="mt-5 text-xl font-semibold text-slate-600">{title}</p>
      <div className="mt-5 flex items-center justify-between text-sm text-slate-400"><span>Growth</span><span>{percent}%</span></div>
      <div className="mt-2 h-2 rounded-full bg-slate-100"><div className={`h-2 rounded-full ${positive ? "bg-primary" : "bg-pink-500"}`} style={{ width: `${Math.max(3, percent)}%` }} /></div>
    </div>
  );
}

function SmallBalance({ title, value }: { title: string; value: string }) {
  return <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4"><p className="text-sm font-semibold text-slate-500">{title}</p><p className="mt-1 text-xl font-extrabold text-slate-900">{value}</p></div>;
}
