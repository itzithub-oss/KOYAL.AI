"use client";

import Link from "next/link";
import { notFound } from "next/navigation";

type Section = { heading: string; paragraphs?: string[]; bullets?: string[] };

const policies: Record<string, { title: string; intro: string; sections: Section[] }> = {
  "terms-and-conditions": {
    title: "Terms & Conditions",
    intro: "These terms govern access to and use of KOYAL AI, an AI-powered digital platform. By using the platform, you agree to these terms. If you do not agree, please do not use the service.",
    sections: [
      { heading: "1. About KOYAL AI", paragraphs: ["KOYAL AI is the service brand for the digital platform available at https://koyal-ai-india.vercel.app. The platform provides AI chat assistance, educational support, productivity tools, coding assistance and other digital features. For support, contact koyalaiindia@gmail.com."] },
      { heading: "2. Accounts and eligibility", paragraphs: ["You must provide accurate information when creating or using an account and keep your sign-in credentials secure. You are responsible for activity carried out through your account. Users who are minors should use the service with appropriate parent or guardian permission and involvement."] },
      { heading: "3. Acceptable use", bullets: ["Do not impersonate another person or submit false information.", "Do not use the platform for unlawful, harmful, deceptive or abusive activity.", "Do not attempt to bypass access controls, interfere with the service, introduce malicious code or exploit vulnerabilities.", "Do not access another user's account or data without permission."] },
      { heading: "4. Features and availability", paragraphs: ["Features, AI models, response modes, usage limits and availability may change as the platform is updated. We aim to keep KOYAL AI available but do not guarantee uninterrupted or error-free service. Maintenance, technical issues, third-party outages or security concerns may temporarily affect access."] },
      { heading: "5. Plans, pricing and payments", paragraphs: ["Available plans may include Just, Let It, Care, Elite and Supreme. The current price, billing period, included features, limits and applicable taxes will be shown before checkout. The checkout details shown when you place an order form part of that purchase. Payments are processed through the payment methods and providers displayed at checkout. Paid benefits are activated only after payment is successfully confirmed. A screenshot or unverified transaction reference alone is not proof of successful payment."] },
      { heading: "6. AI output disclaimer", paragraphs: ["AI-generated content can be inaccurate, incomplete, outdated or unsuitable for a particular purpose. You should independently verify important information. KOYAL AI is not a substitute for professional medical, legal, financial or other regulated advice. Do not rely only on AI output for emergency or high-impact decisions."] },
      { heading: "7. User content and intellectual property", paragraphs: ["You remain responsible for content you submit and must have the rights and permissions needed to submit it. You grant KOYAL AI permission to process that content as reasonably necessary to provide the features you request. The KOYAL AI name, branding, software, interface and original platform materials are owned by or licensed to the platform operator and may not be copied or commercially reused without permission, except where the law allows."] },
      { heading: "8. Suspension and termination", paragraphs: ["We may restrict or suspend access where reasonably necessary to protect users or the platform, address suspected fraud or abuse, comply with law, investigate a security issue or enforce these terms. Where practical, we will provide notice."] },
      { heading: "9. Third-party services", paragraphs: ["KOYAL AI may rely on third-party providers for AI processing, hosting, authentication, communications and payment processing. Those providers may have separate terms and privacy policies."] },
      { heading: "10. Changes and governing law", paragraphs: ["We may update these terms by publishing a revised version with a new update date. These terms are intended to be governed by the laws of India. Nothing in these terms limits rights that cannot legally be excluded, including applicable consumer rights."] },
      { heading: "11. Contact", paragraphs: ["Email: koyalaiindia@gmail.com", "Correspondence address: Pandapara, Bowbazar 8 No. Lane, Jalpaiguri, West Bengal, India."] },
    ],
  },
  "privacy-policy": {
    title: "Privacy Policy",
    intro: "This policy explains how KOYAL AI may collect, use, store and share information when you use the platform.",
    sections: [
      { heading: "1. Information we may collect", bullets: ["Account details such as name, email address and authentication identifiers.", "Prompts, chat messages, files and other content you choose to submit.", "Subscription and transaction records, including plan, payment status, amount, transaction reference and subscription dates.", "Technical information such as browser and device details, log data, security events and service usage.", "Messages you send to customer support."] },
      { heading: "2. How we use information", bullets: ["To provide chat, AI, account and other platform features.", "To authenticate users and protect account security.", "To process, verify and administer payments and subscriptions.", "To provide customer support and send service or subscription notices.", "To diagnose errors, prevent fraud, maintain the service and comply with legal obligations."] },
      { heading: "3. AI processing and service providers", paragraphs: ["To generate responses, the prompts and relevant content you submit may be processed by third-party AI providers, including Google AI services where enabled. KOYAL AI may also use service providers for hosting, authentication, application delivery and payment processing. Information shared with a provider is limited to what is reasonably needed for the relevant service. Providers process information under their own terms and privacy practices."] },
      { heading: "4. Payments", paragraphs: ["Payments are handled by the payment provider shown at checkout. KOYAL AI may receive payment status, transaction identifiers, amount, payment method details and related records. Do not send passwords, one-time passwords (OTPs), UPI PINs, full card numbers or banking credentials to KOYAL AI support."] },
      { heading: "5. Cookies and technical storage", paragraphs: ["The platform may use cookies, browser storage or similar technologies for sign-in sessions, preferences, security and core functionality. If additional analytics or advertising technologies are introduced, this policy will be updated as appropriate."] },
      { heading: "6. Sharing and disclosure", paragraphs: ["We may share information with service providers that help operate KOYAL AI, payment providers to complete transactions, professional advisers where necessary, or public authorities where disclosure is required by law. We do not sell personal information."] },
      { heading: "7. Security and retention", paragraphs: ["We use reasonable technical and organisational safeguards to protect information, but no online service can guarantee absolute security. Information is retained for as long as reasonably necessary for service delivery, account administration, security, dispute handling and legal or accounting requirements."] },
      { heading: "8. Your requests", paragraphs: ["Subject to applicable law and identity verification, you may contact us to request access to, correction of or deletion of personal information, or to raise a privacy concern. Some information may need to be retained for legal, security, accounting or dispute-resolution purposes."] },
      { heading: "9. Children and minors", paragraphs: ["KOYAL AI is not intended to knowingly collect children's personal information in a manner prohibited by applicable law. Minors should use the platform with appropriate parent or guardian involvement. A parent or guardian may contact us about a child's information."] },
      { heading: "10. Changes and contact", paragraphs: ["We may update this policy as the platform or applicable requirements change. The current version will be published on this page.", "Email: koyalaiindia@gmail.com", "Correspondence address: Pandapara, Bowbazar 8 No. Lane, Jalpaiguri, West Bengal, India."] },
    ],
  },
  "refund-and-cancellation": {
    title: "Refund & Cancellation Policy",
    intro: "This policy applies to KOYAL AI subscriptions and other paid digital services. It is subject to applicable consumer-protection laws and payment-provider rules.",
    sections: [
      { heading: "1. General refund rule", paragraphs: ["Except where a refund or other remedy is required by applicable law or where an exception below applies, payments for a successfully activated subscription are non-refundable. This includes change of mind, unused subscription time and failure to cancel before a scheduled automatic renewal."] },
      { heading: "2. Exceptions", paragraphs: ["We will review refund or reversal requests for confirmed duplicate charges, a payment collected where the subscription was not activated because of a verified payment or technical failure, unauthorised transactions as handled under applicable law, and any other situation where a refund is legally required. This policy does not remove statutory consumer rights."] },
      { heading: "3. Failed or pending payments", paragraphs: ["If money appears to have been debited but your plan is not active, email koyalaiindia@gmail.com with your registered email address, payment date, amount and transaction reference. We will check the payment status with the payment provider. If the payment is confirmed as failed, reversed or not received, the applicable reversal or refund will be handled through the payment provider."] },
      { heading: "4. Duplicate payments", paragraphs: ["If you are charged more than once for the same purchase, contact support with the transaction references. Confirmed duplicate payments will be reviewed and eligible duplicate amounts will be refunded through the original payment route where supported."] },
      { heading: "5. Cancelling automatic renewal", paragraphs: ["You may cancel an active recurring mandate using the cancellation method made available in your account or by the payment provider, or by contacting koyalaiindia@gmail.com for assistance. Cancel before the next scheduled debit to help prevent the next renewal. Once cancellation is confirmed by the payment provider, future automatic debits under that mandate should stop. Cancelling a mandate does not automatically refund a payment already processed. Unless required otherwise by law, access to an already-paid subscription generally continues until the end of its current billing period."] },
      { heading: "6. Refund processing", paragraphs: ["Where a refund is approved, it will generally be initiated to the original payment method where supported. The time taken for the funds to appear depends on the payment provider, bank and payment network."] },
      { heading: "7. How to contact us", paragraphs: ["Email koyalaiindia@gmail.com with the subject “Refund Request” or “Cancellation Request”. Include your registered email address, plan, purchase date, transaction reference and a brief explanation. Never send passwords, OTPs, UPI PINs, full card details or banking credentials."] },
    ],
  },
  "subscription-and-renewal": {
    title: "Subscription & Renewal Policy",
    intro: "This policy explains KOYAL AI subscription periods, plan benefits, automatic renewal and expiry.",
    sections: [
      { heading: "1. Plans and prices", paragraphs: ["KOYAL AI may offer Just, Let It, Care, Elite and Supreme plans. Current prices, taxes, features, usage limits and eligibility are displayed on the subscription and checkout pages. The details shown before payment apply to that purchase."] },
      { heading: "2. Billing period and activation", paragraphs: ["Paid plans are offered on a monthly billing basis. The renewal date, billing period and expiry date will be shown in your account or purchase confirmation. A plan is activated only after successful payment verification. If manual review is required, the plan remains pending until payment is confirmed."] },
      { heading: "3. Automatic renewal and consent", paragraphs: ["A paid subscription may renew automatically only after you have expressly authorised a recurring payment mandate through the payment provider. Before you consent, the checkout flow must clearly display the renewal amount, frequency, applicable taxes, mandate terms and cancellation method. If you do not authorise the recurring mandate, your subscription will not automatically renew."] },
      { heading: "4. Renewal charges and notices", paragraphs: ["Renewal charges are attempted according to the recurring mandate and the payment provider's applicable rules. KOYAL AI aims to send a reminder approximately two days before the displayed renewal or expiry date. Your bank or payment provider may also send a separate pre-debit notification under applicable mandate rules. Delivery of reminders depends on accurate contact details and functioning notification services."] },
      { heading: "5. Cancelling renewal", paragraphs: ["You can cancel the recurring mandate using the cancellation facility provided by KOYAL AI or the payment provider. Follow the confirmation steps and retain the cancellation confirmation. Cancellation should be completed before the next scheduled debit. If the mandate is cancelled or a renewal payment fails, the subscription is not treated as renewed unless payment is successfully completed."] },
      { heading: "6. Plan benefits", paragraphs: ["Eligible plans may include reduced feather consumption, access to selected AI thinking modes, Study Mode, Code Mode and other premium features. Study Mode and Code Mode may be available on Care and higher plans. Exact discounts, rounding rules, limits and feature access will be shown in the current plan comparison before purchase. Supreme benefits remain subject to any clearly disclosed fair-use and technical limitations."] },
      { heading: "7. Expiry and downgrade", paragraphs: ["If a paid subscription expires without a successful renewal, the account returns to the Just plan. Paid-plan benefits stop at expiry. Existing feather balances are retained and normal Just-plan feather rules apply thereafter. Expiry does not by itself reset the existing feather balance."] },
      { heading: "8. Upgrades and changes", paragraphs: ["Available plan upgrades or changes will be shown in the platform. Review the price, activation date, remaining validity and any effect on your existing plan before confirming a change. Any proration or carry-forward arrangement will be disclosed before payment."] },
      { heading: "9. Support", paragraphs: ["For subscription questions, email koyalaiindia@gmail.com. Do not send passwords, OTPs, UPI PINs or banking credentials."] },
    ],
  },
};

export function generateStaticParams() {
  return Object.keys(policies).map((slug) => ({ slug }));
}

export default async function PolicyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const policy = policies[slug];
  if (!policy) notFound();

  return (
    <main style={{ minHeight: "100vh", padding: "44px 18px 64px", background: "#09090f", color: "#f4f2f5" }}>
      <article style={{ maxWidth: 850, margin: "0 auto", border: "1px solid rgba(255,255,255,.12)", borderRadius: 22, padding: "clamp(22px, 5vw, 48px)", background: "linear-gradient(145deg, rgba(35,17,27,.96), rgba(15,15,24,.98))", boxShadow: "0 24px 80px rgba(0,0,0,.28)" }}>
        <Link href="/" style={{ color: "#ff718e", textDecoration: "none", fontSize: 13 }}>← Back to KOYAL AI</Link>
        <p style={{ margin: "28px 0 8px", color: "#ff829a", fontSize: 12, letterSpacing: 2, fontWeight: 700 }}>KOYAL AI · POLICY</p>
        <h1 style={{ margin: "0 0 12px", fontSize: "clamp(30px, 5vw, 42px)", lineHeight: 1.12 }}>{policy.title}</h1>
        <p style={{ color: "#c9c4ce", lineHeight: 1.75, fontSize: 16 }}>{policy.intro}</p>
        <p style={{ color: "#9e98a6", fontSize: 12, margin: "18px 0 34px" }}>Last updated: 21 November 2026</p>
        {policy.sections.map((section) => (
          <section key={section.heading} style={{ marginTop: 28 }}>
            <h2 style={{ fontSize: 19, margin: "0 0 10px", color: "#fff" }}>{section.heading}</h2>
            {section.paragraphs?.map((paragraph) => <p key={paragraph} style={{ color: "#d1ccd5", lineHeight: 1.8, margin: "0 0 10px", overflowWrap: "anywhere" }}>{paragraph}</p>)}
            {section.bullets && <ul style={{ color: "#d1ccd5", lineHeight: 1.8, paddingLeft: 22 }}>{section.bullets.map((bullet) => <li key={bullet} style={{ marginBottom: 7 }}>{bullet}</li>)}</ul>}
          </section>
        ))}
        <div style={{ borderTop: "1px solid rgba(255,255,255,.12)", marginTop: 42, paddingTop: 20, color: "#aaa3b0", fontSize: 13, lineHeight: 1.7 }}>
          KOYAL AI · <a href="mailto:koyalaiindia@gmail.com" style={{ color: "#ff829a" }}>koyalaiindia@gmail.com</a>
          <br />Pandapara, Bowbazar 8 No. Lane, Jalpaiguri, West Bengal, India
        </div>
      </article>
    </main>
  );
}
