import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GapFinder AI — Academic Gap Identification & Revision Assistant",
  description: "Identify understanding gaps in your syllabus and study materials with AI diagnostics and targeted revision.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-white text-zinc-900 antialiased dark:bg-zinc-950 dark:text-zinc-100">
        {children}
      </body>
    </html>
  );
}
