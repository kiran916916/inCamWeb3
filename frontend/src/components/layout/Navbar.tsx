"use client";

import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useState } from "react";
import { Menu, X, Zap } from "lucide-react";

const NAV_LINKS = [
  { href: "/feed", label: "Feed" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/rewards", label: "Rewards" },
  { href: "/discover", label: "Discover" },
  { href: "/interview-prep", label: "Interview Prep" },
];

export function Navbar() {
  const { user, isAuthenticated } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-16 glass border-b border-white/5">
      <nav className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-display font-bold text-xl">
          <div className="w-8 h-8 bg-accent-primary rounded-lg flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="gradient-text">InCam</span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="btn-ghost text-sm">
              {link.label}
            </Link>
          ))}
          {isAuthenticated && (
            <Link href="/studio" className="btn-ghost text-sm">
              Studio
            </Link>
          )}
        </div>

        {/* Right side */}
        <div className="hidden md:flex items-center gap-3">
          {isAuthenticated && user && (
            <Link href="/profile" className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-bg-surface border border-white/10 hover:border-accent-primary/30 transition-colors">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-accent-primary to-accent-secondary" />
              <span className="text-sm font-medium text-text-primary">
                {user.username ?? `${user.walletAddress.slice(0, 6)}...${user.walletAddress.slice(-4)}`}
              </span>
              <span className="badge-premium text-xs">Lv.{user.level}</span>
            </Link>
          )}
          <ConnectButton showBalance={false} />
        </div>

        {/* Mobile menu toggle */}
        <button
          className="md:hidden btn-ghost p-2"
          onClick={() => setMobileOpen((o) => !o)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden glass border-t border-white/5 px-4 py-4 flex flex-col gap-2">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="btn-ghost justify-start"
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <div className="mt-2">
            <ConnectButton showBalance={false} />
          </div>
        </div>
      )}
    </header>
  );
}
