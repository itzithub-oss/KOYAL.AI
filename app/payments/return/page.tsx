"use client";

import { useEffect, useState } from "react";

export default function PaymentReturnPage() {
  const [message, setMessage] = useState("Verifying your payment securely…");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    async function verify() {
      try {
        const orderId = new URLSearchParams(window.location.search).get("order_id");
        const raw = localStorage.getItem("koyal-ai-auth-session");
        const session = raw ? JSON.parse(raw) : null;
        if (!orderId || !session?.access_token || !session?.user?.id) {
          throw new Error("Please log in to the same KOYAL account used for this purchase.");
        }
        const response = await fetch("/api/payments/verify-order", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ orderId }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || "Payment verification failed.");
        if (result.status !== "PAID" || !result.credited) {
          throw new Error("Cashfree has not confirmed this payment yet. Please wait a moment and retry.");
        }
        if (result.plan && result.expiresAt) {
          localStorage.setItem("koyal-ai-subscription-plan", String(result.plan));
          localStorage.setItem("koyal-ai-subscription-expires-at", String(Date.parse(result.expiresAt)));
          if (active) {
            const expiry = new Date(result.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
            setMessage(`${result.plan} plan is now active until ${expiry}. Returning to KOYAL AI…`);
            window.setTimeout(() => { window.location.replace("/"); }, 2200);
          }
          return;
        }
        const walletResponse = await fetch("/api/payments/wallet", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const wallet = await walletResponse.json().catch(() => ({}));
        if (walletResponse.ok && Number.isFinite(Number(wallet.balance))) {
          localStorage.setItem("koyal-ai-feather-balance:" + session.user.id, String(wallet.balance));
        }
        if (active) {
          setMessage(`${Number(result.quantity).toLocaleString("en-IN")} feathers have been added to your KOYAL wallet. Returning to KOYAL AI…`);
          window.setTimeout(() => { window.location.replace("/"); }, 1800);
        }
      } catch (error) {
        if (active) {
          setFailed(true);
          setMessage(error instanceof Error ? error.message : "Could not verify this payment.");
        }
      }
    }
    void verify();
    return () => { active = false; };
  }, []);

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#09090f", color: "#fff", fontFamily: "system-ui,sans-serif" }}>
      <section style={{ width: "min(100%,480px)", padding: 28, border: "1px solid rgba(255,71,109,.4)", borderRadius: 20, background: "#15111b", textAlign: "center" }}>
        <img src="/koyal-bird.png" alt="KOYAL AI" style={{ width: 76, height: 76, objectFit: "contain" }} />
        <h1 style={{ margin: "12px 0", fontSize: 24 }}>KOYAL AI Payment</h1>
        <p role="status" style={{ color: failed ? "#ff9bac" : "#ddd", lineHeight: 1.6 }}>{message}</p>
        {failed && <a href="/" style={{ display: "inline-block", marginTop: 12, color: "#ff8199" }}>Return to KOYAL AI</a>}
      </section>
    </main>
  );
}
