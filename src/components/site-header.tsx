import { Link } from "@tanstack/react-router";
import { Eye, EyeOff, Menu, User, Wallet, X } from "lucide-react";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [showBalance, setShowBalance] = useState(false);
  const [live, setLive] = useState(2551);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setLive((v) => Math.max(2100, v + Math.round((Math.random() - 0.45) * 14)));
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setSignedIn(Boolean(session));
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <header className="header-surface text-header-foreground">
      <div className="mx-auto w-full max-w-3xl px-5 pb-6 pt-5">
        <div className="flex items-start justify-between">
          <Link to="/" className="block">
            <span className="font-display text-3xl font-extrabold tracking-tight">
              ①Vela
            </span>
            <p className="mt-1 text-xs font-medium opacity-75">
              Share your countrie&apos;s vibe
            </p>
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
            to="/register"
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
              {showBalance ? "TZS 0" : "●●●●●"}
            </span>
          </span>
        </button>
      </div>
    </header>
  );
}
