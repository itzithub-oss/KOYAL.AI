export interface FindUpBusiness { [key: string]: any; id: string; business_id: string; business_name: string; display_name?: string; category: string; status: string; services?: unknown[]; location?: Record<string, unknown>; pricing?: Record<string, unknown>; }
export function normaliseFindUpQuery(value: unknown): string;
export function inferFindUpQuery(value: unknown): { category: string; location: string; budget: number | null; terms: string[] };
export function rankFindUpBusinesses(businesses: FindUpBusiness[], query: string, filters?: { location?: string; category?: string; maxPrice?: string | number }): (FindUpBusiness & { _score: number; _matchReason: string; _matchedTerms: string[]; _startingPrice: number | null })[];
export function validateFindUpApplication(input: unknown): string[];
