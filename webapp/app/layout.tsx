import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nanomaterial Equipment Ontology",
  description: "Search research equipment, compare product variants, and curate source-linked metadata.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
