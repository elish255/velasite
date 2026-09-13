import { Link } from "@tanstack/react-router";
import { Eye, EyeOff, Menu, User, Wallet, X } from "lucide-react";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [showBalance, setShowBalance] = useState(false);
  const [live, setLive] = useState(2551);
  const [signedIn, setSignedIn] = useState(false);
  const [balance, setBalance] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setLive((v) => Math.max(2100, v + Math.round((Math.random() - 0.45) * 14)));
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSignedIn(Boolean(data.session));
      if (data.session?.user) {
        const { data: profile } = await supabase.from("profiles").select("balance").eq("id", data.session.user.id).maybeSingle();
        setBalance(Number(profile?.balance ?? 0));
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, session) => {
      setSignedIn(Boolean(session));
      if (session?.user) {
        const { data: profile } = await supabase.from("profiles").select("balance").eq("id", session.user.id).maybeSingle();
        setBalance(Number(profile?.balance ?? 0));
      } else {
        setBalance(0);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <header className="header-surface text-header-foreground">
      <div className="mx-auto w-full max-w-3xl px-5 pb-6 pt-5">
        <div className="flex items-start justify-between">
          <Link to="/" className="block">
            <img
              src="/1vela-logo.jpg"
              alt="1Vela — Share your country's vibe"
              className="h-14 w-14 rounded-full bg-white object-contain p-1 shadow-lg ring-2 ring-white/20 sm:h-16 sm:w-16"
            />
          </Link>

          <div className="flex items-center gap-3">
            <Link
              to={signedIn ? "/account" : "/login"}
              aria-label="Account"
              className="grid size-11 place-items-center rounded-2xl bg-brand-dark/70"
            >
              <User className="size-5" />
            </Link>
            <button
              type="button"
              aria-label="Menu"
              onClick={() => setOpen((v) => !v)}
              className="grid size-11 place-items-center rounded-2xl bg-brand-dark/40 ring-1 ring-header-foreground/15"
            >
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>

        {open && (
          <nav className="mt-4 grid gap-1 rounded-2xl bg-brand-dark/50 p-2 text-sm font-semibold">
            <Link to="/" onClick={() => setOpen(false)} className="rounded-xl px-3 py-2.5 hover:bg-header-foreground/10">
              Home
            </Link>
            <Link to="/register" onClick={() => setOpen(false)} className="rounded-xl px-3 py-2.5 hover:bg-header-foreground/10">
              Jisajili
            </Link>
            <Link to="/login" onClick={() => setOpen(false)} className="rounded-xl px-3 py-2.5 hover:bg-header-foreground/10">
              Login
            </Link>
            <Link to="/account" onClick={() => setOpen(false)} className="rounded-xl px-3 py-2.5 hover:bg-header-foreground/10">
              Akaunti yangu
            </Link>
          </nav>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-full bg-brand-dark/40 px-5 py-3 ring-1 ring-header-foreground/15">
            <span className="live-dot size-2.5 rounded-full bg-online" />
            <span className="font-bold">{live.toLocaleString("en-US")}</span>
            <span className="text-sm opacity-80">live</span>
          </div>
          <Link
            to={signedIn ? "/withdrawal" : "/login"}
            className="brand-gradient flex items-center gap-2 rounded-full px-6 py-3 font-bold text-brand-foreground shadow-brand"
          >
            <Wallet className="size-5" />
            Withdraw
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setShowBalance((v) => !v)}
          className="mt-3 flex w-full max-w-xs items-center gap-3 rounded-2xl bg-brand-dark/60 px-5 py-4 text-left"
        >
          {showBalance ? <EyeOff className="size-5 opacity-80" /> : <Eye className="size-5 opacity-80" />}
          <span>
            <span className="block text-[11px] font-bold uppercase tracking-widest opacity-70">
              Current balance
            </span>
            <span className="mt-1 block font-bold text-gold">
              {showBalance ? `TZS ${balance.toLocaleString("en-US")}` : "●●●●●"}
            </span>
          </span>
        </button>
      </div>
    </header>
  );
}
