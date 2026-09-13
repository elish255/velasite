import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Languages, SendHorizonal } from "lucide-react";
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

type Msg = {
  from: "them" | "me";
  text: string;
  swahili?: string;
};

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
            setMessages((m) => [...m, { from: "them", text, swahili: translateToSwahili(text) }]);
            messageCountRef.current += 1;
            setMessageCount(messageCountRef.current);
            setTyping(i !== person.opening.length - 1);
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
      "oh, karibu! what does that mean? is it like saying welcome?": "Oh, KARIBU! Hilo lina maana gani? Ni kama kusema karibu/welcome?",
      "i know a little kiswahili! does that mean hello/how are you? 😊": "Najua Kiswahili kidogo! Hilo lina maana ya hello/habari yako? 😊",
      "oh, asante! i think that means thank you, right?": "Oh, ASANTE! Nafikiri hiyo ina maana ya thank you, sawa?",
      "i have heard pole before. does it mean sorry, or is it a way to comfort someone?": "Nimeshawahi kusikia POLE. Ina maana ya samahani, au ni neno la kumfariji mtu?",
      "rafiki! i like that word. it means friend, right?": "RAFIKI! Ninalipenda hilo neno. Lina maana ya friend, sawa?",
      "nice! i hear nzuri and poa a lot. can you teach me another useful word?": "Vizuri! Ninasikia NZURI na POA mara nyingi. Unaweza kunifundisha neno lingine muhimu?",
      "kwaheri? i think you are saying goodbye. but don't leave yet 😄": "KWaheri? Nafikiri unasema goodbye. Lakini usiondoke bado 😄",
      "interesting! tell me more about that.": "Inavutia! Niambie zaidi kuhusu hilo.",
      "i am learning kiswahili, so please correct my words if i make a mistake.": "Najifunza Kiswahili, kwa hiyo tafadhali nirekebishe nikikosea.",
      "that sounds interesting. what would you recommend to someone visiting tanzania?": "Hilo linasikika vizuri. Unampendekezea nini mtu anayekuja kutembelea Tanzania?",
      "really? i did not know that. can you explain it in a simple way?": "Kweli? Sikujua hilo. Unaweza kulieleza kwa njia rahisi?",
      "i like this topic. what is your own experience with it?": "Ninapenda mada hii. Uzoefu wako binafsi kuhusu hilo ukoje?",
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
    return "Ujumbe huu una maana inayohusiana na mazungumzo yetu; gusa tena kubadili kwenda English.";
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

  function finishSession() {
    if (rewardShownRef.current) return;
    rewardShownRef.current = true;
    setTyping(false);
    setSessionEnded(true);
    window.setTimeout(() => {
      toast.success(`🎉 Mfano wa malipo: umefunga session ya ujumbe 20 — TZS ${person.priceTzs.toLocaleString("en-US")}`);
    }, 300);
  }

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sessionEnded) return;

    if (checkingAccess || !activated) {
      setShowPaywall(true);
      return;
    }

    const nextCount = messageCountRef.current + 1;
    messageCountRef.current = nextCount;
    setMessages((m) => [...m, { from: "me", text }]);
    setMessageCount(nextCount);
    setInput("");

    if (nextCount >= 20) {
      finishSession();
      return;
    }

    setTyping(true);
    window.setTimeout(() => {
      const reply = buildAiReply(text);
      setMessages((m) => [...m, { from: "them", text: reply, swahili: translateToSwahili(reply) }]);
      const incomingCount = messageCountRef.current + 1;
      messageCountRef.current = incomingCount;
      setMessageCount(incomingCount);
      if (incomingCount >= 20) {
        finishSession();
      } else {
        setTyping(false);
      }
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
          {person.topic} · AI chat partner · {messageCount}/20 messages
        </p>
        {messages.map((m, i) => {
          const isTranslated = Boolean(translated[i]);
          return (
            <div key={i} className={m.from === "me" ? "flex justify-end" : "flex justify-start"}>
              <div className={m.from === "me" ? "max-w-[82%]" : "max-w-[82%]"}>
                <p
                  className={
                    m.from === "me"
                      ? "rounded-3xl rounded-br-md bg-primary px-4 py-3 text-primary-foreground"
                      : "rounded-3xl rounded-bl-md bg-card px-4 py-3 text-card-foreground shadow-card"
                  }
                >
                  {isTranslated && m.swahili ? m.swahili : m.text}
                </p>
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
