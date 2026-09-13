export type Foreigner = {
  id: string;
  name: string;
  flag: string;
  country: string;
  avatar: string;
  rating: number;
  minutes: number;
  topic: string;
  priceTzs: number;
  opening: string[];
};

const rawPeople: Omit<Foreigner, "id" | "priceTzs">[] = [
  {
    name: "Isabella",
    flag: "🇰🇷",
    country: "South Korea",
    avatar: "https://randomuser.me/api/portraits/women/68.jpg",
    rating: 4.9,
    minutes: 45,
    topic: "Fitness & Lifestyle Chat",
    opening: [
      "Hi! Habari yako? 😊",
      "I am Isabella from Seoul. I am learning Kiswahili and I need a patient partner.",
      "Do you go to the gym in the morning or evening?",
    ],
  },
  {
    name: "Mateo",
    flag: "🇪🇸",
    country: "Spain",
    avatar: "https://randomuser.me/api/portraits/men/32.jpg",
    rating: 4.8,
    minutes: 30,
    topic: "Travel & Culture Chat",
    opening: [
      "Hola! Mambo vipi? 👋",
      "I'm Mateo from Valencia. Next year I want to visit Zanzibar.",
      "Tell me, what should I eat first when I arrive in Tanzania?",
    ],
  },
  {
    name: "Amelia",
    flag: "🇬🇧",
    country: "United Kingdom",
    avatar: "https://randomuser.me/api/portraits/women/44.jpg",
    rating: 5.0,
    minutes: 60,
    topic: "Business English Chat",
    opening: [
      "Good evening! Karibu 🙌",
      "I'm Amelia, I run a small import business in Manchester.",
      "I would love to learn simple Kiswahili greetings for my suppliers. Can you teach me?",
    ],
  },
  {
    name: "Kenji",
    flag: "🇯🇵",
    country: "Japan",
    avatar: "https://randomuser.me/api/portraits/men/75.jpg",
    rating: 4.7,
    minutes: 40,
    topic: "Food & Cooking Chat",
    opening: [
      "Konnichiwa! Habari za jioni 🍜",
      "I am Kenji from Osaka. I cook every weekend for my family.",
      "How do you prepare pilau? I really want to try it.",
    ],
  },
  {
    name: "Sophie",
    flag: "🇫🇷",
    country: "France",
    avatar: "https://randomuser.me/api/portraits/women/12.jpg",
    rating: 4.9,
    minutes: 35,
    topic: "Music & Movies Chat",
    opening: [
      "Salut! Shikamoo 😄",
      "Sophie here, from Lyon. I listen to Bongo Flava every single day.",
      "Which artist should I add to my playlist this week?",
    ],
  },
  {
    name: "Lucas",
    flag: "🇧🇷",
    country: "Brazil",
    avatar: "https://randomuser.me/api/portraits/men/22.jpg",
    rating: 4.8,
    minutes: 50,
    topic: "Football & Sports Chat",
    opening: [
      "Oi! Vipi rafiki ⚽",
      "I'm Lucas from São Paulo, football is my life.",
      "Simba or Yanga? Please be honest with me 😂",
    ],
  },
  {
    name: "Emma",
    flag: "🇩🇪",
    country: "Germany",
    avatar: "https://randomuser.me/api/portraits/women/90.jpg",
    rating: 4.6,
    minutes: 25,
    topic: "Study & Career Chat",
    opening: [
      "Hallo! Habari ya kazi? 📚",
      "I am Emma, a student in Berlin studying African languages.",
      "Can you help me practise five useful Kiswahili sentences today?",
    ],
  },
  {
    name: "Daniel",
    flag: "🇺🇸",
    country: "United States",
    avatar: "https://randomuser.me/api/portraits/men/54.jpg",
    rating: 4.9,
    minutes: 45,
    topic: "Tech & Business Chat",
    opening: [
      "Hey there! Mambo 👋",
      "Daniel from Austin, Texas. I work with a startup team.",
      "Is mobile money really used everywhere in Tanzania?",
    ],
  },
];

export const foreigners: Foreigner[] = rawPeople.map((p, i) => ({
  ...p,
  id: p.name.toLowerCase(),
  priceTzs: 1200 * p.minutes + (i % 3) * 1000,
}));

export function getForeigner(id: string): Foreigner | undefined {
  return foreigners.find((f) => f.id === id);
}

export function shuffleForeigners(seed: number): Foreigner[] {
  const list = [...foreigners];
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor((Math.sin(seed + i) + 1) / 2 * (i + 1));
    const a = list[i]!;
    const b = list[j]!;
    list[i] = b;
    list[j] = a;
  }
  return list;
}

export function formatTzs(amount: number): string {
  return `TZS ${amount.toLocaleString("en-US")}`;
}

export function usdEquivalent(amount: number): string {
  return `≈ USD ${(amount / 2500).toFixed(2)}`;
}

export const nextDates = [
  "September 13",
  "September 14",
  "September 15",
  "September 16",
];
