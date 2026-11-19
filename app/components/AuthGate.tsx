"use client";

import { useEffect, useState } from "react";
import type { CSSProperties, FormEvent, ReactNode } from "react";
import { validateKoyalCredentials } from "../../lib/koyal-auth.mjs";

type AuthSession = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: { id: string; email?: string; user_metadata?: { phone?: string } };
};

const SESSION_KEY = "koyal-ai-auth-session";

export default function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [guest, setGuest] = useState(false);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<"login" | "signup" | "reset">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  function saveSession(value: AuthSession | null) {
    setSession(value);
    try {
      if (value) localStorage.setItem(SESSION_KEY, JSON.stringify(value));
      else localStorage.removeItem(SESSION_KEY);
    } catch {
      setError("Your browser could not save the login session. Please allow site storage.");
    }
  }

  async function authRequest(path: string, body?: Record<string, unknown>, token?: string) {
    if (!url || !key) throw new Error("Supabase is not configured. Add the project URL and publishable key to Vercel and .env.local.");
    const response = await fetch(`${url}/auth/v1/${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: key,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = typeof data.msg === "string" ? data.msg : typeof data.message === "string" ? data.message : typeof data.error_description === "string" ? data.error_description : "Authentication failed. Please try again.";
      throw new Error(message);
    }
    return data;
  }

  useEffect(() => {
    let active = true;
    async function restore() {
      try {
        const raw = localStorage.getItem(SESSION_KEY);
        if (!raw) {
          // Guest mode is the default: sign-in is optional, not an app-wide gate.
          if (active) setGuest(true);
          localStorage.setItem("koyal-ai-guest-mode", "true");
          return;
        }
        const stored = JSON.parse(raw) as AuthSession;
        if (!stored.refresh_token || !stored.access_token) {
          localStorage.removeItem(SESSION_KEY);
          return;
        }
        if (stored.expires_at > Math.floor(Date.now() / 1000) + 60) {
          if (active) setSession(stored);
          return;
        }
        const refreshed = await authRequest("token?grant_type=refresh_token", { refresh_token: stored.refresh_token });
        const next: AuthSession = { ...refreshed, expires_at: Math.floor(Date.now() / 1000) + Number(refreshed.expires_in || 3600) };
        if (active) saveSession(next);
      } catch {
        localStorage.removeItem(SESSION_KEY);
        if (active) setGuest(true);
        localStorage.setItem("koyal-ai-guest-mode", "true");
      } finally {
        if (active) setReady(true);
      }
    }
    restore();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!session?.refresh_token) return;
    const delay = Math.max(1000, (session.expires_at - Math.floor(Date.now() / 1000) - 60) * 1000);
    const timer = window.setTimeout(async () => {
      try {
        const refreshed = await authRequest("token?grant_type=refresh_token", { refresh_token: session.refresh_token });
        saveSession({ ...refreshed, expires_at: Math.floor(Date.now() / 1000) + Number(refreshed.expires_in || 3600) });
      } catch {
        saveSession(null);
        setError("Your session expired. Please log in again.");
      }
    }, delay);
    return () => window.clearTimeout(timer);
  }, [session?.refresh_token, session?.expires_at]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    const validation = validateKoyalCredentials({ email, password, phone, mode });
    if (validation) { setError(validation); return; }
    setBusy(true);
    try {
      if (mode === "reset") {
        await authRequest(`recover?redirect_to=${encodeURIComponent(window.location.origin)}`, { email: email.trim() });
        setNotice("If this email has an account, Supabase will send a password-reset link.");
      } else if (mode === "signup") {
        const result = await authRequest("signup", {
          email: email.trim(),
          password,
          data: phone.trim() ? { phone: phone.trim() } : {},
        });
        if (result.access_token && result.refresh_token) {
          saveSession({ ...result, expires_at: Math.floor(Date.now() / 1000) + Number(result.expires_in || 3600) });
        } else {
          setNotice("Account created. Check your email to confirm your address, then come back and log in.");
          setMode("login");
          setPassword("");
        }
      } else {
        const result = await authRequest("token?grant_type=password", { email: email.trim(), password });
        saveSession({ ...result, expires_at: Math.floor(Date.now() / 1000) + Number(result.expires_in || 3600) });
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not complete authentication.");
    } finally {
      setBusy(false);
    }
  }

  function clearAccountProfileData() {
    for (const key of [
      "koyal-ai-profile-v2",
      "koyal-ai-profile-name",
      "koyal-ai-profile",
      "koyal-ai-subscription-plan",
      "koyal-ai-subscription-expires-at",
      "koyal-ai-feather-balance",
    ]) localStorage.removeItem(key);
    window.dispatchEvent(new Event("koyal-account-signed-out"));
  }

  async function signOut() {
    const current = session;
    clearAccountProfileData();
    saveSession(null);
    localStorage.setItem("koyal-ai-guest-mode", "true");
    setGuest(true);
    if (current?.access_token && url && key) {
      try {
        await fetch(`${url}/auth/v1/logout`, {
          method: "POST",
          headers: { apikey: key, Authorization: `Bearer ${current.access_token}` },
        });
      } catch {
        // The local session is already cleared; server-side token expiry remains in effect.
      }
    }
  }

  if (!ready) return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#09090f", color: "white" }}>Loading KOYAL account…</div>;

  if (session) {
    return <>
      {children}
      <div style={{ position: "fixed", zIndex: 120, top: 12, right: 14, display: "flex", alignItems: "center", gap: 9, maxWidth: "min(92vw, 360px)", padding: "7px 10px", borderRadius: 999, border: "1px solid rgba(255,71,109,.38)", background: "rgba(12,12,19,.92)", color: "#fff", font: "12px system-ui", boxShadow: "0 4px 24px #0005" }}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{session.user?.email || "Signed in"}</span>
        <button type="button" onClick={signOut} style={{ border: 0, borderRadius: 999, padding: "6px 10px", background: "#ff476d", color: "white", fontWeight: 700, cursor: "pointer" }}>Sign out</button>
      </div>
    </>;
  }

  if (guest) return <>
    {children}
    <button type="button" onClick={() => { localStorage.removeItem("koyal-ai-guest-mode"); setGuest(false); }} style={{ position: "fixed", zIndex: 121, top: 12, right: 14, border: "1px solid rgba(255,71,109,.5)", borderRadius: 999, padding: "9px 13px", background: "rgba(12,12,19,.94)", color: "#fff", font: "12px system-ui", cursor: "pointer" }}>Log in / Sync account</button>
  </>;

  const heading = mode === "signup" ? "Create your KOYAL account" : mode === "reset" ? "Reset your password" : "Welcome back";
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20, background: "radial-gradient(ellipse at top, #35101d 0%, #120d16 42%, #08080d 100%)", color: "#fff", fontFamily: "system-ui, sans-serif" }}>
      <section style={{ width: "100%", maxWidth: 420, padding: 28, borderRadius: 24, border: "1px solid rgba(255,71,109,.35)", background: "rgba(17,15,24,.94)", boxShadow: "0 24px 80px #0008" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <img src="/koyal-bird.png" alt="KOYAL" style={{ width: 76, height: 76, objectFit: "contain" }} />
          <div style={{ fontSize: 25, fontWeight: 850, letterSpacing: 2 }}>KOYAL <span style={{ color: "#ff476d" }}>AI</span></div>
          <p style={{ margin: "7px 0 0", color: "#b9aeb8", fontSize: 13 }}>{heading}</p>
        </div>
        <form onSubmit={submit} style={{ display: "grid", gap: 13 }}>
          <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#e8dfe5" }}>Email address
            <input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" style={fieldStyle} />
          </label>
          {mode !== "reset" && <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#e8dfe5" }}>Password
            <input type="password" required minLength={6} autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" style={fieldStyle} />
          </label>}
          {mode === "signup" && <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#e8dfe5" }}>Phone number <span style={{ color: "#a99da8", fontWeight: 400 }}>(optional — no OTP or SMS)</span>
            <input type="tel" autoComplete="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 98765 43210 (optional)" style={fieldStyle} />
          </label>}
          {error && <p role="alert" style={{ margin: 0, color: "#ff8ca2", fontSize: 13 }}>{error}</p>}
          {notice && <p role="status" style={{ margin: 0, color: "#9be2b2", fontSize: 13 }}>{notice}</p>}
          <button disabled={busy} type="submit" style={{ marginTop: 4, padding: 13, border: 0, borderRadius: 12, background: "linear-gradient(110deg,#ff365f,#bd1747)", color: "white", fontWeight: 800, cursor: busy ? "wait" : "pointer", opacity: busy ? .7 : 1 }}>{busy ? "Please wait…" : mode === "signup" ? "Create account" : mode === "reset" ? "Send reset link" : "Log in"}</button>
        </form>
        <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 12, marginTop: 18, fontSize: 12 }}>
          {mode !== "login" && <button type="button" onClick={() => { setMode("login"); setError(""); setNotice(""); }} style={linkStyle}>Log in</button>}
          {mode !== "signup" && <button type="button" onClick={() => { setMode("signup"); setError(""); setNotice(""); }} style={linkStyle}>Create account</button>}
          {mode === "login" && <button type="button" onClick={() => { setMode("reset"); setError(""); setNotice(""); }} style={linkStyle}>Forgot password?</button>}
        </div>
        <button type="button" onClick={() => { localStorage.setItem("koyal-ai-guest-mode", "true"); setGuest(true); }} style={{ width: "100%", marginTop: 14, padding: 12, border: "1px solid #51404b", borderRadius: 12, background: "transparent", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Continue without login</button>
        <p style={{ margin: "20px 0 0", color: "#9b909b", fontSize: 11, lineHeight: 1.5, textAlign: "center" }}>Your password is handled by Supabase Authentication. Never share your password or API keys. Phone number is optional and is not verified. Guest mode keeps your data on this device.</p>
      </section>
    </main>
  );
}

const fieldStyle: CSSProperties = { width: "100%", boxSizing: "border-box", padding: "12px 13px", borderRadius: 11, border: "1px solid #51404b", outline: "none", background: "#100e16", color: "#fff", font: "inherit" };
const linkStyle: CSSProperties = { border: 0, background: "transparent", color: "#ff7e98", cursor: "pointer", padding: 4, font: "inherit" };
