"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import WalletConnect from "./WalletConnect";

const links = [
  { href: "/", label: "Home" },
  { href: "/order", label: "Order" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/doctor", label: "Doctor" },
  { href: "/courier", label: "Courier" },
  { href: "/receipts", label: "Receipts" },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-zinc-800 bg-black/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-purple-400 text-xl">👻</span>
          <span className="font-bold text-white tracking-tight">
            PhantomDrop
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-1">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                pathname === href
                  ? "bg-purple-600 text-white"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>

        <WalletConnect compact />
      </div>
    </nav>
  );
}
