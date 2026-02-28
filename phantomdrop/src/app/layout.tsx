import type { Metadata } from "next";
import { Space_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "PhantomDrop",
  description:
    "Anonymous pharmaceutical delivery. Private payments. Trustless escrow.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${spaceMono.className} bg-white text-zinc-900 min-h-screen`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
