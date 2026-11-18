export type KoyalAuthMode = "login" | "signup" | "reset";
export interface KoyalCredentialInput { email: string; password: string; phone?: string; mode: KoyalAuthMode; }
export function validateKoyalCredentials(input: KoyalCredentialInput): string;
