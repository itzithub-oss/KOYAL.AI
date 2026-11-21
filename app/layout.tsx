import Link from "next/link";
import "./globals.css";

export const viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };
export const metadata = { title: "KOYAL AI", description: "Your own AI assistant" };

const policyLinks = [
  { href: "/policies/terms-and-conditions", label: "Terms & Conditions" },
  { href: "/policies/privacy-policy", label: "Privacy Policy" },
  { href: "/policies/refund-and-cancellation", label: "Refund & Cancellation" },
  { href: "/policies/subscription-and-renewal", label: "Subscription & Renewal" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <footer style={{ padding: "18px 16px 24px", background: "#09090f", color: "#aaa3b0", borderTop: "1px solid rgba(255,255,255,.10)", textAlign: "center", fontSize: 12 }}>
          <nav aria-label="Legal policies" style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "10px 18px", maxWidth: 900, margin: "0 auto 10px" }}>
            {policyLinks.map((item) => (
              <Link key={item.href} href={item.href} style={{ color: "#ff829a", textDecoration: "none" }}>{item.label}</Link>
            ))}
          </nav>
          <span>© {new Date().getFullYear()} KOYAL AI · <a href="mailto:koyalaiindia@gmail.com" style={{ color: "inherit" }}>koyalaiindia@gmail.com</a></span>
        </footer>
      </body>
    </html>
  );
}
