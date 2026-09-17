import type { Metadata } from "next";
import { Inter, Poppins } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Medisyn Compounding | Custom Compounded Medications, Delivered Across Canada",
  description:
    "Medisyn Compounding is a licensed Canadian compounding pharmacy crafting personalized medications for dermatology, pediatrics, hormone therapy, veterinary care and more — delivered to your door with free shipping on orders over $49.",
  keywords: [
    "compounding pharmacy",
    "custom compounded medication",
    "online pharmacy Canada",
    "prescription delivery Ontario",
    "Medisyn Compounding",
  ],
  openGraph: {
    title: "Medisyn Compounding",
    description:
      "Personalized compounded medications, crafted by licensed pharmacists and delivered across Canada.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${poppins.variable}`}>
      <body className="flex min-h-screen flex-col bg-white text-ink-900 antialiased">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
