"use client";

import { motion } from "framer-motion";
import { Upload, Coins, ShoppingCart, Trophy } from "lucide-react";

const steps = [
  {
    icon: Upload,
    title: "Creators Upload & Mint",
    description:
      "Upload videos, images, audio, or articles. Set your tier (free or premium), mint as an NFT, and your content lives on-chain forever.",
    color: "from-accent-primary/30 to-accent-primary/10",
    border: "border-accent-primary/30",
  },
  {
    icon: Coins,
    title: "Fans Access & Collect",
    description:
      "Browse free content without a wallet. Unlock premium drops by holding Creator Passes or paying per-view. Collect NFTs to invest in creators.",
    color: "from-accent-secondary/30 to-accent-secondary/10",
    border: "border-accent-secondary/30",
  },
  {
    icon: ShoppingCart,
    title: "Trade on the Exchange",
    description:
      "Buy, sell, and auction creator NFTs on the built-in marketplace. On-chain royalties ensure creators earn on every secondary sale.",
    color: "from-brand-warning/30 to-brand-warning/10",
    border: "border-brand-warning/30",
  },
  {
    icon: Trophy,
    title: "Earn Rewards",
    description:
      "Complete daily quests, maintain streaks, climb leaderboards, and earn INCAM tokens + soulbound achievement badges — all verified on-chain.",
    color: "from-accent-primary/30 to-accent-secondary/10",
    border: "border-accent-primary/30",
  },
];

export function HowItWorks() {
  return (
    <section className="py-20 px-4 bg-bg-secondary/30">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <div className="text-accent-primary text-sm font-semibold uppercase tracking-wider mb-3">
            How It Works
          </div>
          <h2 className="section-header mb-4">Four Steps to the Creator Economy</h2>
          <p className="text-text-secondary max-w-xl mx-auto">
            No crypto experience needed to start. Connect your wallet when you&apos;re ready to unlock the full ecosystem.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              className={`relative p-6 rounded-2xl bg-gradient-to-b ${step.color} border ${step.border}`}
            >
              <div className="absolute top-4 right-4 text-6xl font-display font-bold text-white/5">
                {i + 1}
              </div>
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${step.color} border ${step.border} flex items-center justify-center mb-5`}>
                <step.icon className="w-6 h-6 text-text-primary" />
              </div>
              <h3 className="font-display font-bold text-lg text-text-primary mb-3">{step.title}</h3>
              <p className="text-text-secondary text-sm leading-relaxed">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
