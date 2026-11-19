export function getClinicReferralContext(
  message: string,
  history?: Array<{ role?: string; content?: string }>,
): { instruction?: string } | null;
