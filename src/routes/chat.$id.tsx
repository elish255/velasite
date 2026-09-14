import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, CalendarDays, Languages, SendHorizonal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
          content: `Chat na ${name} kwenye 1Vela.`,
        },
        { property: "og:title", content: `Chat na ${name} — 1Vela` },
        { property: "og:description", content: "Mazungumzo kwenye 1Vela." },
        { property: "og:type", content: "website" },
      ],
    };
  },
  component: ChatPage,
});

type Msg = {
  from: "them" | "me";
  text: string;
  swahili?: string;
  time: string;
};

function nowTime() {
  return new Intl.DateTimeFormat("en-TZ", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date());
}

function translateToSwahili(text: string) {
  const lower = text.toLowerCase();
  const exact: Record<string, string> = {
    "hi! habari yako? 😊": "Habari yako? 😊",
    "hola! mambo vipi? 👋": "Habari! Mambo vipi? 👋",
    "good evening! karibu 🙌": "Habari za jioni! Karibu 🙌",
    "konnichiwa! habari za jioni 🍜": "Habari! Habari za jioni 🍜",
    "salut! shikamoo 😄": "Habari! Shikamoo 😄",
    "oi! vipi rafiki ⚽": "Habari! Vipi rafiki? ⚽",
    "hallo! habari ya kazi? 📚": "Habari! Habari ya kazi? 📚",
    "hey there! mambo 👋": "Habari! Mambo? 👋",
    "oh, karibu! what does that mean? is it like saying welcome?": "Oh, KARIBU! Hilo lina maana gani? Ni kama kusema welcome?",
    "i know a little kiswahili! does that mean hello/how are you? 😊": "Najua Kiswahili kidogo! Hilo lina maana ya hello/habari yako? 😊",
    "oh, asante! i think that means thank you, right?": "Oh, ASANTE! Nafikiri hiyo ina maana ya thank you, sawa?",
    "i have heard pole before. does it mean sorry, or is it a way to comfort someone?": "Nimeshawahi kusikia POLE. Ina maana ya samahani, au ni neno la kumfariji mtu?",
    "rafiki! i like that word. it means friend, right?": "RAFIKI! Ninalipenda hilo neno. Lina maana ya friend, sawa?",
  };
  if (exact[lower]) return exact[lower];
  if (lower.includes("what should i eat")) return "Niambie, nile chakula gani kwanza nikifika Tanzania?";
  if (lower.includes("can you help me practise")) return "Unaweza kunisaidia kufanya mazoezi ya sentensi tano muhimu za Kiswahili leo?";
  if (lower.includes("can you teach me")) return "Unaweza kunifundisha?";
  if (lower.includes("which artist")) return "Ni msanii gani nimwongeze kwenye playlist yangu wiki hii?";
  if (lower.includes("which one do you support")) return "Unaunga mkono timu gani?";
  if (lower.includes("mobile money")) return "Je, mobile money inatumika kila mahali Tanzania?";
  if (lower.includes("what is one place")) return "Ni sehemu gani moja unafikiri kila mgeni anapaswa kutembelea?";
  if (lower.includes("what does") || lower.includes("meaning")) return "Hilo lina maana gani?";
  return "Ujumbe huu unahusiana na mazungumzo yetu. Gusa tena kuona English.";
}

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
    "Interesting! Tell me more about that.",
    "I am learning Kiswahili, so please correct my words if I make a mistake.",
    "That sounds interesting. What would you recommend to someone visiting Tanzania?",
    "Really? I did not know that. Can you explain it in a simple way?",
    "I like this topic. What is your own experience with it?",
  ];
  return replies[Math.floor(Math.random() * replies.length)];
}

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
  const [messageCount, setMessageCount] = useState(0);
  const messageCountRef = useRef(0);
  const [translated, setTranslated] = useState<Record<number, boolean>>({});
  const rewardShownRef = useRef(false);
  const sessionIdRef = useRef(crypto.randomUUID());
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

  // Open the chat with one natural first message, matching a normal chat layout.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const first = person.opening[0] ?? "Hi! How are you? 😊";
      setMessages([{ from: "them", text: first, swahili: translateToSwahili(first), time: nowTime() }]);
      messageCountRef.current = 1;
      setMessageCount(1);
      setTyping(false);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [person]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, typing]);

  async function finishSession() {
    if (rewardShownRef.current) return;
    rewardShownRef.current = true;
    setTyping(false);
    const { data, error } = await supabase.rpc("credit_chat_reward", {
      p_session_id: sessionIdRef.current,
      p_foreigner_id: person.id,
      p_amount: person.priceTzs,
    });
    setSessionEnded(true);
    if (error) {
      toast.error("Reward haijaongezwa kwenye Current Balance. Tafadhali jaribu tena.");
      console.error("credit_chat_reward failed", error);
      return;
    }
    const reward = Number(data ?? person.priceTzs);
    window.dispatchEvent(new Event("vela:balance-updated"));
    toast.success(`Ujumbe 20 umekamilika. Reward ya TZS ${reward.toLocaleString("en-US")} imeongezwa kwenye Current Balance.`);
  }

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sessionEnded || typing) return;

    if (checkingAccess || !activated) {
      setShowPaywall(true);
      return;
    }

    const nextCount = messageCountRef.current + 1;
    messageCountRef.current = nextCount;
    setMessages((m) => [...m, { from: "me", text, time: nowTime() }]);
    setMessageCount(nextCount);
    setInput("");

    if (nextCount >= 20) {
      void finishSession();
      return;
    }

    setTyping(true);
    window.setTimeout(() => {
      const reply = buildAiReply(text);
      const incomingCount = messageCountRef.current + 1;
      messageCountRef.current = incomingCount;
      setMessages((m) => [...m, { from: "them", text: reply, swahili: translateToSwahili(reply), time: nowTime() }]);
      setMessageCount(incomingCount);
      if (incomingCount >= 20) {
        void finishSession();
      } else {
        setTyping(false);
      }
    }, 1000 + Math.floor(Math.random() * 1000));
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex min-h-[76px] max-w-3xl items-center gap-3 px-4 py-3">
          <Link
            to="/"
            aria-label="Rudi"
            className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-tint text-foreground transition hover:bg-brand-soft"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <div className="relative shrink-0">
            <img src={person.avatar} alt={person.name} className="size-12 rounded-full object-cover ring-2 ring-brand-soft" />
            <span className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full border-2 border-card bg-primary" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="truncate text-lg font-extrabold text-foreground">{person.flag} {person.name}</h1>
            </div>
            <p className="text-sm font-semibold text-primary">● {typing ? "Typing…" : "Online now"}</p>
          </div>
          <div className="ml-auto shrink-0 rounded-full bg-brand-tint px-3 py-2 text-xs font-extrabold text-primary">
            TZS {person.priceTzs.toLocaleString("en-US")}
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col bg-background px-4 py-5">
        <div className="mb-5 flex items-center justify-center gap-2 rounded-2xl bg-brand-tint px-4 py-3 text-center text-sm font-bold text-primary">
          <CalendarDays className="size-4 shrink-0" />
          <span>September 14 · {person.topic} · {messageCount}/20 messages</span>
        </div>

        <div className="mb-5 rounded-3xl bg-primary px-5 py-5 text-center text-primary-foreground shadow-brand">
          <p className="text-sm font-medium opacity-90">You are chatting with {person.name} for {person.minutes} minutes.</p>
          <p className="mt-1 text-lg font-extrabold">Chat session reward: TZS {person.priceTzs.toLocaleString("en-US")}</p>
          <p className="mt-1 text-xs opacity-80">AI chat partner · {messageCount}/20 messages</p>
        </div>

        <div className="flex-1 space-y-4 pb-4">
          {messages.map((m, i) => {
            const isTranslated = Boolean(translated[i]);
            return (
              <div key={`${m.time}-${i}`} className={m.from === "me" ? "flex justify-end" : "flex justify-start"}>
                <div className="max-w-[86%]">
                  <div
                    className={
                      m.from === "me"
                        ? "rounded-[24px] rounded-br-md bg-primary px-4 py-3 text-primary-foreground shadow-sm"
                        : "rounded-[24px] rounded-bl-md border border-border bg-card px-4 py-3 text-foreground shadow-card"
                    }
                  >
                    <p className="whitespace-pre-wrap text-[15px] leading-6">
                      {isTranslated && m.swahili ? m.swahili : m.text}
                    </p>
                    <p className={m.from === "me" ? "mt-1.5 text-right text-[11px] opacity-70" : "mt-1.5 text-[11px] text-muted-foreground"}>
                      {m.time}
                    </p>
                  </div>

                  {m.from === "them" && m.swahili && (
                    <button
                      type="button"
                      onClick={() => setTranslated((prev) => ({ ...prev, [i]: !prev[i] }))}
                      className="mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold text-primary hover:bg-brand-tint"
                    >
                      <Languages className="size-3.5" />
                      {isTranslated ? "Onyesha English" : "Tafsiri kwa Kiswahili"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {typing && (
            <div className="flex justify-start">
              <div className="rounded-[24px] rounded-bl-md border border-border bg-card px-5 py-3 text-lg tracking-widest text-muted-foreground shadow-card">
                •••
              </div>
            </div>
          )}

          {sessionEnded && (
            <div className="rounded-2xl bg-brand-tint px-4 py-4 text-center text-sm font-bold text-primary">
              This chat session has ended. Start another chat to continue.
            </div>
          )}
          <div ref={endRef} />
        </div>
      </main>

      <form onSubmit={handleSend} className="sticky bottom-0 z-20 border-t border-border bg-card/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          <input
            disabled={sessionEnded || typing}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={typing ? "Foreigner anaandika…" : "Andika ujumbe wako…"}
            className="h-12 min-w-0 flex-1 rounded-full border border-input bg-background px-5 text-[15px] outline-none transition focus:ring-2 focus:ring-ring disabled:opacity-70"
          />
          <button
            disabled={sessionEnded || typing || !input.trim()}
            type="submit"
            aria-label="Send"
            className="brand-gradient grid size-12 shrink-0 place-items-center rounded-full text-brand-foreground shadow-brand disabled:cursor-not-allowed disabled:opacity-50"
          >
            <SendHorizonal className="size-5" />
          </button>
        </div>
      </form>

      {showPaywall && <PaywallDialog onClose={() => setShowPaywall(false)} />}
    </div>
  );
}
