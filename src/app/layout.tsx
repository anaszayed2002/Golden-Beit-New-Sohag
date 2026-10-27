import type { Metadata, Viewport } from "next";
import { Almarai } from "next/font/google";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import MobileBar from "@/components/MobileBar";
import { WhatsAppIcon } from "@/components/Icons";
import { SITE, waLink } from "@/lib/site";
import "./globals.css";

const almarai = Almarai({ subsets: ["arabic"], weight: ["400", "700", "800"], variable: "--font-almarai", display: "swap" });

export const metadata: Metadata = {
  title: { default: "جولدن بيت سوهاج الجديدة", template: "%s · جولدن بيت سوهاج الجديدة" },
  description: "أراضي مجاورات سوهاج الجديدة، متوسط ومتميز، معروضة من أصحابها عن طريق جولدن بيت.",
  icons: { icon: "/logo-white.png" },
};

export const viewport: Viewport = { themeColor: "#0A3022", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={almarai.variable}>
      <body>
        <Header />
        {children}
        <Footer />
        <MobileBar />
        <a className="fab" href={waLink("أهلاً جولدن بيت، عايز أستفسر عن أراضي سوهاج الجديدة")} target="_blank" rel="noopener" aria-label={`كلّمنا واتساب ${SITE.phone}`}>
          <WhatsAppIcon />
        </a>
      </body>
    </html>
  );
}
