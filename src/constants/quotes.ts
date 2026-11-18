export const GYM_QUOTES = [
  { text: "Consistency beats talent when talent doesn't work hard.", author: "Gym Mantra" },
  { text: "The only bad workout is the one that didn't happen.", author: "L5 Athlete" },
  { text: "Small daily improvements over time lead to stunning results.", author: "Robin Sharma" },
  { text: "Discipline is doing what needs to be done, even if you don't feel like it.", author: "Mindset" },
  { text: "Your body can stand almost anything. It's your mind you have to convince.", author: "Iron Culture" },
  { text: "Strength does not come from winning. Your struggles develop your strengths.", author: "Arnold S." },
  { text: "Focus on the reps today. The transformation takes care of itself.", author: "Coach" },
];

export function getDailyQuote(): { text: string; author: string } {
  // Use day of year so it stays stable throughout the day
  const now = new Date();
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86_400_000);
  return GYM_QUOTES[dayOfYear % GYM_QUOTES.length];
}

