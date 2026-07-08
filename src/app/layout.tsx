import type { Metadata, Viewport } from "next";
import { Sora, Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const display = Sora({ subsets: ["latin"], variable: "--font-display", weight: ["400", "600", "700"] });
const body = Inter({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "Premier Clean & Seal — CRM",
  description: "Customer lifecycle CRM for Premier Clean & Seal.",
  icons: { icon: "/logo.png" },
};

// Explicit viewport control (rather than relying on Next's default tag) so
// standalone/full-screen use — the target for the planned PWA install — gets
// safe-area insets around notches/home indicators via viewport-fit=cover.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const content = (
    <html lang="en-GB" className={`${display.variable} ${body.variable}`}>
      <body className="font-sans">{children}</body>
    </html>
  );
  return clerkEnabled ? <ClerkProvider>{content}</ClerkProvider> : content;
}
