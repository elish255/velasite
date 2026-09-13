import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useState } from "react";

import { supabase } from "@/integrations/supabase/client";

type LoginSearch = { registered?: boolean };

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    registered: search['registered'] === true || search['registered'] === "true",
  }),
  head: () => ({
    meta: [
      { title: "Login — 1Vela" },
      { name: "description", content: "Ingia kwenye akaunti yako ya 1Vela na uendelee kuchati." },
      { property: "og:title", content: "Login — 1Vela" },
      { property: "og:description", content: "Ingia kwenye akaunti yako ya 1Vela." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { registered } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    navigate({ to: "/account" });
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="header-surface px-5 py-6 text-header-foreground">
        <div className="mx-auto flex max-w-md items-center gap-3">
          <Link to="/" aria-label="Rudi" className="grid size-10 place-items-center rounded-full bg-brand-dark/50">
            <ArrowLeft className="size-5" />
          </Link>
          <img src="/1vela-logo.jpg" alt="1Vela" className="h-12 w-auto max-w-[160px] rounded-xl object-contain" />
        </div>
      </div>

      <main className="mx-auto max-w-md px-5 py-8">
        <h1 className="font-display text-3xl font-extrabold">Karibu tena</h1>
        <p className="mt-2 text-muted-foreground">Ingia kwa taarifa ulizojisajili nazo.</p>

        {registered && (
          <p className="mt-5 rounded-2xl bg-brand-tint p-4 text-sm font-semibold text-secondary-foreground">
            Usajili umekamilika. Sasa ingia kwenye akaunti yako.
          </p>
        )}

        <form onSubmit={onSubmit} className="mt-7 grid gap-4">
          <label className="grid gap-2">
            <span className="text-sm font-bold">Barua pepe</span>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-base"
              placeholder="jina@mfano.com"
            />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-bold">Nenosiri</span>
            <input
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-base"
              placeholder="••••••"
            />
          </label>

          {error && (
            <p className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="brand-gradient mt-2 flex items-center justify-center gap-2 rounded-2xl px-6 py-4 text-lg font-extrabold text-brand-foreground shadow-brand disabled:opacity-70"
          >
            {loading && <Loader2 className="size-5 animate-spin" />}
            Login
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Huna akaunti?{" "}
          <Link to="/register" className="font-bold text-primary">
            Jisajili sasa
          </Link>
        </p>
      </main>
    </div>
  );
}
