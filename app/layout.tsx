import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LLM Vibe Coding Arena",
  description: "Watch multiple LLMs compete to build the best Next.js website",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
