import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, SendHorizonal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

import { PaywallDialog } from "@/components/paywall-dialog";
import { getForeigner } from "@/lib/foreigners";

export const Route = createFileRoute("/chat/$id")({
  head: ({ params }) => {
    const person = getForeigner(params.id);
    const name = person ? person.name : "Chat";
    return {
      meta: [
        { title: `Chat na ${name} — 1Vela` },
        {
          name: "description",
          content: `Anza mazungumzo na ${name} kwenye 1Vela na ulipwe kwa muda unaotumia kuchati.`,
        },
        { property: "og:title", content: `Chat na ${name} — 1Vela` },
        {
          property: "og:description",
          content: "Mazungumzo ya moja kwa moja na wageni kwenye 1Vela.",
        },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: ChatPage,
});

type Msg = { from: "them" | "me"; text: string };

function ChatPage() {
  const { id } = Route.useParams();
  const person = getForeigner(id);
  if (!person) throw notFound();

  const [messages, setMessages] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(true);
  const [input, setInput] = useState("");
  const [showPaywall, setShowPaywall] = useState(false);
  const [activated, setActivated] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!active) return;
      if (data.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("activated")
          .eq("id", data.user.id)
          .maybeSingle();
        if (active) setActivated(Boolean(profile?.activated));
      }
      if (active) setCheckingAccess(false);
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (checkingAccess || activated) return;

    const timer = window.setInterval(async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("activated")
        .eq("id", data.user.id)
        .maybeSingle();
      if (profile?.activated) setActivated(true);
    }, 5000);

    return () => window.clearInterval(timer);
  }, [checkingAccess, activated]);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    person.opening.forEach((text, i) => {
      timers.push(
        setTimeout(
          () => {
            setMessages((m) => [...m, { from: "them", text }]);
            if (i === person.opening.length - 1) setTyping(false);
          },
          1200 + i * 1800,
        ),
      );
    });
    return () => timers.forEach(clearTimeout);
  }, [person]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;

    if (checkingAccess || !activated) {
      setShowPaywall(true);
      return;
    }

    setMessages((m) => [...m, { from: "me", text }]);
    setInput("");
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="header-surface sticky top-0 z-20 text-header-foreground">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link to="/" aria-label="Rudi" className="grid size-10 place-items-center rounded-full bg-brand-dark/50">
            <ArrowLeft className="size-5" />
          </Link>
          <img src={person.avatar} alt={person.name} className="size-11 rounded-full object-cover" />
          <div className="min-w-0">
            <p className="truncate font-bold">
              {person.flag} {person.name}
            </p>
            <p className="text-xs opacity-80">{typing ? "typing…" : "Online"}</p>
          </div>
          <span className="ml-auto rounded-full bg-brand-dark/50 px-3 py-1.5 text-xs font-bold">
            {person.minutes} min
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-3 px-4 py-6">
        <p className="mx-auto w-fit rounded-full bg-muted px-4 py-1.5 text-xs font-semibold text-muted-foreground">
          {person.topic}
        </p>
        {messages.map((m, i) => (
          <div key={i} className={m.from === "me" ? "flex justify-end" : "flex justify-start"}>
            <p
              className={
                m.from === "me"
                  ? "max-w-[80%] rounded-3xl rounded-br-md bg-primary px-4 py-3 text-primary-foreground"
                  : "max-w-[80%] rounded-3xl rounded-bl-md bg-card px-4 py-3 text-card-foreground shadow-card"
              }
            >
              {m.text}
            </p>
          </div>
        ))}
        {typing && (
          <div className="flex justify-start">
            <p className="rounded-3xl rounded-bl-md bg-card px-4 py-3 text-muted-foreground shadow-card">
              …
            </p>
          </div>
        )}
        <div ref={endRef} />
      </main>

      <form
        onSubmit={handleSend}
        className="sticky bottom-0 border-t border-border bg-card/95 px-4 py-3 backdrop-blur"
      >
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Andika ujumbe wako…"
            className="h-12 flex-1 rounded-full border border-input bg-background px-5 outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="submit"
            aria-label="Send"
            className="brand-gradient grid size-12 shrink-0 place-items-center rounded-full text-brand-foreground shadow-brand"
          >
            <SendHorizonal className="size-5" />
          </button>
        </div>
      </form>

      {showPaywall && <PaywallDialog onClose={() => setShowPaywall(false)} />}
    </div>
  );
}
