// frontend/src/app/layout.tsx
import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "The Lenny Growth Assistant",
  description: "Enterprise RAG assistant unlocking tactical frameworks from Lenny's Podcast transcripts with Ship 30 essays and sandboxed artifacts.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="antialiased selection:bg-brand-teal selection:text-white font-sans bg-obsidian-950 text-obsidian-100">
        {children}
      </body>
    </html>
  );
}
