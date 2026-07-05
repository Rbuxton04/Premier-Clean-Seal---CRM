import type { Metadata } from "next";
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

const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const content = (
    <html lang="en-GB" className={`${display.variable} ${body.variable}`}>
      <body className="font-sans">{children}</body>
    </html>
  );
  return clerkEnabled ? <ClerkProvider>{content}</ClerkProvider> : content;
}
