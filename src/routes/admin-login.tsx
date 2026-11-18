import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import { useState, type FormEvent } from "react";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin-login")({
  head: () => ({
    meta: [
      { title: "Admin Login — 1Vela" },
      {
        name: "description",
        content: "Ingia kwa usalama kwenye admin panel ya 1Vela.",
      },
    ],
  }),
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const { data, error: signInError } = await supabase.auth.signInWithPassword(
      {
        email: email.trim(),
        password,
      },
    );

    if (signInError || !data.user) {
      setLoading(false);
      setError("Imeshindikana kuingia. Hakiki barua pepe na nenosiri.");
      return;
    }

    const { data: adminRow, error: adminError } = await supabase
      .from("admin_users")
      .select("user_id")
      .eq("user_id", data.user.id)
      .maybeSingle();

    if (adminError || !adminRow) {
      await supabase.auth.signOut();
      setLoading(false);
      setError("Akaunti hii haina ruhusa ya kuingia admin panel.");
      return;
    }

    navigate({ to: "/admin" });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="header-surface px-5 py-6 text-header-foreground">
        <div className="mx-auto flex max-w-md items-center gap-3">
          <Link
            to="/"
            aria-label="Rudi mwanzo"
            className="grid size-10 place-items-center rounded-full bg-brand-dark/50"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <img
            src="/1vela-logo.jpg"
            alt="1Vela"
            className="size-11 rounded-full bg-white object-contain"
          />
          <div>
            <p className="font-extrabold">1Vela</p>
            <p className="text-xs opacity-80">Admin access</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md px-5 py-10">
        <div className="rounded-3xl border border-border bg-card p-6 shadow-card sm:p-8">
          <div className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
            <ShieldCheck className="size-7" />
          </div>
          <h1 className="mt-5 font-display text-3xl font-extrabold">
            Admin login
          </h1>
          <p className="mt-2 leading-relaxed text-muted-foreground">
            Ingia kwa akaunti yenye ruhusa ya admin ya 1Vela.
          </p>

          <form onSubmit={onSubmit} className="mt-7 grid gap-4">
            <label className="grid gap-2">
              <span className="text-sm font-bold">Barua pepe ya admin</span>
              <input
                required
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="input-base"
                placeholder="admin@mfano.com"
                disabled={loading}
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-bold">Nenosiri</span>
              <input
                required
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="input-base"
                placeholder="Nenosiri lako"
                disabled={loading}
              />
            </label>

            {error && (
              <p
                role="alert"
                className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="brand-gradient mt-2 flex items-center justify-center gap-2 rounded-2xl px-6 py-4 font-extrabold text-brand-foreground shadow-brand disabled:opacity-70"
            >
              {loading && <Loader2 className="size-5 animate-spin" />}
              Ingia admin panel
            </button>
          </form>

          <Link
            to="/login"
            className="mt-6 block text-center text-sm font-bold text-primary"
          >
            Ingia kama mtumiaji
          </Link>
        </div>
      </main>
    </div>
  );
}
