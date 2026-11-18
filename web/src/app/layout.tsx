import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Astranov SpaceNet",
  description:
    "Astranov.eu hub — SpaceNet globe continuum + Architect plot canvas MVP",
};

export const viewport: Viewport = {
  themeColor: "#02040a",
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
