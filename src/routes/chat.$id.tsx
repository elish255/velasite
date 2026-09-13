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
  const [sessionEnded, setSessionEnded] = useState(false);
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

  function buildAiReply(text: string) {
    const normalized = text.toLowerCase().trim();
    if (/\bkaribu\b/i.test(normalized)) return "Oh, KARIBU! What does that mean? Is it like saying welcome?";
    if (/\b(habari|mambo|hujambo|niaje)\b/i.test(normalized)) return "I know a little Kiswahili! Does that mean hello/how are you? 😊";
    if (/\b(asante|shukrani)\b/i.test(normalized)) return "Oh, ASANTE! I think that means thank you, right?";
    if (/\b(pole)\b/i.test(normalized)) return "I have heard POLE before. Does it mean sorry, or is it a way to comfort someone?";
    if (/\b(rafiki|marafiki)\b/i.test(normalized)) return "RAFIKI! I like that word. It means friend, right?";
    if (/\b(nzuri|vizuri|poa)\b/i.test(normalized)) return "Nice! I hear NZURI and POA a lot. Can you teach me another useful word?";
    if (/\b(kwaheri|tutaonana)\b/i.test(normalized)) return "KWaheri? I think you are saying goodbye. But don't leave yet 😄";
    if (/\b(simba|yanga)\b/i.test(normalized)) return "You mentioned Simba/Yanga! I know they are big football names in Tanzania. Which one do you support?";
    if (/\b(tanzania|dar|arusha|mwanza|mbeya|zanzibar)\b/i.test(normalized)) return "Tanzania sounds amazing. What is one place you think every visitor should see?";
    if (normalized.includes("what does") || normalized.includes("meaning")) return "Good question. Teach me the Kiswahili word you mean and I will try to use it in a sentence.";
    const replies = [
      `Interesting! Tell me more about that.`,
      `I am learning Kiswahili, so please correct my words if I make a mistake.`,
      `That sounds interesting. What would you recommend to someone visiting Tanzania?`,
      `Really? I did not know that. Can you explain it in a simple way?`,
      `I like this topic. What is your own experience with it?`,
    ];
    return replies[Math.floor(Math.random() * replies.length)];
  }

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sessionEnded) return;

    if (checkingAccess || !activated) {
      setShowPaywall(true);
      return;
    }

    setMessages((m) => [...m, { from: "me", text }]);
    setInput("");
    setTyping(true);

    window.setTimeout(() => {
      setMessages((m) => [...m, { from: "them", text: buildAiReply(text) }]);
      setTyping(false);
    }, 1200 + Math.floor(Math.random() * 1200));
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
            <p className="text-xs opacity-80">{typing ? "typing…" : "AI chat partner"}</p>
          </div>
          <span className="ml-auto rounded-full bg-brand-dark/50 px-3 py-1.5 text-xs font-bold">
            {person.minutes} min session
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-3 px-4 py-6">
        <p className="mx-auto w-fit rounded-full bg-muted px-4 py-1.5 text-xs font-semibold text-muted-foreground">
          {person.topic} · AI chat partner
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
        {sessionEnded && (
          <div className="rounded-2xl bg-brand-tint px-4 py-3 text-center text-sm font-bold text-primary">
            This chat session has ended. Start another chat to continue.
          </div>
        )}
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
            disabled={sessionEnded}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Andika ujumbe wako…"
            className="h-12 flex-1 rounded-full border border-input bg-background px-5 outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            disabled={sessionEnded}
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
