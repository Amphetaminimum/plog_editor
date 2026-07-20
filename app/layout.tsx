import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Plog — Long content to polished design",
  description:
    "A local-first long-canvas editor for turning text and images into a polished, export-ready design.",
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
      <body>{children}</body>
    </html>
  );
}
