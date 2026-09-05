// frontend/src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en" className="dark">
      <body className="antialiased selection:bg-brand-sky selection:text-obsidian-950">
        {children}
      </body>
    </html>
  );
}
