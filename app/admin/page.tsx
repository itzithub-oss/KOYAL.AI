"use client";

import { useEffect, useMemo, useState } from "react";

const ADMIN_EMAIL = "koyalaiindia@gmail.com";
const SECURITY_QUESTIONS = [
  "What is your best friend's name?",
  "What is your mother's name?",
  "What is the name of your school?",
  "What was your childhood nickname?",
  "What is the name of your first teacher?",
];
const MODULES = [
  { id: "overview", label: "Overview", icon: "▦" },
  { id: "users", label: "User Management", icon: "♙" },
  { id: "payments", label: "Payments", icon: "₹" },
  { id: "subscriptions", label: "Subscriptions", icon: "♛" },
  { id: "coupons", label: "Coupons", icon: "▤" },
  { id: "feathers", label: "Feathers", icon: "✦" },
  { id: "analytics", label: "Analytics", icon: "▥" },
  { id: "partners", label: "Partners", icon: "♧" },
  { id: "announcements", label: "Announcements", icon: "◉" },
  { id: "system", label: "System Control", icon: "⚙" },
  { id: "activity", label: "Admin Activity Log", icon: "↺" },
] as const;
type ModuleId = typeof MODULES[number]["id"];
type Question = { index: number; question: string };
type MetricKey = "totalUsers" | "revenuePaise" | "activeSubscriptions" | "pendingPayments" | "totalFeathers" | "activePartners";

const MODULE_DESCRIPTIONS: Record<Exclude<ModuleId, "overview">, { summary: string; actions: string[]; note: string }> = {
  users: { summary: "Manage KOYAL AI accounts and user support.", actions: ["View profile and account details", "View chat usage and activity", "Change subscription plan", "Add or deduct Feathers", "Suspend or restore account", "Delete account", "Send a message to the user", "View payment history"], note: "User actions will be connected after the account and audit safeguards are implemented." },
  payments: { summary: "View and verify payment transactions. Refund controls are intentionally excluded.", actions: ["View all transactions", "Filter successful, pending, failed and refunded", "View transaction and order details", "Verify payment status with the provider", "Search by user email, order ID or transaction ID", "View an individual user's payment history"], note: "Payment data will be connected to the existing Cashfree order records. This panel will not issue refunds or edit payment records." },
  subscriptions: { summary: "Manage plan access separately from payment records.", actions: ["View active and expired subscriptions", "View plan and expiry date", "Change subscription plan", "Extend or shorten validity", "Manually activate without payment", "Deactivate a subscription", "View subscription history"], note: "Manual subscription changes will be audited and will never create a payment record." },
  coupons: { summary: "Create and manage Feather and subscription coupons.", actions: ["Create and edit coupon codes", "Create free subscription coupons", "Create Feather reward coupons", "Set expiry and redemption limits", "Configure one-time or multiple-use redemption", "Enable, disable or delete coupons", "View redemption history", "Search by user or coupon code"], note: "Coupon management will be connected to the existing redemption ledger and new admin coupon records." },
  feathers: { summary: "Inspect user Feather balances and make traceable adjustments.", actions: ["View user Feather balance", "Add Feathers", "Deduct Feathers", "View transaction history", "Search users by email", "View total distributed and spent"], note: "Directly overwriting a wallet balance is not allowed. Each adjustment must create a ledger entry with reason and admin identity." },
  analytics: { summary: "Review KOYAL AI growth, revenue and usage.", actions: ["Registered and active users", "New registrations", "Total and plan-wise revenue", "Popular subscription plans", "Feathers purchased, distributed and spent", "AI usage and chat activity", "Payment success and failure statistics", "Today, 7 days, 30 days, this year and custom date filters"], note: "Analytics will only display values backed by verified source tables; unavailable metrics will remain clearly marked." },
  partners: { summary: "Manage Find Up and Tours & Travels partners.", actions: ["View partner applications", "Approve or reject applications", "Edit partner details", "Suspend or reactivate partners", "View categories and partnership history", "Remove partners", "Search by name, category or location", "Feature or unfeature selected partners"], note: "Partner actions will be connected to the existing Find Up and travel partner data sources." },
  announcements: { summary: "Publish notices and in-app pop-up notifications.", actions: ["Create announcements", "Send to all users", "Target plans or selected users", "Schedule announcements", "Edit or delete announcements", "Mark urgent or normal", "Show dismissible or persistent pop-ups", "View announcement history"], note: "Announcements will support both the notice section and in-app pop-ups." },
  system: { summary: "Control app availability and monitor service health.", actions: ["Turn maintenance mode on or off", "Customize maintenance message", "View service status", "Enable or disable selected app features", "View recent system errors", "Manage app-wide settings"], note: "Maintenance mode must preserve an administrator bypass. Destructive or global changes will require confirmation." },
  activity: { summary: "Review a permanent record of administrator actions.", actions: ["View admin activity", "Search by admin email", "Filter by action type and date", "View affected account, timestamp and result"], note: "This log is append-only. No administrator can edit or delete an entry." },
};

function localDate() {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function formatMetric(key: MetricKey, value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  if (key === "revenuePaise") return "₹" + (value / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 });
  return value.toLocaleString("en-IN");
}

export default function AdminPage() {
  const [accessToken, setAccessToken] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [unlocked, setUnlocked] = useState(false);
  const [step, setStep] = useState<"password" | "setupAnswers" | "setupPasskeys" | "questions" | "passkey">("password");
  const [password, setPassword] = useState("");
  const [setupAnswers, setSetupAnswers] = useState<string[][]>(Array.from({ length: 3 }, () => Array(5).fill("")));
  const [setupPasskeys, setSetupPasskeys] = useState<string[]>(["", "", ""]);
  const [loginPasskey, setLoginPasskey] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [challengeAnswers, setChallengeAnswers] = useState<Record<number, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [activeModule, setActiveModule] = useState<ModuleId>("overview");
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [appliedStartDate, setAppliedStartDate] = useState("");
  const [appliedEndDate, setAppliedEndDate] = useState("");
  const [overview, setOverview] = useState<any>(null);
  const [overviewError, setOverviewError] = useState("");
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [activityFilter, setActivityFilter] = useState("");
  const [payments, setPayments] = useState<any[]>([]);
  const [paymentSearch, setPaymentSearch] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [paymentsError, setPaymentsError] = useState("");
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [subscriptionSearch, setSubscriptionSearch] = useState("");
  const [subscriptionsError, setSubscriptionsError] = useState("");
  const [subscriptionsTotal, setSubscriptionsTotal] = useState<number | null>(null);
  const [activeSubscriptionUsers, setActiveSubscriptionUsers] = useState<number | null>(null);
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [usersError, setUsersError] = useState("");
  const [usersTotal, setUsersTotal] = useState<number | null>(null);

  const headers = useMemo<Record<string, string>>(() => {
    const result: Record<string, string> = { "Content-Type": "application/json" };
    if (accessToken) result.Authorization = `Bearer ${accessToken}`;
    return result;
  }, [accessToken]);

  useEffect(() => {
    let active = true;
    try {
      const session = JSON.parse(localStorage.getItem("koyal-ai-auth-session") || "null");
      const token = typeof session?.access_token === "string" ? session.access_token : "";
      const email = typeof session?.user?.email === "string" ? session.user.email.trim().toLowerCase() : "";
      if (active) {
        setAccessToken(token);
        setAccountEmail(email);
        if (!token || email !== ADMIN_EMAIL) setLoading(false);
        else {
          fetch("/api/admin/session", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" })
            .then(async response => response.ok ? response.json() : null)
            .then(data => { if (active && data?.authenticated) setUnlocked(true); })
            .catch(() => {})
            .finally(() => { if (active) setLoading(false); });
        }
      }
    } catch {
      if (active) setLoading(false);
    }
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!unlocked || activeModule !== "overview") return;
    const query = new URLSearchParams();
    if (appliedStartDate) query.set("start", appliedStartDate);
    if (appliedEndDate) query.set("end", appliedEndDate);
    fetch(`/api/admin/overview?${query.toString()}`, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" })
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Could not load overview.");
        setOverview(data);
        setOverviewError("");
      })
      .catch(cause => setOverviewError(cause instanceof Error ? cause.message : "Could not load overview."));
  }, [unlocked, activeModule, appliedStartDate, appliedEndDate, accessToken]);

  useEffect(() => {
    if (!unlocked || activeModule !== "activity") return;
    const query = new URLSearchParams();
    if (appliedStartDate) query.set("start", appliedStartDate);
    if (appliedEndDate) query.set("end", appliedEndDate);
    if (activityFilter.trim()) query.set("action", activityFilter.trim());
    fetch(`/api/admin/activity?${query.toString()}`, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" })
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Could not load the activity log.");
        setActivityLogs(Array.isArray(data.logs) ? data.logs : []);
      })
      .catch(cause => setOverviewError(cause instanceof Error ? cause.message : "Could not load the activity log."));
  }, [unlocked, activeModule, appliedStartDate, appliedEndDate, activityFilter, accessToken]);

  useEffect(() => {
    if (!unlocked || activeModule !== "payments") return;
    const query = new URLSearchParams();
    if (paymentSearch.trim()) query.set("search", paymentSearch.trim());
    if (paymentStatus) query.set("status", paymentStatus);
    fetch(`/api/admin/payments?${query.toString()}`, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" })
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Could not load payments.");
        setPayments(Array.isArray(data.payments) ? data.payments : []);
        setPaymentsError("");
      })
      .catch(cause => setPaymentsError(cause instanceof Error ? cause.message : "Could not load payments."));
  }, [unlocked, activeModule, paymentSearch, paymentStatus, accessToken]);

  useEffect(() => {
    if (!unlocked || activeModule !== "subscriptions") return;
    const query = new URLSearchParams();
    if (subscriptionSearch.trim()) query.set("search", subscriptionSearch.trim());
    fetch(`/api/admin/subscriptions?${query.toString()}`, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" })
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Could not load subscriptions.");
        setSubscriptions(Array.isArray(data.subscriptions) ? data.subscriptions : []);
        setSubscriptionsTotal(Number.isFinite(Number(data.totalRecords)) ? Number(data.totalRecords) : null);
        setActiveSubscriptionUsers(Number.isFinite(Number(data.activeUsers)) ? Number(data.activeUsers) : null);
        setSubscriptionsError("");
      })
      .catch(cause => setSubscriptionsError(cause instanceof Error ? cause.message : "Could not load subscriptions."));
  }, [unlocked, activeModule, subscriptionSearch, accessToken]);

  useEffect(() => {
    if (!unlocked || activeModule !== "users") return;
    const query = new URLSearchParams();
    if (userSearch.trim()) query.set("search", userSearch.trim());
    fetch(`/api/admin/users?${query.toString()}`, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" })
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Could not load users.");
        setAdminUsers(Array.isArray(data.users) ? data.users : []);
        setUsersTotal(Number.isFinite(Number(data.totalRegistered)) ? Number(data.totalRegistered) : null);
        setUsersError("");
      })
      .catch(cause => setUsersError(cause instanceof Error ? cause.message : "Could not load users."));
  }, [unlocked, activeModule, userSearch, accessToken]);

  async function beginVerification() {
    setError("");
    if (!password) { setError("Enter your KOYAL AI account password."); return; }
    setBusy(true);
    try {
      const response = await fetch("/api/admin/security/challenge", { method: "POST", headers, body: JSON.stringify({ password }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not begin admin verification.");
      if (data.setupRequired) {
        setStep("setupAnswers");
      } else {
        setChallengeId(data.challengeId);
        setQuestions(data.questions || []);
        setChallengeAnswers({});
        setStep("questions");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not begin admin verification.");
    } finally { setBusy(false); }
  }

  function continueToSetupPasskeys() {
    setError("");
    if (setupAnswers.some(combo => combo.some(answer => !answer.trim()))) { setError("Complete all five answers in all three combinations."); return; }
    const signatures = setupAnswers.map(combo => combo.map(value => value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US")).join("|"));
    if (new Set(signatures).size !== 3) { setError("Each complete answer combination must be different."); return; }
    setStep("setupPasskeys");
  }

  async function finishSecuritySetup() {
    setError("");
    if (setupPasskeys.some(value => value.trim().length < 12 || value.length > 128) || new Set(setupPasskeys).size !== 3) { setError("Enter three different passkeys, each at least 12 characters."); return; }
    setBusy(true);
    try {
      const response = await fetch("/api/admin/security/setup", { method: "POST", headers, body: JSON.stringify({ password, answers: setupAnswers, passkeys: setupPasskeys }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not complete admin security setup.");
      setUnlocked(true); setPassword(""); setSetupAnswers(Array.from({ length: 3 }, () => Array(5).fill(""))); setSetupPasskeys(["", "", ""]); setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not complete admin security setup."); }
    finally { setBusy(false); }
  }

  async function verifyAnswers() {
    setError("");
    if (questions.length !== 5 || questions.some(question => !(challengeAnswers[question.index] || "").trim())) { setError("Answer all five security questions."); return; }
    setBusy(true);
    try {
      const response = await fetch("/api/admin/security/verify", { method: "POST", headers, body: JSON.stringify({ challengeId, answers: questions.map(question => ({ questionIndex: question.index, answer: challengeAnswers[question.index] })) }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Security answer combination did not match.");
      setLoginPasskey(""); setStep("passkey");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Security verification failed."); setStep("password"); setPassword(""); }
    finally { setBusy(false); }
  }

  async function verifyPasskey() {
    setError("");
    if (!loginPasskey) { setError("Enter the passkey for the verified combination."); return; }
    setBusy(true);
    try {
      const response = await fetch("/api/admin/security/passkey", { method: "POST", headers, body: JSON.stringify({ challengeId, passkey: loginPasskey }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Passkey verification failed.");
      setUnlocked(true); setPassword(""); setLoginPasskey(""); setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Passkey verification failed."); setStep("password"); setPassword(""); }
    finally { setBusy(false); }
  }

  async function signOutAdmin() {
    try { await fetch("/api/admin/logout", { method: "POST", headers: { Authorization: `Bearer ${accessToken}` } }); } catch {}
    window.location.assign("/");
  }

  function selectModule(id: ModuleId) {
    setActiveModule(id);
    setMobileSidebar(false);
  }

  const metrics: { key: MetricKey; label: string; icon: string }[] = [
    { key: "totalUsers", label: "Total Users", icon: "♙" },
    { key: "revenuePaise", label: "Revenue", icon: "₹" },
    { key: "activeSubscriptions", label: "Active Subscriptions", icon: "♛" },
    { key: "pendingPayments", label: "Pending Payments", icon: "◷" },
    { key: "totalFeathers", label: "Total Feathers", icon: "✦" },
    { key: "activePartners", label: "Active Partners", icon: "♧" },
  ];

  if (loading) return <main className="adminLoading">Loading KOYAL Admin…</main>;
  if (!accessToken || accountEmail !== ADMIN_EMAIL) return <main className="adminGate"><div className="adminGateCard"><img src="/koyal-bird.png" alt="KOYAL" /><h1>Admin access restricted</h1><p>Sign in to KOYAL AI using the authorized administrator account to continue.</p><a href="/">Return to KOYAL AI</a></div></main>;

  if (!unlocked) return (
    <main className="adminGate">
      <section className="adminGateCard">
        <img src="/koyal-bird.png" alt="KOYAL bird" />
        <div className="adminEyebrow">KOYAL AI · ADMIN SECURITY</div>
        <h1>{step === "setupAnswers" ? "Set up security answers" : step === "setupPasskeys" ? "Set up backup passkeys" : step === "questions" ? "Verify security answers" : step === "passkey" ? "Verify passkey" : "Verify Admin Access"}</h1>
        <p>Administrator account: <strong>{ADMIN_EMAIL}</strong></p>
        {step === "password" && <>
          <label>Re-enter your KOYAL AI password<input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} /></label>
          <button className="adminPrimary" disabled={busy} onClick={beginVerification}>{busy ? "Checking…" : "Next"}</button>
        </>}
        {step === "setupAnswers" && <>
          <p className="adminHint">Save three private backup answer sets. During login, KOYAL automatically identifies which set matches. Use answers you have not shared publicly.</p>
          {[0, 1, 2].map(comboIndex => <div className="adminQuestionGroup" key={comboIndex}>
            {SECURITY_QUESTIONS.map((question, questionIndex) => <label key={question}>{question}<input autoComplete="off" value={setupAnswers[comboIndex][questionIndex]} onChange={event => setSetupAnswers(old => old.map((combo, index) => index === comboIndex ? combo.map((value, qIndex) => qIndex === questionIndex ? event.target.value : value) : combo))} /></label>)}
          </div>)}
          <button className="adminPrimary" disabled={busy} onClick={continueToSetupPasskeys}>Next</button>
        </>}
        {step === "setupPasskeys" && <>
          <p className="adminHint">Create three unique passkeys in the same order as the answer sets above. Each must be at least 12 characters. KOYAL keeps this matching private.</p>
          {[0, 1, 2].map(index => <label key={index}>Backup passkey<input type="password" autoComplete="new-password" value={setupPasskeys[index]} onChange={event => setSetupPasskeys(old => old.map((value, valueIndex) => valueIndex === index ? event.target.value : value))} /></label>)}
          <button className="adminPrimary" disabled={busy} onClick={finishSecuritySetup}>{busy ? "Verifying…" : "Login"}</button>
          <button className="adminSecondary" disabled={busy} onClick={() => setStep("setupAnswers")}>Back to answers</button>
        </>}
        {step === "questions" && <>
          <p className="adminHint">Enter your five security answers. KOYAL will automatically check them against your saved backup answer sets.</p>
          {questions.map(question => <label key={question.index}>{question.question}<input autoComplete="off" value={challengeAnswers[question.index] || ""} onChange={event => setChallengeAnswers(old => ({ ...old, [question.index]: event.target.value }))} /></label>)}
          <button className="adminPrimary" disabled={busy} onClick={verifyAnswers}>{busy ? "Checking combination…" : "Next"}</button>
          <button className="adminSecondary" disabled={busy} onClick={() => { setStep("password"); setPassword(""); setError(""); }}>Start again</button>
        </>}
        {step === "passkey" && <>
          <p className="adminHint">Your answers matched. Enter the passkey associated with those answers.</p>
          <label>Passkey<input type="password" autoComplete="current-password" value={loginPasskey} onChange={event => setLoginPasskey(event.target.value)} /></label>
          <button className="adminPrimary" disabled={busy} onClick={verifyPasskey}>{busy ? "Verifying…" : "Login"}</button>
          <button className="adminSecondary" disabled={busy} onClick={() => { setStep("password"); setPassword(""); setLoginPasskey(""); setError(""); }}>Start again</button>
        </>}
        {error && <p className="adminError" role="alert">{error}</p>}
        <button className="adminBack" onClick={() => window.location.assign("/")}>← Back to KOYAL AI</button>
      </section>
    </main>
  );

  const active = MODULES.find(module => module.id === activeModule) || MODULES[0];
  const revenueRows = overview?.charts?.revenue || [];
  const maxRevenue = Math.max(1, ...revenueRows.map((row: any) => Number(row.amountPaise) || 0));
  return (
    <main className="adminShell">
      {mobileSidebar && <button className="adminScrim" aria-label="Close admin menu" onClick={() => setMobileSidebar(false)} />}
      <aside className={`adminSidebar ${mobileSidebar ? "adminSidebarOpen" : ""}`}>
        <div className="adminBrand"><img src="/koyal-bird.png" alt="KOYAL bird" /><div><strong>KOYAL <span>AI</span></strong><small>ADMIN CONTROL CENTRE</small></div></div>
        <div className="adminSideLabel">WORKSPACE</div>
        <nav>{MODULES.map(module => <button key={module.id} className={activeModule === module.id ? "adminNavActive" : ""} onClick={() => selectModule(module.id)}><span>{module.icon}</span>{module.label}</button>)}</nav>
        <div className="adminSidebarBottom"><div className="adminIdentity"><span className="adminIdentityBird"><img src="/koyal-bird.png" alt="" /></span><span><strong>Koyal Ai India</strong><small>ADMINISTRATOR</small></span></div><button onClick={signOutAdmin}>Sign out of Admin</button><a href="/">← Return to KOYAL chat</a></div>
      </aside>
      <section className="adminMain">
        <header className="adminTopbar">
          <button className="adminMobileToggle" onClick={() => setMobileSidebar(true)} aria-label="Open admin navigation">☰</button>
          <div><div className="adminEyebrow">KOYAL AI / ADMIN</div><h1>{active.label}</h1></div>
          <div className="adminTopRight"><span className="adminTag">ADMIN</span><span className="adminEmail">{ADMIN_EMAIL}</span></div>
        </header>

        {activeModule === "overview" ? <div className="adminContent">
          <div className="adminWelcome"><div><h2>Welcome, Koyal Ai India</h2><p>Your KOYAL AI control centre.</p></div><span>✦ Secure administrator session</span></div>
          <section className="adminDateBar"><div><strong>Custom date range</strong><small>Choose a period to filter dashboard reports.</small></div><label>From<input type="date" value={startDate} max={endDate || localDate()} onChange={event => { setStartDate(event.target.value); }} /></label><label>To<input type="date" value={endDate} min={startDate || undefined} max={localDate()} onChange={event => { setEndDate(event.target.value);  }} /></label><button onClick={() => { setAppliedStartDate(startDate); setAppliedEndDate(endDate); }}>Apply</button><button className="adminReset" onClick={() => { setStartDate(""); setEndDate(""); setAppliedStartDate(""); setAppliedEndDate(""); }}>Reset</button></section>
          {overviewError && <div className="adminInlineError">{overviewError}</div>}
          <div className="adminMetricGrid">{metrics.map(metric => <article className="adminMetric" key={metric.key}><span className="adminMetricIcon">{metric.icon}</span><small>{metric.label}</small><strong>{formatMetric(metric.key, overview?.metrics?.[metric.key] ?? null)}</strong><em>{metric.key === "revenuePaise" ? "Selected period" : "Live database figure"}</em></article>)}</div>
          <div className="adminPanelGrid">
            <section className="adminPanelCard"><div className="adminCardHeading"><h3>Revenue overview</h3><span>SELECTED PERIOD</span></div><div className="adminChartBars">{revenueRows.length ? revenueRows.map((row: any) => <div className="adminBarColumn" key={row.date} title={row.date + ": ₹" + (row.amountPaise / 100).toLocaleString("en-IN")}><div className="adminBar" style={{ height: Math.max(5, (Number(row.amountPaise) / maxRevenue) * 100) + "%" }} /><small>{String(row.date).slice(5)}</small></div>) : <div className="adminEmptyChart">No verified revenue records in this date range.</div>}</div></section>
            <section className="adminPanelCard"><div className="adminCardHeading"><h3>User growth</h3><span>SELECTED PERIOD</span></div><div className="adminEmptyChart">User growth chart will appear when account analytics are connected.</div></section>
            <section className="adminPanelCard"><div className="adminCardHeading"><h3>Subscription distribution</h3><span>ALL PLANS</span></div><div className="adminDataRows">{(overview?.charts?.subscriptionDistribution || []).length ? overview.charts.subscriptionDistribution.map((row: any) => <div key={row.plan}><span>{row.plan}</span><strong>{Number(row.users).toLocaleString("en-IN")}</strong></div>) : <div className="adminEmptyChart">No active paid subscriptions in the current records.</div>}</div></section>
            <section className="adminPanelCard"><div className="adminCardHeading"><h3>Payment summary</h3><span>ALL STATUSES</span></div><div className="adminDataRows">{(overview?.charts?.paymentSummary || []).length ? overview.charts.paymentSummary.map((row: any) => <div key={row.status}><span>{row.status}</span><strong>{Number(row.count).toLocaleString("en-IN")}</strong></div>) : <div className="adminEmptyChart">No payment records in this date range.</div>}</div></section>
          </div>
          <div className="adminPanelGrid adminBottomGrid">
            <section className="adminPanelCard"><div className="adminCardHeading"><h3>Recent admin activity</h3><button onClick={() => selectModule("activity")}>View log →</button></div><div className="adminRecentRows">{(overview?.recentActivity || []).length ? overview.recentActivity.slice(0, 6).map((item: any) => <div key={item.id}><strong>{String(item.action).replace(/_/g, " ")}</strong><small>{new Date(item.created_at).toLocaleString("en-IN")}</small></div>) : <p className="adminEmptyText">No administrator actions have been recorded yet.</p>}</div></section>
            <section className="adminPanelCard"><div className="adminCardHeading"><h3>System health</h3><span>LIVE CHECKS</span></div><div className="adminServiceRows">{Object.entries(overview?.services || { database: "not_checked", authentication: "not_checked", paymentProvider: "not_checked", aiService: "not_checked" }).map(([name, status]) => <div key={name}><span>{name.replace(/([A-Z])/g, " $1")}</span><b className={status === "connected" ? "serviceConnected" : "serviceUnknown"}>{String(status).replace("_", " ")}</b></div>)}</div></section>
          </div>
          <section className="adminQuickActions"><div className="adminCardHeading"><h3>Quick Actions</h3><span>SHORTCUTS</span></div><div>{[{ label: "Find User", module: "users" as ModuleId }, { label: "Create Coupon", module: "coupons" as ModuleId }, { label: "Add Feathers", module: "feathers" as ModuleId }, { label: "Verify Payments", module: "payments" as ModuleId }, { label: "Manage Partners", module: "partners" as ModuleId }, { label: "Publish Announcement", module: "announcements" as ModuleId }].map(item => <button key={item.label} onClick={() => selectModule(item.module)}>{item.label}<span>→</span></button>)}</div></section>
        </div> : activeModule === "users" ? <div className="adminContent">
          <div className="adminModuleIntro"><div><span className="adminEyebrow">SUPABASE AUTH ACCOUNTS</span><h2>User Directory</h2><p>Inspect registered accounts, sign-in activity and Feather balances. Account-changing controls are not enabled yet.</p></div><span className="adminBuildBadge">VIEW ONLY</span></div>
          <section className="adminPanelCard">
            <div className="adminUserToolbar"><label>Search by name, email or user ID<input value={userSearch} onChange={event => setUserSearch(event.target.value)} placeholder="Search accounts…" /></label><span>{usersTotal === null ? "Registered users" : usersTotal.toLocaleString("en-IN") + " registered users"}</span></div>
            {usersError && <div className="adminInlineError">{usersError}</div>}
            <div className="adminUserList">{adminUsers.length ? adminUsers.map(user => <article key={user.id}>
              <div className="adminUserIdentity"><span>{String(user.name || user.email || "?").slice(0,1).toUpperCase()}</span><div><strong>{user.name || "Name not provided"}</strong><small>{user.email || "No email"}</small></div></div>
              <div><small>FEATHERS</small><strong>{user.feathers === null ? "Not initialized" : Number(user.feathers).toLocaleString("en-IN")}</strong></div>
              <div><small>ACCOUNT STATUS</small><strong className={user.bannedUntil && Date.parse(user.bannedUntil) > Date.now() ? "adminUserSuspended" : "adminUserActive"}>{user.bannedUntil && Date.parse(user.bannedUntil) > Date.now() ? "Suspended" : "Active"}</strong></div>
              <div><small>JOINED</small><strong>{user.createdAt ? new Date(user.createdAt).toLocaleDateString("en-IN") : "—"}</strong><small>Last sign-in: {user.lastSignInAt ? new Date(user.lastSignInAt).toLocaleDateString("en-IN") : "Not recorded"}</small></div>
              <details><summary>Account ID</summary><code>{user.id}</code></details>
            </article>) : <p className="adminEmptyText">No matching accounts found.</p>}</div>
            <p className="adminHint">Showing up to 250 matching accounts from the first 1,000 Supabase Auth records. This view does not change accounts or wallet balances.</p>
          </section>
        </div> : activeModule === "subscriptions" ? <div className="adminContent">
          <div className="adminModuleIntro"><div><span className="adminEyebrow">PAID ORDERS + COUPON REDEMPTIONS</span><h2>Subscription History</h2><p>Inspect recorded subscription access separately from payment transactions. No payment or subscription records are changed here.</p></div><span className="adminBuildBadge">READ ONLY</span></div>
          <section className="adminPanelCard">
            <div className="adminUserToolbar"><label>Search by user ID, plan, source or reference<input value={subscriptionSearch} onChange={event => setSubscriptionSearch(event.target.value)} placeholder="Search subscription records…" /></label><span>{activeSubscriptionUsers === null ? "Active users" : activeSubscriptionUsers.toLocaleString("en-IN") + " active"} · {subscriptionsTotal === null ? "—" : subscriptionsTotal.toLocaleString("en-IN") + " records"}</span></div>
            {subscriptionsError && <div className="adminInlineError">{subscriptionsError}</div>}
            <div className="adminPaymentList">{subscriptions.length ? subscriptions.map(item => <article key={item.id}>
              <div><strong>{item.plan}</strong><small>{item.source} · {item.reference}</small></div>
              <div><strong className={item.status === "Current" ? "adminUserActive" : "adminUserSuspended"}>{item.status}</strong><small>Expires {item.expiresAt ? new Date(item.expiresAt).toLocaleDateString("en-IN") : "—"}</small></div>
              <div><small>User ID</small><code>{item.userId}</code><small>Starts {item.startedAt ? new Date(item.startedAt).toLocaleDateString("en-IN") : "—"}</small></div>
            </article>) : <p className="adminEmptyText">No matching subscription records found.</p>}</div>
            <p className="adminHint">Paid access periods are calculated from verified PAID subscription orders using KOYAL's existing 30-day rule. Coupon access uses its recorded expiry. Showing up to 1,000 records. Plan changes, extensions and manual activation are not enabled yet.</p>
          </section>
        </div> : activeModule === "payments" ? <div className="adminContent">
          <div className="adminModuleIntro"><div><span className="adminEyebrow">CASHFREE ORDER RECORDS</span><h2>Payment Transactions</h2><p>Search and inspect recorded orders. This panel is read-only and does not issue refunds or alter payment records.</p></div><span className="adminBuildBadge">READ ONLY</span></div>
          <section className="adminPanelCard">
            <div className="adminPaymentFilters">
              <label>Search order, user ID or plan<input value={paymentSearch} onChange={event => setPaymentSearch(event.target.value)} placeholder="Enter order ID, user ID…" /></label>
              <label>Payment status<select value={paymentStatus} onChange={event => setPaymentStatus(event.target.value)}><option value="">All statuses</option><option value="PAID">Paid</option><option value="PENDING">Pending</option><option value="FAILED">Failed</option><option value="CANCELLED">Cancelled</option><option value="REFUNDED">Refunded</option></select></label>
            </div>
            {paymentsError && <div className="adminInlineError">{paymentsError}</div>}
            <div className="adminPaymentList">{payments.length ? payments.map(item => <article key={item.id}>
              <div><strong>{item.cashfree_order_id || item.id}</strong><small>{item.order_type === "subscription" ? `Subscription · ${item.plan_name || "Plan"}` : item.order_type === "feathers" ? `Feathers · ${Number(item.feather_quantity || 0).toLocaleString("en-IN")}` : item.order_type || "Order"}</small></div>
              <div><strong>₹{(Number(item.amount_paise || 0) / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</strong><small>{String(item.payment_status || "UNKNOWN").toUpperCase()}</small></div>
              <div><small>User ID</small><code>{item.user_id}</code><small>{item.created_at ? new Date(item.created_at).toLocaleString("en-IN") : "Date unavailable"}</small></div>
            </article>) : <p className="adminEmptyText">No payment records match this filter.</p>}</div>
            <p className="adminHint">Showing up to 500 most recent orders. Payment verification with Cashfree will be added only after its order-state handling is safely connected.</p>
          </section>
        </div> : activeModule === "activity" ? <div className="adminContent"><div className="adminModuleIntro"><div><span className="adminEyebrow">IMMUTABLE AUDIT TRAIL</span><h2>Admin Activity Log</h2><p>Read-only record of administrator security and management actions.</p></div><span className="adminBuildBadge">READ ONLY · NO EDIT OR DELETE</span></div><section className="adminPanelCard"><label className="adminActivitySearch">Filter by action<input value={activityFilter} onChange={event => setActivityFilter(event.target.value)} placeholder="e.g. admin_access_granted" /></label><div className="adminActivityList">{activityLogs.length ? activityLogs.map(item => <article key={item.id}><div><strong>{String(item.action).replace(/_/g, " ")}</strong><small>{item.admin_email}</small></div><time>{new Date(item.created_at).toLocaleString("en-IN")}</time><p>{item.details && Object.keys(item.details).length ? JSON.stringify(item.details) : "No additional details"}</p></article>) : <p className="adminEmptyText">No matching activity records.</p>}</div></section></div> : <div className="adminContent"><div className="adminModuleIntro"><div><span className="adminEyebrow">ADMIN MODULE</span><h2>{active.label}</h2><p>{MODULE_DESCRIPTIONS[activeModule].summary}</p></div><span className="adminBuildBadge">IMPLEMENTATION IN PROGRESS</span></div><section className="adminPanelCard adminModuleCard"><h3>Planned controls</h3><ul>{MODULE_DESCRIPTIONS[activeModule].actions.map(action => <li key={action}>{action}</li>)}</ul><p className="adminHint">{MODULE_DESCRIPTIONS[activeModule].note}</p></section></div>}
      </section>
      <style jsx global>{`
        *{box-sizing:border-box}.adminLoading,.adminGate{min-height:100vh;background:#08090e;color:#f7f7fb;display:grid;place-items:center;padding:22px;font-family:Inter,system-ui,sans-serif}.adminGateCard{width:min(100%,520px);padding:34px;border:1px solid #34343e;border-radius:24px;background:linear-gradient(145deg,#191a22,#101117);box-shadow:0 24px 90px #0009}.adminGateCard>img{display:block;width:82px;height:82px;object-fit:contain;margin:0 auto 14px}.adminGateCard h1{text-align:center;font-size:27px;margin:10px 0}.adminGateCard p{color:#aeb0bc;line-height:1.55}.adminGateCard>p:first-of-type{text-align:center}.adminEyebrow{font-size:10px;letter-spacing:.16em;font-weight:800;color:#9b9eaa}.adminGateCard>.adminEyebrow{text-align:center;color:#ff7584}.adminGateCard label{display:grid;gap:8px;margin:17px 0;color:#e8e8ef;font-size:13px;font-weight:650}.adminGateCard input,.adminDateBar input{width:100%;min-width:0;background:#0b0c12;color:#fff;border:1px solid #3b3d49;border-radius:10px;padding:12px;font:inherit}.adminPrimary,.adminSecondary{width:100%;padding:13px;border-radius:11px;font-weight:800;cursor:pointer;margin-top:10px}.adminPrimary{border:0;background:linear-gradient(110deg,#f04a5b,#b91f3e);color:white}.adminPrimary:disabled{opacity:.55}.adminSecondary{border:1px solid #424450;background:#1d1f28;color:#ddd}.adminBack{display:block;margin:20px auto 0;border:0;background:transparent;color:#aeb0bc;cursor:pointer}.adminHint{font-size:12px!important;color:#aeb0bc!important;line-height:1.55}.adminError,.adminInlineError{padding:11px 13px;border-radius:10px;background:#3a1820;border:1px solid #74303d;color:#ffadb6;font-size:13px}.adminQuestionGroup{display:grid;gap:8px;padding:15px 0;border-bottom:1px solid #30313b}.adminQuestionGroup strong{font-size:13px;color:#f0eff5}.adminQuestionGroup input{margin:0}.adminShell{min-height:100vh;background:#0a0b10;color:#f5f5f8;display:grid;grid-template-columns:270px minmax(0,1fr);font-family:Inter,system-ui,sans-serif}.adminSidebar{height:100vh;position:sticky;top:0;display:flex;flex-direction:column;padding:20px 14px 16px;background:linear-gradient(180deg,#171820,#0d0e14);border-right:1px solid #2a2b35;overflow:auto}.adminBrand{display:flex;align-items:center;gap:11px;padding:3px 8px 22px;border-bottom:1px solid #2d2e38}.adminBrand img{width:48px;height:48px;object-fit:contain}.adminBrand strong{font-size:19px;letter-spacing:.06em}.adminBrand strong span{color:#f05a68}.adminBrand small{display:block;color:#8e909e;font-size:9px;letter-spacing:.14em;margin-top:5px}.adminSideLabel{font-size:9px;letter-spacing:.16em;color:#777987;font-weight:800;margin:23px 10px 10px}.adminSidebar nav{display:grid;gap:4px}.adminSidebar nav button{border:1px solid transparent;background:transparent;color:#c9cad2;border-radius:10px;text-align:left;padding:11px 12px;display:flex;align-items:center;gap:12px;font-size:13px;cursor:pointer}.adminSidebar nav button span{width:20px;text-align:center;color:#9fa1ad;font-size:17px}.adminSidebar nav button:hover{background:#22232d}.adminSidebar nav button.adminNavActive{background:#3b1d25;border-color:#71303c;color:#fff}.adminSidebar nav button.adminNavActive span{color:#ff7c87}.adminSidebarBottom{margin-top:auto;padding:16px 7px 0;border-top:1px solid #2d2e38}.adminIdentity{display:flex;align-items:center;gap:10px;margin-bottom:13px}.adminIdentityBird{width:38px;height:38px;border-radius:50%;background:#dff2ff;display:grid;place-items:center;overflow:hidden}.adminIdentityBird img{width:33px;height:33px;object-fit:contain}.adminIdentity strong{display:block;font-size:12px}.adminIdentity small{display:block;color:#82cfff;font-size:9px;letter-spacing:.1em;margin-top:4px}.adminSidebarBottom>button,.adminSidebarBottom>a{display:block;width:100%;padding:9px 10px;text-align:left;border:0;background:transparent;color:#aeb0bc;text-decoration:none;font-size:12px;cursor:pointer}.adminSidebarBottom>button:hover,.adminSidebarBottom>a:hover{color:#fff}.adminMain{min-width:0}.adminTopbar{height:82px;border-bottom:1px solid #252630;display:flex;align-items:center;gap:16px;padding:0 clamp(18px,3vw,42px);background:#101117}.adminTopbar h1{font-size:21px;margin:4px 0 0}.adminTopRight{margin-left:auto;display:flex;align-items:center;gap:13px}.adminTag{font-size:9px;font-weight:850;letter-spacing:.12em;color:#9ddcff;background:#18364a;border:1px solid #315c75;border-radius:20px;padding:6px 9px}.adminEmail{font-size:11px;color:#999ba8}.adminMobileToggle{display:none;border:1px solid #353641;border-radius:9px;background:#1a1b23;color:#fff;padding:9px}.adminContent{padding:clamp(18px,3vw,38px);max-width:1600px;margin:0 auto}.adminWelcome{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:23px}.adminWelcome h2,.adminModuleIntro h2{font-size:22px;margin:0 0 6px}.adminWelcome p,.adminModuleIntro p{margin:0;color:#9b9daa;font-size:13px}.adminWelcome>span{font-size:11px;color:#a4d8f7;border:1px solid #2b4e64;background:#132635;border-radius:20px;padding:8px 11px}.adminDateBar{display:flex;align-items:end;gap:12px;flex-wrap:wrap;padding:15px;border:1px solid #2c2d37;border-radius:14px;background:#12131a;margin-bottom:18px}.adminDateBar>div{margin-right:auto;display:grid;gap:5px}.adminDateBar>div strong{font-size:13px}.adminDateBar small{font-size:11px;color:#9294a1}.adminDateBar label{display:grid;gap:5px;color:#a8aab5;font-size:10px}.adminDateBar input{width:145px;padding:9px;font-size:12px}.adminDateBar button{border:1px solid #a82d40;border-radius:9px;background:#8f2334;color:white;padding:10px 15px;font-weight:750;cursor:pointer}.adminDateBar button:disabled{opacity:.45;cursor:not-allowed}.adminDateBar button.adminReset{border-color:#41424d;background:#20212a;color:#d2d3da}.adminMetricGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:13px;margin-bottom:17px}.adminMetric{min-height:126px;border:1px solid #2c2d37;border-radius:14px;background:linear-gradient(145deg,#171820,#111219);padding:17px;display:grid;grid-template-columns:30px 1fr;align-content:start;gap:7px 10px}.adminMetricIcon{grid-row:span 2;width:30px;height:30px;display:grid;place-items:center;border-radius:9px;background:#342028;color:#ff818b;font-size:17px}.adminMetric small{color:#a4a5b0;font-size:11px}.adminMetric strong{font-size:23px;letter-spacing:-.03em}.adminMetric em{grid-column:2;color:#727582;font-size:10px;font-style:normal}.adminPanelGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px;margin-bottom:13px}.adminPanelCard,.adminQuickActions{border:1px solid #2c2d37;border-radius:14px;background:#12131a;padding:17px;min-width:0}.adminCardHeading{display:flex;align-items:center;justify-content:space-between;gap:10px}.adminCardHeading h3,.adminModuleCard h3{font-size:14px;margin:0}.adminCardHeading>span{font-size:9px;letter-spacing:.1em;color:#777a88}.adminCardHeading button{border:0;background:transparent;color:#ff929a;font-size:11px;cursor:pointer}.adminEmptyChart{height:130px;display:grid;place-items:center;text-align:center;padding:20px;color:#747785;font-size:12px;border-bottom:1px solid #24252e}.adminEmptyText{color:#858795;font-size:12px;padding:22px 0 5px}.adminServiceRows{display:grid;gap:0;margin-top:14px}.adminServiceRows>div{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-top:1px solid #252630;font-size:12px;text-transform:capitalize}.adminServiceRows b{font-size:10px;font-weight:700}.serviceConnected{color:#77d6a0}.serviceUnknown{color:#a9aaba}.adminQuickActions{margin-top:13px}.adminQuickActions>div:last-child{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin-top:15px}.adminQuickActions button{display:flex;justify-content:space-between;align-items:center;gap:8px;text-align:left;border:1px solid #333540;border-radius:10px;background:#1a1b24;color:#e4e4eb;padding:12px;font-size:12px;cursor:pointer}.adminQuickActions button:hover{border-color:#a83b4b;background:#281a20}.adminQuickActions button span{color:#ff8a94}.adminChartBars{height:145px;display:flex;align-items:end;gap:8px;padding:14px 3px 0;overflow-x:auto}.adminBarColumn{height:100%;min-width:24px;flex:1;display:flex;flex-direction:column;justify-content:end;align-items:center;gap:7px}.adminBar{width:min(100%,34px);min-height:4px;border-radius:6px 6px 2px 2px;background:linear-gradient(180deg,#ff858e,#a72b40);box-shadow:0 0 14px #e64c5b24}.adminBarColumn small{font-size:9px;color:#858795}.adminDataRows{display:grid;gap:0;margin-top:12px}.adminDataRows>div{display:flex;justify-content:space-between;padding:11px 2px;border-top:1px solid #272832;color:#bfc0ca;font-size:12px}.adminDataRows strong{color:#fff}.adminRecentRows{display:grid;margin-top:10px}.adminRecentRows>div{display:grid;gap:4px;padding:10px 0;border-top:1px solid #272832}.adminRecentRows strong{font-size:12px;text-transform:capitalize}.adminRecentRows small{font-size:10px;color:#858795}.adminUserToolbar{display:flex;align-items:end;justify-content:space-between;gap:14px;margin-bottom:15px}.adminUserToolbar label{display:grid;gap:7px;flex:1;color:#aeb0bc;font-size:11px}.adminUserToolbar input{width:100%;background:#0b0c12;border:1px solid #3b3d49;border-radius:9px;color:#fff;padding:10px;font:inherit}.adminUserToolbar>span{font-size:11px;color:#9294a1;white-space:nowrap}.adminUserList{display:grid}.adminUserList article{display:grid;grid-template-columns:minmax(170px,1.5fr) minmax(70px,.55fr) minmax(90px,.7fr) minmax(130px,1fr) auto;gap:12px;align-items:center;padding:13px 0;border-top:1px solid #2b2c35}.adminUserList article>div{display:grid;gap:5px;min-width:0}.adminUserList small{font-size:9px;color:#858795}.adminUserList strong{font-size:11px;overflow-wrap:anywhere}.adminUserIdentity{display:flex!important;align-items:center;gap:10px}.adminUserIdentity>span{width:34px;height:34px;flex:none;border-radius:50%;display:grid;place-items:center;background:#3a2029;color:#ff9ba4;font-weight:800}.adminUserIdentity>div{display:grid;gap:4px;min-width:0}.adminUserIdentity small{overflow-wrap:anywhere}.adminUserActive{color:#77d6a0}.adminUserSuspended{color:#ff9ba4}.adminUserList details{position:relative;font-size:10px;color:#aeb0bc}.adminUserList summary{cursor:pointer}.adminUserList details code{display:block;max-width:180px;overflow-wrap:anywhere;margin-top:6px;color:#c5c6d0}.adminUserList article>details{grid-column:auto}@media(max-width:850px){.adminUserList article{grid-template-columns:1fr 1fr}.adminUserIdentity{grid-column:1/-1}.adminUserList article>details{grid-column:1/-1}.adminUserToolbar{align-items:stretch;flex-direction:column}}.adminPaymentFilters{display:grid;grid-template-columns:minmax(0,2fr) minmax(170px,1fr);gap:12px;margin-bottom:16px}.adminPaymentFilters label{display:grid;gap:7px;color:#aeb0bc;font-size:11px}.adminPaymentFilters input,.adminPaymentFilters select{width:100%;min-width:0;background:#0b0c12;border:1px solid #3b3d49;border-radius:9px;color:#fff;padding:10px;font:inherit}.adminPaymentList{display:grid}.adminPaymentList article{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(90px,.6fr) minmax(0,1.2fr);gap:12px;align-items:center;padding:13px 0;border-top:1px solid #2b2c35}.adminPaymentList article>div{display:grid;gap:5px;min-width:0}.adminPaymentList strong{font-size:12px;overflow-wrap:anywhere}.adminPaymentList small{font-size:10px;color:#8f919e}.adminPaymentList code{font-size:10px;color:#b9bac5;overflow-wrap:anywhere}@media(max-width:600px){.adminPaymentFilters{grid-template-columns:1fr}.adminPaymentList article{grid-template-columns:1fr 1fr}.adminPaymentList article>div:last-child{grid-column:1/-1}}.adminActivitySearch{display:grid;gap:7px;color:#aeb0bc;font-size:11px;margin-bottom:15px}.adminActivitySearch input{background:#0b0c12;border:1px solid #3b3d49;border-radius:9px;color:#fff;padding:10px;font:inherit}.adminActivityList{display:grid}.adminActivityList article{padding:13px 0;border-top:1px solid #2b2c35}.adminActivityList article>div{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}.adminActivityList article strong{font-size:13px;text-transform:capitalize}.adminActivityList article small,.adminActivityList time{font-size:10px;color:#8f919e}.adminActivityList time{display:block;margin-top:6px}.adminActivityList article p{font-size:11px;color:#9da0ad;overflow-wrap:anywhere;margin:7px 0 0}.adminModuleIntro{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:20px}.adminBuildBadge{font-size:9px;letter-spacing:.1em;border:1px solid #72532d;background:#302516;color:#edc78c;padding:7px 9px;border-radius:20px}.adminModuleCard{max-width:850px}.adminModuleCard ul{display:grid;gap:12px;padding-left:20px;color:#d3d4dc;font-size:13px;line-height:1.5}.adminModuleCard li::marker{color:#ff7b86}.adminModuleCard .adminHint{border-top:1px solid #30313b;padding-top:14px;margin-top:18px}.adminScrim{display:none}
        @media(max-width:1050px){.adminShell{grid-template-columns:230px minmax(0,1fr)}.adminSidebar{padding-inline:10px}.adminMetricGrid{grid-template-columns:repeat(2,minmax(0,1fr))}.adminEmail{display:none}}
        @media(max-width:760px){.adminShell{display:block}.adminSidebar{position:fixed;z-index:50;inset:0 auto 0 0;width:min(82vw,300px);height:100dvh;transform:translateX(-105%);transition:transform .22s ease}.adminSidebar.adminSidebarOpen{transform:translateX(0)}.adminScrim{display:block;position:fixed;z-index:40;inset:0;border:0;background:#000a}.adminMobileToggle{display:block}.adminTopbar{height:72px;padding:0 15px}.adminTopbar h1{font-size:18px}.adminContent{padding:17px 13px 28px}.adminWelcome,.adminModuleIntro{align-items:flex-start;flex-direction:column}.adminDateBar>div{width:100%}.adminDateBar label{flex:1;min-width:120px}.adminDateBar input{width:100%}.adminPanelGrid{grid-template-columns:1fr}.adminQuickActions>div:last-child{grid-template-columns:repeat(2,minmax(0,1fr))}.adminTopRight{gap:0}.adminMetricGrid{gap:9px}.adminMetric{padding:13px;min-height:115px}.adminMetric strong{font-size:20px}}
        @media(max-width:420px){.adminMetricGrid{grid-template-columns:1fr 1fr}.adminMetric{grid-template-columns:24px 1fr;gap:6px}.adminMetricIcon{width:24px;height:24px}.adminMetric small{font-size:10px}.adminMetric strong{font-size:18px}.adminQuickActions>div:last-child{grid-template-columns:1fr}.adminGateCard{padding:23px}}
      `}</style>
    </main>
  );
}
