import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PDF Tutor v2",
  description: "Turn any PDF into a guided, interactive lesson.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
