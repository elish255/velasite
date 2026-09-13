import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, Clock, Download, MessageCircle, Tag, X } from "lucide-react";
import { useMemo, useState } from "react";

import { SiteHeader } from "@/components/site-header";
import { formatTzs, nextDates, shuffleForeigners, usdEquivalent } from "@/lib/foreigners";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "1Vela — Lipwa kwa kuchati na wageni duniani" },
      {
        name: "description",
        content:
          "Ungana na wageni kutoka nchi mbalimbali, wafundishe Kiswahili na ulipwe kwa muda unaotumia kuchati.",
      },
      { property: "og:title", content: "1Vela — Lipwa kwa kuchati na wageni" },
      {
        property: "og:description",
        content: "Chati na wageni, wafundishe Kiswahili na ulipwe kwa kila dakika.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  const [showBanner, setShowBanner] = useState(true);
  const people = useMemo(() => shuffleForeigners(Date.now() / 86400000), []);

  return (
    <div className="min-h-screen bg-background pb-28">
      <SiteHeader />

      <section className="hero-surface px-5 pb-10 pt-12">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="font-display text-[2.1rem] font-extrabold leading-tight tracking-tight sm:text-5xl">
            Get paid by <span className="text-primary">chatting with foreigners</span> about
            different topics
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Ungana na wageni kutoka nchi mbalimbali duniani, wafundishe Kiswahili, na ulipwe
            kwa muda unaotumia kuchati.
          </p>
          <div className="mx-auto mt-8 h-1.5 w-28 rounded-full bg-primary" />
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="h-1.5 w-9 rounded-full bg-primary" />
            <h2 className="font-display text-xl font-extrabold tracking-tight">
              AVAILABLE NOW
            </h2>
          </div>
          <a
            href="https://wa.me/255700000000"
            className="flex items-center gap-2 rounded-full border border-border bg-card px-5 py-3 text-sm font-bold shadow-card"
          >
            <MessageCircle className="size-4" />
            Customer services
          </a>
        </div>

        <div className="mt-6 grid gap-6">
          {people.map((p, i) => (
            <article
              key={p.id}
              className="rounded-3xl border border-border bg-card p-5 shadow-card"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <img
                      src={p.avatar}
                      alt={`${p.name} kutoka ${p.country}`}
                      loading="lazy"
                      className="size-20 rounded-full object-cover ring-3 ring-primary"
                    />
                    <span className="absolute bottom-1 right-1 size-4 rounded-full bg-online ring-2 ring-card" />
                  </div>
                  <div>
                    <p className="font-display text-xl font-extrabold">
                      <span className="mr-1">{p.flag}</span>
                      {p.name}
                    </p>
                    <p className="mt-1 flex items-center gap-2 text-sm font-bold text-online">
                      <span className="size-2 rounded-full bg-online" />
                      Online
                    </p>
                    <p className="mt-1 text-lg font-semibold text-muted-foreground">
                      {p.rating.toFixed(1)}
                    </p>
                  </div>
                </div>
                <span className="flex items-center gap-2 rounded-xl bg-brand-tint px-3 py-2 text-sm font-bold text-primary">
                  <CalendarDays className="size-4" />
                  {nextDates[i % nextDates.length]}
                </span>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-border bg-brand-tint/60 p-4">
                  <Clock className="size-4 text-primary" />
                  <p className="mt-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Chat time
                  </p>
                  <p className="mt-1 font-bold">{p.minutes} minutes</p>
                </div>
                <div className="rounded-2xl border border-border bg-brand-tint/60 p-4">
                  <Tag className="size-4 text-primary" />
                  <p className="mt-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Topic
                  </p>
                  <p className="mt-1 font-bold">{p.topic}</p>
                </div>
              </div>

              <div className="brand-gradient mt-4 rounded-2xl px-6 py-4 text-center text-lg font-extrabold text-brand-foreground shadow-brand">
                {formatTzs(p.priceTzs)}
              </div>

              <Link
                to="/chat/$id"
                params={{ id: p.id }}
                className="mt-3 block rounded-2xl border-2 border-primary bg-card px-6 py-4 text-center text-lg font-extrabold text-primary"
              >
                START CHAT
              </Link>
              <p className="mt-2 text-center text-sm font-medium text-muted-foreground">
                {usdEquivalent(p.priceTzs)}
              </p>
            </article>
          ))}
        </div>
      </section>

      {showBanner && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-2 px-4 pb-4">
          <button
            type="button"
            onClick={() => setShowBanner(false)}
            aria-label="Funga"
            className="grid size-8 shrink-0 place-items-center rounded-full bg-card text-muted-foreground shadow-card"
          >
            <X className="size-4" />
          </button>
          <a
            href="#"
            className="brand-gradient flex flex-1 items-center justify-center gap-2 rounded-full px-5 py-4 font-bold text-brand-foreground shadow-brand"
          >
            <Download className="size-5" />
            Download 1Vela App
          </a>
        </div>
      )}
    </div>
  );
}
