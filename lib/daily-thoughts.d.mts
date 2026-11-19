export type DailyThought = { text: string; author: string };
export const DAILY_THOUGHTS: DailyThought[];
export function getDailyThought(now?: number): DailyThought;
