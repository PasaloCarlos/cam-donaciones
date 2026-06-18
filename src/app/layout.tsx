import type { Metadata, Viewport } from "next";
import { Archivo_Black, Hanken_Grotesk } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const display = Archivo_Black({
  subsets: ["latin"],
  variable: "--font-display",
  weight: "400",
  display: "swap",
});

const body = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: "CAM Donaciones — Comedores Sociales de PR",
  description:
    "Sistema interno de gestión de donantes para Comedores Sociales de Puerto Rico.",
  other: { "darkreader-lock": "cam-donaciones" },
  openGraph: {
    title: "CAM Donaciones — Comedores Sociales de PR",
    description: "Gestión de donantes para Comedores Sociales de Puerto Rico.",
    type: "website",
    locale: "es_PR",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${display.variable} ${body.variable}`}>
      <body className="grain font-sans antialiased">
        {children}
        <Toaster position="top-center" theme="dark" richColors offset={{ top: "1.5rem" }} />
      </body>
    </html>
  );
}
