import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, CalendarDays, Languages, SendHorizonal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

import { PaywallDialog } from "@/components/paywall-dialog";
import { getForeigner } from "@/lib/foreigners";
import { getChatSession, saveChatSession, type StoredChatMessage } from "@/lib/chat-sessions";

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
  // Exact translations for every generated chat reply keep the translation
  // natural and complete, including mixed English/Kiswahili messages.
  const exact: Record<string, string> = {
    "Hi! Habari yako? 😊": "Habari yako? 😊",
    "Hola! Mambo vipi? 👋": "Habari! Mambo vipi? 👋",
    "Good evening! Karibu 🙌": "Habari za jioni! Karibu 🙌",
    "Konnichiwa! Habari za jioni 🍜": "Habari! Habari za jioni 🍜",
    "Salut! Shikamoo 😄": "Habari! Shikamoo 😄",
    "Oi! Vipi rafiki ⚽": "Habari! Vipi rafiki? ⚽",
    "Hallo! Habari ya kazi? 📚": "Habari! Habari ya kazi? 📚",
    "Hey there! Mambo 👋": "Habari! Mambo? 👋",
    "I know a little Kiswahili! Does that mean hello/how are you? 😊": "Najua Kiswahili kidogo! Hilo lina maana ya hello/habari yako? 😊",
    "Oh, ASANTE! I think that means thank you, right?": "Oh, ASANTE! Nafikiri hiyo ina maana ya asante, sawa?",
    "I have heard POLE before. Does it mean sorry, or is it a way to comfort someone?": "Nimeshawahi kusikia POLE. Ina maana ya samahani, au ni neno la kumfariji mtu?",
    "RAFIKI! I like that word. It means friend, right?": "RAFIKI! Ninalipenda hilo neno. Lina maana ya rafiki, sawa?",
    "Oh, KARIBU! What does that mean? Is it like saying welcome?": "Oh, KARIBU! Hilo lina maana gani? Ni kama kusema karibu?",
    "Oh, KARIBU! 😄 I think that means welcome, right? What other Swahili word should I learn?": "Oh, KARIBU! 😄 Nafikiri hiyo ina maana ya karibu, sawa? Ni neno gani lingine la Kiswahili nijifunze?",
    "Ah, HABARI! 😊 I think you are asking how I am. Niko vizuri? Did I say that correctly?": "Ah, HABARI! 😊 Nafikiri unauliza hali yangu. Niko vizuri? Nimesema kwa usahihi?",
    "Oh, ASANTE! I know this one means thank you 😄. Am I getting better at Kiswahili?": "Oh, ASANTE! Najua hili lina maana ya asante 😄. Je, naendelea kuboresha Kiswahili changu?",
    "RAFIKI! I like that word 😄. It means friend, right? Naweza kusema hivyo to a new friend?": "RAFIKI! Ninalipenda hilo neno 😄. Lina maana ya rafiki, sawa? Naweza kusema hivyo kwa rafiki mpya?",
    "Nice! NZURI and POA sound useful. 😄 Can you teach me one more word leo?": "Nzuri! NZURI na POA yanaonekana kuwa maneno muhimu. 😄 Unaweza kunifundisha neno moja zaidi leo?",
    "Kwaheri? I think that means goodbye. But don't leave yet 😄, bado tunaongea!": "Kwaheri? Nafikiri hiyo ina maana ya kuaga. Lakini usiondoke bado 😄, bado tunaongea!",
    "You mentioned Simba/Yanga! I know they are big football names in Tanzania. Which one do you support, rafiki?": "Umetaja Simba/Yanga! Najua ni majina makubwa kwenye mpira Tanzania. Unaunga mkono timu gani, rafiki?",
    "Tanzania sounds amazing! Ningependa kutembelea one day. What place should I visit first?": "Tanzania inasikika vizuri sana! Ningependa kutembelea siku moja. Ni sehemu gani nitembelee kwanza?",
    "I love talking about food 😄. Chakula gani should I try first when I visit Tanzania?": "Napenda kuzungumzia chakula 😄. Ni chakula gani nijaribu kwanza nikitembelea Tanzania?",
    "I enjoy Bongo Flava! 🎵 Ni msanii gani should I add to my playlist?": "Napenda Bongo Flava! 🎵 Ni msanii gani nimwongeze kwenye playlist yangu?",
    "I keep hearing about mobile money in Tanzania. Inatumika kila mahali, or only in cities?": "Ninaendelea kusikia kuhusu mobile money Tanzania. Inatumika kila mahali, au mijini tu?",
    "Good question 😄. Tell me the Kiswahili word and I will try to explain it. Pole if my Swahili is not perfect!": "Swali zuri 😄. Niambie neno la Kiswahili nami nitajaribu kulieleza. Pole kama Kiswahili changu si kizuri kabisa!",
    "Interesting! Tell me more about that, rafiki. 😊": "Inavutia! Niambie zaidi kuhusu hilo, rafiki. 😊",
    "I am still learning Kiswahili, so please correct me nikikosea.": "Bado najifunza Kiswahili, kwa hiyo tafadhali nirekebishe nikikosea.",
    "That sounds interesting. What would you recommend for a visitor to Tanzania?": "Hilo linasikika vizuri. Ungependekeza nini kwa mgeni anayekuja Tanzania?",
    "Really? Sikujua hilo 😄. Can you explain a little more?": "Kweli? Sikujua hilo 😄. Unaweza kueleza zaidi kidogo?",
    "I like this topic! We can practise Kiswahili together, sawa?": "Ninalipenda hili somo! Tunaweza kufanya mazoezi ya Kiswahili pamoja, sawa?",
    "Okay, I understand a little. Unaweza kunifundisha the natural way to say it?": "Sawa, nimeelewa kidogo. Unaweza kunifundisha jinsi ya kusema hivyo kwa kawaida?",
    "Haha, nice! I am learning slowly lakini I am enjoying it. 😄": "Haha, vizuri! Najifunza polepole lakini ninafurahia. 😄",
    "That makes sense. Asante for teaching me — what should I learn next?": "Hilo linaeleweka. Asante kwa kunifundisha — nijifunze nini kinachofuata?",
  };
  if (exact[text]) return exact[text];

  // This is an in-app phrase translator for the demo chat. It translates
  // mixed English/Swahili messages by phrase first, then by common words,
  // while keeping names, emojis and Swahili words that need no translation.
  const phraseMap: Array<[RegExp, string]> = [
    [/\bi'?m still learning kiswahili\b/gi, "bado najifunza Kiswahili"],
    [/\bi am still learning swahili\b/gi, "bado najifunza Kiswahili"],
    [/\bi'?m learning kiswahili\b/gi, "najifunza Kiswahili"],
    [/\bi need a patient partner\b/gi, "nahitaji mtu mwenye subira wa kufanya naye mazoezi"],
    [/\bwhat does that mean\b/gi, "hilo lina maana gani"],
    [/\bwhat does (?:this|that) word mean\b/gi, "hilo neno lina maana gani"],
    [/\bis it like saying welcome\b/gi, "ni kama kusema karibu"],
    [/\bi think that means thank you\b/gi, "nafikiri hiyo ina maana ya asante"],
    [/\bdoes it mean sorry\b/gi, "ina maana ya samahani"],
    [/\bhow are you doing today\b/gi, "unaendeleaje leo"],
    [/\bhow are you\b/gi, "habari yako"],
    [/\btell me more about that\b/gi, "niambie zaidi kuhusu hilo"],
    [/\bcan you help me\b/gi, "unaweza kunisaidia"],
    [/\bcan you teach me\b/gi, "unaweza kunifundisha"],
    [/\bplease be honest with me\b/gi, "tafadhali niambie ukweli"],
    [/\bwhat should i eat first\b/gi, "nile nini kwanza"],
    [/\bwhen i arrive in tanzania\b/gi, "nikifika Tanzania"],
    [/\bwhen i arrive\b/gi, "nikifika"],
    [/\bwhat would you recommend\b/gi, "ungependekeza nini"],
    [/\bwhat do you recommend\b/gi, "unapendekeza nini"],
    [/\bwhat is your experience\b/gi, "uzoefu wako ni upi"],
    [/\bwhich one do you support\b/gi, "unaunga mkono ipi"],
    [/\bwhich artist should i add\b/gi, "nimwongeze msanii gani"],
    [/\bcan you explain it\b/gi, "unaweza kueleza"],
    [/\bin a simple way\b/gi, "kwa njia rahisi"],
    [/\bi did not know that\b/gi, "sikujua hilo"],
    [/\bi like this topic\b/gi, "ninalipenda hili somo"],
    [/\btell me more\b/gi, "niambie zaidi"],
    [/\bwhat does .* mean\b/gi, "hilo lina maana gani"],
  ];

  const wordMap: Record<string, string> = {
    hi: "habari",
    hello: "habari",
    hey: "hey",
    good: "nzuri",
    evening: "jioni",
    morning: "asubuhi",
    today: "leo",
    tomorrow: "kesho",
    friend: "rafiki",
    friends: "marafiki",
    welcome: "karibu",
    thank: "shukuru",
    thanks: "asante",
    thankyou: "asante",
    sorry: "samahani",
    please: "tafadhali",
    yes: "ndiyo",
    no: "hapana",
    fine: "vizuri",
    great: "vizuri sana",
    nice: "nzuri",
    interesting: "inavutia",
    really: "kweli",
    know: "jua",
    learn: "jifunza",
    learning: "kujifunza",
    teach: "fundisha",
    help: "saidia",
    what: "nini",
    where: "wapi",
    when: "lini",
    why: "kwa nini",
    how: "vipi",
    means: "inamaanisha",
    mean: "maanisha",
    word: "neno",
    words: "maneno",
    today: "leo",
    tomorrow: "kesho",
    tanzania: "Tanzania",
    zanzibar: "Zanzibar",
    football: "mpira wa miguu",
    music: "muziki",
    food: "chakula",
    water: "maji",
  };

  let result = text;
  for (const [pattern, replacement] of phraseMap) result = result.replace(pattern, replacement);

  // Translate common standalone English words after phrase translation.
  result = result.replace(/\b[A-Za-z']+\b/g, (word) => {
    const key = word.toLowerCase().replace(/['’]/g, "");
    return wordMap[key] ?? word;
  });

  const punctuation = result.trim();
  if (!punctuation) return text;
  return punctuation;
}

function buildAiReply(text: string) {
  const normalized = text.toLowerCase().trim();

  // Replies intentionally mix English with simple Kiswahili, like a foreign
  // learner who knows a few words but is still practising.
  if (/\bkaribu\b/i.test(normalized)) return "Oh, KARIBU! 😄 I think that means welcome, right? What other Swahili word should I learn?";
  if (/\b(habari|mambo|hujambo|niaje)\b/i.test(normalized)) return "Ah, HABARI! 😊 I think you are asking how I am. Niko vizuri? Did I say that correctly?";
  if (/\b(asante|shukrani)\b/i.test(normalized)) return "Oh, ASANTE! I know this one means thank you 😄. Am I getting better at Kiswahili?";
  if (/\bpole\b/i.test(normalized)) return "I have heard POLE before. Does it mean sorry, or is it used to comfort someone?";
  if (/\b(rafiki|marafiki)\b/i.test(normalized)) return "RAFIKI! I like that word 😄. It means friend, right? Naweza kusema hivyo to a new friend?";
  if (/\b(nzuri|vizuri|poa)\b/i.test(normalized)) return "Nice! NZURI and POA sound useful. 😄 Can you teach me one more word leo?";
  if (/\b(kwaheri|tutaonana)\b/i.test(normalized)) return "Kwaheri? I think that means goodbye. But don't leave yet 😄, bado tunaongea!";
  if (/\b(simba|yanga)\b/i.test(normalized)) return "You mentioned Simba/Yanga! I know they are big football names in Tanzania. Which one do you support, rafiki?";
  if (/\b(tanzania|dar|arusha|mwanza|mbeya|zanzibar)\b/i.test(normalized)) return "Tanzania sounds amazing! Ningependa kutembelea one day. What place should I visit first?";
  if (/\b(chakula|food|pilau|wali|nyama)\b/i.test(normalized)) return "I love talking about food 😄. Chakula gani should I try first when I visit Tanzania?";
  if (/\b(music|muziki|bongo|artist|msanii)\b/i.test(normalized)) return "I enjoy Bongo Flava! 🎵 Ni msanii gani should I add to my playlist?";
  if (/\b(mobile money|mpesa|m-pesa|airtel money)\b/i.test(normalized)) return "I keep hearing about mobile money in Tanzania. Inatumika kila mahali, or only in cities?";
  if (/\b(what does|meaning|maana)\b/i.test(normalized)) return "Good question 😄. Tell me the Kiswahili word and I will try to explain it. Pole if my Swahili is not perfect!";

  const replies = [
    "Interesting! Tell me more about that, rafiki. 😊",
    "I am still learning Kiswahili, so please correct me nikikosea.",
    "That sounds interesting. What would you recommend for a visitor to Tanzania?",
    "Really? Sikujua hilo 😄. Can you explain a little more?",
    "I like this topic! We can practise Kiswahili together, sawa?",
    "Okay, I understand a little. Unaweza kunifundisha the natural way to say it?",
    "Haha, nice! I am learning slowly lakini I am enjoying it. 😄",
    "That makes sense. Asante for teaching me — what should I learn next?",
  ];
  return replies[Math.floor(Math.random() * replies.length)];
}

function ChatPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
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
  const [userId, setUserId] = useState("");
  const messageCountRef = useRef(0);
  const messagesRef = useRef<Msg[]>([]);
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
        setUserId(data.user.id);
        const { data: profile } = await supabase
          .from("profiles")
          .select("activated, banned, ban_reason")
          .eq("id", data.user.id)
          .maybeSingle();
        if (profile?.banned) {
          await supabase.auth.signOut();
          if (active) navigate({ to: "/login", search: {} });
          return;
        }
        if (active) {
          setActivated(Boolean(profile?.activated));
          const saved = getChatSession(data.user.id, person.id);
          if (saved) {
            sessionIdRef.current = saved.sessionId;
            messagesRef.current = saved.messages as Msg[];
            setMessages(saved.messages as Msg[]);
            messageCountRef.current = saved.messages.length;
            setMessageCount(saved.messages.length);
            setSessionEnded(saved.ended);
            setTyping(false);
          }
        }
      }
      if (active) setCheckingAccess(false);
    })();
    return () => { active = false; };
  }, [navigate, person.id]);

  useEffect(() => {
    if (checkingAccess || activated) return;
    const timer = window.setInterval(async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("activated, banned")
        .eq("id", data.user.id)
        .maybeSingle();
      if (profile?.banned) {
        await supabase.auth.signOut();
        navigate({ to: "/login", search: {} });
        return;
      }
      if (profile?.activated) setActivated(true);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [checkingAccess, activated]);

  // Start a fresh chat only when the user has no saved session for this foreigner.
  useEffect(() => {
    if (!userId) return;
    const saved = getChatSession(userId, person.id);
    if (saved) return;
    const timer = window.setTimeout(() => {
      const first = person.opening[0] ?? "Hi! How are you? 😊";
      const initial: Msg = { from: "them", text: first, swahili: translateToSwahili(first), time: nowTime() };
      const session = { sessionId: sessionIdRef.current, foreignerId: person.id, messages: [initial], ended: false, updatedAt: new Date().toISOString() };
      messagesRef.current = [initial];
      setMessages([initial]);
      messageCountRef.current = 1;
      setMessageCount(1);
      setTyping(false);
      saveChatSession(userId, session);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [userId, person.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, typing]);

  async function finishSession() {
    if (rewardShownRef.current) return;
    rewardShownRef.current = true;
    setTyping(false);
    if (userId) {
      saveChatSession(userId, {
        sessionId: sessionIdRef.current,
        foreignerId: person.id,
        messages: messagesRef.current as StoredChatMessage[],
        ended: true,
        updatedAt: new Date().toISOString(),
      });
    }
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
    toast.success(`Chat imekamilika. Reward ya TZS ${reward.toLocaleString("en-US")} imeongezwa kwenye Current Balance.`);
  }

  function persistMessages(next: Msg[], ended = false) {
    if (!userId) return;
    saveChatSession(userId, {
      sessionId: sessionIdRef.current,
      foreignerId: person.id,
      messages: next as StoredChatMessage[],
      ended,
      updatedAt: new Date().toISOString(),
    });
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
    const nextMessages = [...messages, { from: "me" as const, text, time: nowTime() }];
    messageCountRef.current = nextCount;
    setMessages(nextMessages);
    setMessageCount(nextCount);
    setInput("");

    if (nextCount >= 10) {
      messagesRef.current = nextMessages;
      void finishSession();
      return;
    }

    persistMessages(nextMessages);
    setTyping(true);
    window.setTimeout(() => {
      const reply = buildAiReply(text);
      const incomingCount = messageCountRef.current + 1;
      const incoming: Msg = { from: "them", text: reply, swahili: translateToSwahili(reply), time: nowTime() };
      const withReply = [...nextMessages, incoming];
      messageCountRef.current = incomingCount;
      setMessages(withReply);
      setMessageCount(incomingCount);
      messagesRef.current = withReply;
      if (incomingCount >= 10) {
        persistMessages(withReply, true);
        void finishSession();
      } else {
        persistMessages(withReply);
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
          <span>September 14 · {person.topic}</span>
        </div>

        <div className="mb-5 rounded-3xl bg-primary px-5 py-5 text-center text-primary-foreground shadow-brand">
          <p className="text-sm font-medium opacity-90">You are chatting with {person.name} for {person.minutes} minutes.</p>
          <p className="mt-1 text-lg font-extrabold">Chat session reward: TZS {person.priceTzs.toLocaleString("en-US")}</p>
          <p className="mt-1 text-xs opacity-80">AI chat partner</p>
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
