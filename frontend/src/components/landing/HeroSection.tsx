"use client";

import { motion } from "framer-motion";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { ArrowRight, Play, Zap } from "lucide-react";

export function HeroSection() {
  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden px-4 py-20">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-accent-secondary/10 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent-primary/5 rounded-full blur-3xl" />
      </div>

      {/* Grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(124,58,237,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.5) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      <div className="relative z-10 max-w-6xl mx-auto text-center">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent-primary/10 border border-accent-primary/30 text-accent-primary text-sm font-medium mb-8"
        >
          <Zap className="w-4 h-4" />
          <span>Web3 Creator Economy — Now Live on Polygon</span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="font-display text-5xl md:text-7xl font-bold leading-tight mb-6"
        >
          <span className="text-text-primary">Own Your Content.</span>
          <br />
          <span className="gradient-text">Trade Your Influence.</span>
          <br />
          <span className="text-text-primary">Earn Every Moment.</span>
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-text-secondary text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed"
        >
          The first social platform where every post is a tradeable NFT. Creators earn transparent royalties.
          Fans invest in creators they believe in. Every interaction builds real value.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
        >
          <ConnectButton.Custom>
            {({ openConnectModal, connected }) =>
              connected ? (
                <Link href="/feed" className="btn-primary text-base px-8 py-4">
                  Explore Feed <ArrowRight className="w-4 h-4" />
                </Link>
              ) : (
                <button onClick={openConnectModal} className="btn-primary text-base px-8 py-4">
                  Connect Wallet <ArrowRight className="w-4 h-4" />
                </button>
              )
            }
          </ConnectButton.Custom>

          <Link href="/marketplace" className="btn-secondary text-base px-8 py-4">
            Browse NFTs
          </Link>

          <Link href="/feed" className="btn-ghost text-base px-6 py-4">
            <Play className="w-4 h-4" /> Browse Free Content
          </Link>
        </motion.div>

        {/* Social proof */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="flex flex-wrap items-center justify-center gap-8 text-sm text-text-secondary"
        >
          {[
            { label: "Creators", value: "12,400+" },
            { label: "NFTs Minted", value: "284K+" },
            { label: "Total Volume", value: "$4.2M+" },
            { label: "Rewards Distributed", value: "18M+ INCAM" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="font-display text-2xl font-bold text-text-primary">{stat.value}</div>
              <div className="text-xs mt-0.5">{stat.label}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
