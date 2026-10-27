import "./globals.css";
export const viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };
export const metadata = { title: "IT HUB AI", description: "Your own AI assistant" };
export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="en"><body>{children}</body></html>;
}