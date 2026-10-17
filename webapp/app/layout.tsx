import type { Metadata } from "next";
import "./globals.css";
import "./processes.css";
import "./process-workbench.css";
import "./process-theme.css";

export const metadata: Metadata = {
  title: "Nanomaterial Equipment Ontology",
  description: "Search research equipment, compare product variants, and curate source-linked metadata.",
  icons: {
    icon: { url: "/favicon.svg?v=icon-pcl-1", type: "image/svg+xml", sizes: "any" },
    shortcut: "/favicon.svg?v=icon-pcl-1",
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
