import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useState } from "react";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Jisajili — 1Vela" },
      {
        name: "description",
        content: "Fungua akaunti yako ya 1Vela ili uanze kuchati na wageni na kulipwa.",
      },
      { property: "og:title", content: "Jisajili — 1Vela" },
      {
        property: "og:description",
        content: "Fungua akaunti ya 1Vela na uanze kupata malipo kwa kuchati.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const normalizedUsername = username.trim().replace(/^@/, "");
    if (!/^[A-Za-z0-9_]{3,30}$/.test(normalizedUsername)) {
      setError("Username iwe na herufi 3–30 na itumie herufi, namba au underscore (_).");
      setLoading(false);
      return;
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName.trim(), username: normalizedUsername, phone: phone.trim() },
      },
    });
    setLoading(false);

    if (signUpError) {
      const message = signUpError.message.toLowerCase();
      if (message.includes("profiles_username_key") || message.includes("duplicate key") || message.includes("username")) {
        setError("Username hiyo tayari inatumika. Tafadhali chagua username nyingine.");
      } else if (message.includes("already registered") || message.includes("already exists")) {
        setError("Barua pepe hiyo tayari imesajiliwa. Tumia email nyingine au login.");
      } else {
        setError(signUpError.message);
      }
      return;
    }
    if (data.session) {
      navigate({ to: "/account" });
    } else {
      navigate({ to: "/login", search: { registered: true } });
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="header-surface px-5 py-6 text-header-foreground">
        <div className="mx-auto flex max-w-md items-center gap-3">
          <Link to="/" aria-label="Rudi" className="grid size-10 place-items-center rounded-full bg-brand-dark/50">
            <ArrowLeft className="size-5" />
          </Link>
          <img src="/1vela-logo.jpg" alt="1Vela" className="h-12 w-12 rounded-full bg-white object-contain shadow-sm ring-1 ring-primary/20" />
        </div>
      </div>

      <main className="mx-auto max-w-md px-5 py-8">
        <h1 className="font-display text-3xl font-extrabold leading-tight">Jisajili Sasa</h1>
        <p className="mt-2 text-muted-foreground">
          Taarifa zako zitahifadhiwa salama na utazitumia kila utakapotaka ku-login.
        </p>

        <form onSubmit={onSubmit} className="mt-7 grid gap-4">
          <Field label="Jina kamili">
            <input
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Fredson Allen"
              className="input-base"
            />
          </Field>
          <Field label="Username">
            <input
              required
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))}
              placeholder="username123"
              maxLength={30}
              className="input-base"
            />
          </Field>
          <Field label="Namba ya simu">
            <input
              required
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0712 345 678"
              className="input-base"
            />
          </Field>
          <Field label="Barua pepe">
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jina@mfano.com"
              className="input-base"
            />
          </Field>
          <Field label="Nenosiri">
            <input
              required
              type="password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Angalau herufi 6"
              className="input-base"
            />
          </Field>

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
            Jisajili
          </button>
        </form>

        <p className="mt-5 rounded-2xl bg-brand-tint p-4 text-sm font-semibold text-secondary-foreground">
          Baada ya kujisajili, activate account yako kwa mtaji wa 12,000 TZS ili uanze
          kuchati na kulipwa.
        </p>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Una akaunti tayari?{" "}
          <Link to="/login" className="font-bold text-primary">
            Login hapa
          </Link>
        </p>
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-bold">{label}</span>
      {children}
    </label>
  );
}
