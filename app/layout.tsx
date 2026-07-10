import type { Metadata } from "next";
import { Fraunces, Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import ThemeToggle from "@/components/ThemeToggle";

// Runs before paint to avoid a flash of the wrong theme: use the saved
// preference if set, otherwise pick by time of day (dark 7pm–7am).
const themeInit = `(function(){try{var s=localStorage.getItem('theme');var h=new Date().getHours();var d=s?s==='dark':(h<7||h>=19);if(d)document.documentElement.classList.add('dark');}catch(e){}})();`;

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Skunk Line — Cribbage Trip Tracker",
  description: "Live cribbage scoring and trip winnings tracker.",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${fraunces.variable} ${inter.variable} ${plexMono.variable} font-body grain min-h-screen`}
      >
        {/* Sets the theme class before paint to avoid a flash of wrong theme. */}
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        <ThemeToggle />
        {children}
      </body>
    </html>
  );
}
