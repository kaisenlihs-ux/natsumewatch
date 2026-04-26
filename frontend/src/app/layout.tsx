import type { Metadata, Viewport } from "next";
import { Rubik } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { PresenceProvider } from "@/components/PresenceProvider";

const rubik = Rubik({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-rubik",
  display: "swap",
});

export const metadata: Metadata = {
  title: "NatsumeWatch — смотри аниме онлайн",
  description:
    "Современный плеер аниме на основе AniLibria: онгоинги, каталог с фильтрами, обсуждения и рецензии.",
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#0a0613",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={rubik.variable}>
      <body>
        <PresenceProvider />
        <Header />
        <main className="container-page py-6 md:py-10">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
