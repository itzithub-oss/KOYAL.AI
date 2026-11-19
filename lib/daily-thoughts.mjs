export const DAILY_THOUGHTS = [
  { text: "Small steps taken consistently can carry you farther than one perfect day.", author: "KOYAL" },
  { text: "Your future is shaped by what you choose to practise today.", author: "KOYAL" },
  { text: "Curiosity turns ordinary moments into opportunities to learn.", author: "KOYAL" },
  { text: "Progress is not always loud; sometimes it is simply showing up again.", author: "KOYAL" },
  { text: "A focused hour can be more valuable than a distracted afternoon.", author: "KOYAL" },
  { text: "You do not need to know every step to take the next right one.", author: "KOYAL" },
  { text: "Let mistakes teach you; do not let them define you.", author: "KOYAL" },
  { text: "The way to build confidence is to keep the promises you make to yourself.", author: "KOYAL" },
  { text: "Make room for both ambition and rest. Both help you grow.", author: "KOYAL" },
  { text: "A good question is often the beginning of a better answer.", author: "KOYAL" },
  { text: "Be patient with the process, but honest about the effort.", author: "KOYAL" },
  { text: "What you learn becomes powerful when you put it into practice.", author: "KOYAL" },
];
const THREE_HOURS_MS = 3 * 60 * 60 * 1000;
export function getDailyThought(now = Date.now()) {
  const timestamp = Number.isFinite(now) ? Math.max(0, now) : Date.now();
  const slot = Math.floor(timestamp / THREE_HOURS_MS);
  return DAILY_THOUGHTS[slot % DAILY_THOUGHTS.length];
}
