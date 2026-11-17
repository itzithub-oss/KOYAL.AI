export type KoyalWebSource = { title: string; url: string };
export function extractWebSources(metadata: unknown): KoyalWebSource[];
