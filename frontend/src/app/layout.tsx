import type { Metadata } from "next";
import { Syne, DM_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Navbar } from "@/components/layout/Navbar";
import { Toaster } from "@/components/ui/Toaster";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  weight: ["400", "500", "600", "700", "800"],
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
});

export const metadata: Metadata = {
  title: "InCam — Web3 Social & NFT Exchange",
  description:
    "The premier Web3 social platform where creators tokenise content as NFTs, fans earn rewards, and every interaction builds value.",
  keywords: ["NFT", "Web3", "Social Media", "Creator Economy", "Blockchain"],
  openGraph: {
    title: "InCam — Web3 Social & NFT Exchange",
    description: "Create, trade, and earn on the Web3 creator economy.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${syne.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-bg-primary text-text-primary font-body antialiased min-h-screen">
        <Providers>
          <Navbar />
          <main className="pt-16">{children}</main>
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
