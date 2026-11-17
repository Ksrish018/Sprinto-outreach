import type { Metadata } from "next";
import { IBM_Plex_Mono, Instrument_Sans } from "next/font/google";
import { KillBanner } from "@/components/KillBanner";
import { Nav } from "@/components/Nav";
import styles from "./layout.module.css";
import "./globals.css";

// Every page reads live data from Neon; nothing is prerendered at build time.
export const dynamic = "force-dynamic";

const instrument = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Sprinto Outreach",
  description: "Finds, researches and qualifies companies for Sprinto, and writes Gmail drafts for the Growth Lead.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${instrument.variable} ${plexMono.variable}`}>
      <body>
        <div className={styles.app}>
          <Nav />
          <main className={styles.main}>
            <KillBanner />
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
