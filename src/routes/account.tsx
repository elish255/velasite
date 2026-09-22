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
  Clock3,
  MessageCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { foreigners, formatTzs } from "@/lib/foreigners";
import { getChatStatus, resetChatSession } from "@/lib/chat-sessions";

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
  const [chatUserId, setChatUserId] = useState("");

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
    setChatUserId(user.id);
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
  }, [navigate]);

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
    <div className="min-h-screen bg-background pb-10">
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex h-[76px] max-w-5xl items-center px-5">
          <img src="/1vela-logo.jpg" alt="1Vela" className="size-11 rounded-xl object-contain" />
          <button type="button" className="ml-8 grid size-11 place-items-center rounded-xl text-foreground" aria-label="Menu" onClick={() => setMenuOpen((value) => !value)}><Menu className="size-6" /></button>
          <div className="ml-2 hidden h-11 w-px bg-border sm:block" />
          <button type="button" className="ml-3 grid size-11 place-items-center rounded-xl text-foreground" aria-label="Search"><Search className="size-5" /></button>
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={() => setNotificationsOpen((value) => !value)} className="relative grid size-11 place-items-center rounded-xl text-foreground" aria-label="Notifications">
              <Bell className="size-5" />
              {unreadCount > 0 && <span className="absolute right-2 top-2 grid size-4 place-items-center rounded-full bg-primary text-[9px] font-extrabold text-primary-foreground">{Math.min(9, unreadCount)}</span>}
            </button>
            <button type="button" className="grid size-11 place-items-center rounded-xl text-foreground"><MoreHorizontal className="size-6" /></button>
          </div>
        </div>
        {menuOpen && (
          <div className="border-t border-border bg-card px-5 py-4">
            <div className="mx-auto flex max-w-5xl flex-wrap gap-2">
              <Link to="/" className="rounded-xl bg-brand-tint px-4 py-2 text-sm font-bold">Start Chat</Link>
              <Link to="/withdrawal" className="rounded-xl bg-brand-tint px-4 py-2 text-sm font-bold">Withdrawal</Link>
              <button type="button" onClick={signOut} className="rounded-xl bg-brand-tint px-4 py-2 text-sm font-bold">Logout</button>
            </div>
          </div>
        )}
        {notificationsOpen && (
          <div className="absolute right-4 top-[68px] z-40 w-[min(92vw,380px)] rounded-2xl border border-border bg-card p-3 shadow-xl">
            <div className="flex items-center justify-between px-2 py-1"><p className="font-extrabold">Notifications</p><button type="button" onClick={() => setNotificationsOpen(false)}><X className="size-4" /></button></div>
            <div className="mt-2 max-h-80 overflow-auto">
              {notifications.length === 0 ? <p className="p-4 text-sm text-muted-foreground">Hakuna notification.</p> : notifications.map((item) => (
                <button key={item.id} type="button" onClick={() => void markRead(item.id)} className={`w-full rounded-xl p-3 text-left ${item.read_at ? "bg-card" : "bg-primary/5"}`}>
                  <p className="font-bold">{item.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{item.message}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{new Date(item.created_at).toLocaleString("en-GB")}</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-5xl px-5 py-8">
        {latestBroadcast && (
          <section className="relative overflow-hidden rounded-[28px] bg-primary px-6 py-7 text-primary-foreground shadow-lg">
            <div className="mx-auto max-w-3xl">
              <span className="inline-flex rounded-full bg-sky-500/20 px-4 py-2 text-xs font-extrabold tracking-widest text-primary-foreground">SYSTEM BROADCAST</span>
              <h2 className="mt-5 text-2xl font-extrabold">{latestBroadcast.title}</h2>
              <p className="mt-3 whitespace-pre-line text-base font-medium leading-7 text-primary-foreground/90">{latestBroadcast.message}</p>
            </div>
          </section>
        )}

        <section className="mt-8 flex items-center gap-4">
          <div className="grid size-16 place-items-center rounded-full bg-gradient-to-br from-primary to-cyan-400 text-2xl font-extrabold text-primary-foreground">{greetingName.slice(0, 1).toUpperCase()}</div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Welcome back, {greetingName}</h1>
            <p className="mt-1 text-muted-foreground">Here's how your earnings are looking today.</p>
          </div>
        </section>

        <section className="mt-8 overflow-hidden rounded-[30px] brand-gradient p-7 text-primary-foreground shadow-xl">
          <p className="text-sm font-extrabold tracking-[0.18em] text-primary-foreground/75">↗ NET INCOME</p>
          <div className="mt-4 flex items-baseline gap-3"><p className="text-5xl font-extrabold tracking-tight">{netIncome.toLocaleString("en-US")}</p><span className="text-2xl text-primary-foreground/70">TZS</span></div>
          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            <Metric label="EXPENSES" value={`${withdrawn.toLocaleString("en-US")} TZS`} />
            <Metric label="BONUS" value={`${bonus.toLocaleString("en-US")} TZS`} />
          </div>
        </section>

        <div className="mt-4 grid grid-cols-3 gap-3 overflow-x-auto">
          <button type="button" onClick={() => void shareDashboard()} className="flex min-w-0 items-center justify-center gap-2 rounded-full bg-card px-4 py-4 font-bold text-slate-800 shadow-sm"><Share2 className="size-5" /> <span>Share</span></button>
          <Link to="/" className="flex min-w-0 items-center justify-center gap-2 rounded-full bg-card px-4 py-4 font-bold text-slate-800 shadow-sm"><Send className="size-5" /> <span>Pay Client</span></Link>
          <Link to="/withdrawal" className="flex min-w-0 items-center justify-center gap-2 rounded-full bg-card px-4 py-4 font-bold text-slate-800 shadow-sm"><Wallet className="size-5" /> <span>Cash Out</span></Link>
        </div>

        <div className="mt-8 grid gap-5">
          <BalanceCard label="1VELA" title="Balance" amount={balance} percent={balancePercent} positive />
          <BalanceCard label="1VELA" title="Withdrawal" amount={withdrawn} percent={expensePercent} />
        </div>

        <section className="mt-7 rounded-[28px] bg-card p-6 shadow-card">
          <div className="flex items-center justify-between"><h2 className="text-2xl font-extrabold text-foreground">Other Balances</h2><ChevronRight className="size-5 text-muted-foreground" /></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <SmallBalance title="Current Balance" value={`TZS ${balance.toLocaleString("en-US")}`} />
            <SmallBalance title="Total Earned" value={`TZS ${netIncome.toLocaleString("en-US")}`} />
          </div>
        </section>

        <section className="mt-8">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-primary"><span className="h-1.5 w-9 rounded-full bg-primary" /><span className="text-sm font-extrabold tracking-widest">AVAILABLE CHATS</span></div>
              <h2 className="mt-2 text-2xl font-extrabold text-foreground">Continue chatting</h2>
              <p className="mt-1 text-sm text-muted-foreground">Chagua mgeni na endelea na mazungumzo yako.</p>
            </div>
            <Link to="/" className="rounded-full bg-brand-tint px-4 py-2 text-sm font-extrabold text-primary">View all</Link>
          </div>

          <div className="mt-5 grid gap-5">
            {foreigners.map((person) => {
              const status = chatUserId ? getChatStatus(chatUserId, person) : "new";
              return (
                <article key={person.id} className="rounded-3xl border border-border bg-card p-5 shadow-card">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-4">
                      <div className="relative shrink-0">
                        <img src={person.avatar} alt={person.name} className="size-16 rounded-full object-cover ring-2 ring-primary" />
                        <span className="absolute bottom-0 right-0 size-3.5 rounded-full bg-primary ring-2 ring-card" />
                      </div>
                      <div>
                        <p className="text-lg font-extrabold text-foreground">{person.flag} {person.name}</p>
                        <p className="mt-1 flex items-center gap-2 text-sm font-bold text-primary"><span className="size-2 rounded-full bg-primary" /> Online</p>
                        <p className="mt-1 text-sm font-semibold text-muted-foreground">{person.rating.toFixed(1)} · {person.topic}</p>
                      </div>
                    </div>
                    <span className="rounded-xl bg-brand-tint px-3 py-2 text-xs font-bold text-primary">{formatTzs(person.priceTzs)}</span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-border bg-brand-tint/60 p-4">
                      <Clock3 className="size-4 text-primary" />
                      <p className="mt-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Chat time</p>
                      <p className="mt-1 font-bold">{person.minutes} minutes</p>
                    </div>
                    <div className="rounded-2xl border border-border bg-brand-tint/60 p-4">
                      <MessageCircle className="size-4 text-primary" />
                      <p className="mt-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Topic</p>
                      <p className="mt-1 font-bold">{person.topic}</p>
                    </div>
                  </div>

                  <Link
                    to="/chat/$id"
                    params={{ id: person.id }}
                    onClick={() => { if (status === "completed" && chatUserId) resetChatSession(chatUserId, person.id); }}
                    className="brand-gradient mt-4 flex items-center justify-center gap-2 rounded-2xl px-6 py-4 text-lg font-extrabold text-brand-foreground shadow-brand"
                  >
                    {status === "continue" ? "CONTINUE CHAT" : status === "completed" ? "START CHAT AGAIN" : "START CHAT"}
                  </Link>
                </article>
              );
            })}
          </div>
        </section>

        {email && <p className="mt-8 text-center text-xs text-muted-foreground">{email}</p>}
        <button type="button" onClick={signOut} className="mx-auto mt-4 flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold text-muted-foreground"><LogOut className="size-4" /> Logout</button>
        <div className="mt-5 flex justify-center"><span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-bold text-muted-foreground"><CheckCircle2 className="size-4 text-primary" /> 1Vela Dashboard</span></div>
      </main>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-primary-foreground/15 p-4 backdrop-blur"><p className="text-sm font-extrabold text-primary-foreground/70">{label}</p><p className="mt-2 text-xl font-extrabold">{value}</p></div>;
}

function BalanceCard({ label, title, amount, percent, positive = false }: { label: string; title: string; amount: number; percent: number; positive?: boolean }) {
  return (
    <div className={`rounded-[28px] border-l-[6px] bg-card p-6 shadow-card ${positive ? "border-primary" : "border-pink-500"}`}>
      <div className="flex items-start justify-between gap-3"><span className="rounded-lg bg-brand-tint/50 px-3 py-2 text-xs font-extrabold tracking-wide text-muted-foreground">{label}</span><p className="text-2xl font-extrabold text-foreground">{amount.toLocaleString("en-US")}</p></div>
      <p className="mt-5 text-xl font-semibold text-muted-foreground">{title}</p>
      <div className="mt-5 flex items-center justify-between text-sm text-muted-foreground"><span>Growth</span><span>{percent}%</span></div>
      <div className="mt-2 h-2 rounded-full bg-brand-tint/50"><div className={`h-2 rounded-full ${positive ? "bg-primary" : "bg-pink-500"}`} style={{ width: `${Math.max(3, percent)}%` }} /></div>
    </div>
  );
}

function SmallBalance({ title, value }: { title: string; value: string }) {
  return <div className="rounded-2xl border border-border bg-brand-tint/50 p-4"><p className="text-sm font-semibold text-muted-foreground">{title}</p><p className="mt-1 text-xl font-extrabold text-foreground">{value}</p></div>;
}
