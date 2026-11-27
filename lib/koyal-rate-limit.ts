import { createHash } from "node:crypto";
import { supabaseRequest } from "@/lib/cashfree-server";

/** Atomic server-side rate limit. Raw identifiers are never stored. */
export async function consumeKoyalRateLimit(key: string, limit: number, windowSeconds: number) {
  const bucketKey = createHash("sha256").update(key).digest("hex");
  const allowed = await supabaseRequest("rpc/consume_koyal_rate_limit", {
    method: "POST",
    body: JSON.stringify({ p_bucket_key: bucketKey, p_limit: limit, p_window_seconds: windowSeconds }),
  });
  return allowed === true;
}
