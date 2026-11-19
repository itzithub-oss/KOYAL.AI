export function getFindUpSupabaseConfig(): { url: string; key: string };
export function findUpDatabase(path: string, options?: RequestInit): Promise<any>;
export function requireFindUpAdmin(request: Request): Promise<{ ok: true; user: { id: string; email: string } } | { ok: false; status: number; error: string }>;
