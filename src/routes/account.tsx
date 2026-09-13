import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, BadgeCheck, LogOut } from "lucide-react";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

type Profile = {
  full_name: string;
  phone: string;
  balance: number;
  activated: boolean;
};

export const Route = createFileRoute("/account")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Akaunti yangu — 1Vela" },
      { name: "description", content: "Tazama taarifa zako, salio na hali ya akaunti yako ya 1Vela." },
      { property: "og:title", content: "Akaunti yangu — 1Vela" },
      { property: "og:description", content: "Taarifa za akaunti yako ya 1Vela." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) {
        navigate({ to: "/login", search: {} });
        return;
      }
      const { data: row } = await supabase
        .from("profiles")
        .select("full_name, phone, balance, activated")
        .eq("id", user.id)
        .maybeSingle();
      if (!active) return;
      setEmail(user.email ?? "");
      setProfile(row as Profile | null);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [navigate]);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="header-surface px-5 py-6 text-header-foreground">
        <div className="mx-auto flex max-w-md items-center gap-3">
          <Link to="/" aria-label="Rudi" className="grid size-10 place-items-center rounded-full bg-brand-dark/50">
            <ArrowLeft className="size-5" />
          </Link>
          <span className="font-display text-2xl font-extrabold">①Vela</span>
        </div>
      </div>

      <main className="mx-auto max-w-md px-5 py-8">
        <h1 className="font-display text-3xl font-extrabold">Akaunti yangu</h1>

        {loading ? (
          <p className="mt-6 text-muted-foreground">Inapakia…</p>
        ) : (
          <>
            <div className="mt-6 grid gap-3 rounded-3xl border border-border bg-card p-5 shadow-card">
              <Row label="Jina" value={profile?.full_name || "—"} />
              <Row label="Simu" value={profile?.phone || "—"} />
              <Row label="Barua pepe" value={email} />
              <Row
                label="Salio"
                value={`TZS ${Number(profile?.balance ?? 0).toLocaleString("en-US")}`}
              />
            </div>

            {!profile?.activated && (
              <div className="mt-5 rounded-3xl bg-brand-tint p-5">
                <BadgeCheck className="size-6 text-primary" />
                <p className="mt-3 font-bold">Akaunti yako bado haijawashwa</p>
                <p className="mt-1 text-sm font-medium text-secondary-foreground">
                  Activate account yako kwa mtaji wa 15,000 TZS ili uanze kuchati na kulipwa.
                </p>
                <a
                  href="https://wa.me/255700000000"
                  className="brand-gradient mt-4 flex items-center justify-center rounded-2xl px-6 py-4 font-extrabold text-brand-foreground shadow-brand"
                >
                  Activate kwa 15,000 TZS
                </a>
              </div>
            )}

            <button
              type="button"
              onClick={signOut}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl border border-border py-3 font-semibold text-muted-foreground"
            >
              <LogOut className="size-4" />
              Toka
            </button>
          </>
        )}
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border pb-3 last:border-0 last:pb-0">
      <span className="text-sm font-semibold text-muted-foreground">{label}</span>
      <span className="text-right font-bold">{value}</span>
    </div>
  );
}
