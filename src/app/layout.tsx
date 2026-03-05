import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/components/auth";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BalanceX - Retail Finance Manager",
  description: "A simple finance management system for retail shops",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${manrope.variable} font-sans antialiased text-sm`}>
        <AuthProvider>
          {children}
        </AuthProvider>
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
