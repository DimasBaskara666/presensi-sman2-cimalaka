/**
 * Presensi SMAN 2 Cimalaka
 * © 2026 Dimas Bratakusumah
 * Institut Teknologi Nasional Bandung
 */

import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "Presensi SMAN 2 Cimalaka",
    template: "%s | Presensi SMAN 2 Cimalaka",
  },
  description: "Sistem presensi siswa berbasis QR untuk SMAN 2 Cimalaka.",
  icons: {
    icon: "/logo/logo-color.png",
    shortcut: "/logo/logo-color.png",
    apple: "/logo/logo-color.png",
  },
  openGraph: {
    title: "Presensi SMAN 2 Cimalaka",
    description: "Sistem presensi siswa berbasis QR untuk SMAN 2 Cimalaka.",
    type: "website",
    images: [{ url: "/og.png", width: 1680, height: 945 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Presensi SMAN 2 Cimalaka",
    description: "Sistem presensi siswa berbasis QR untuk SMAN 2 Cimalaka.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" className={manrope.variable}>
      <body>{children}</body>
    </html>
  );
}
