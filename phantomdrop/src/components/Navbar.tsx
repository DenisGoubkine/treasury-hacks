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
    <nav className="border-b border-zinc-100 bg-white sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 h-12 flex items-center justify-between">
        <Link href="/" className="group">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-900 group-hover:text-[#00E100] transition-colors">
            PhantomDrop
          </span>
        </Link>

        <div className="hidden md:flex items-center">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`px-4 h-12 flex items-center text-xs uppercase tracking-widest transition-colors border-l border-zinc-100 ${
                pathname === href
                  ? "text-[#00E100]"
                  : "text-zinc-400 hover:text-zinc-900"
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
