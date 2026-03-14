"use client";

import { motion } from "framer-motion";

const MOCK_BADGES = [
  { id: "early_adopter", name: "Early Adopter", description: "Joined in the first month", emoji: "🚀", rarity: "legendary", earned: true },
  { id: "first_nft", name: "First Collector", description: "Purchased your first NFT", emoji: "🎴", rarity: "rare", earned: true },
  { id: "loyal_fan", name: "Loyal Fan", description: "Subscribed to a creator for 6 months", emoji: "💎", rarity: "epic", earned: true },
  { id: "trendsetter", name: "Trendsetter", description: "Had a post go viral", emoji: "🔥", rarity: "rare", earned: false },
  { id: "whale", name: "Whale", description: "Traded $10K+ volume", emoji: "🐋", rarity: "legendary", earned: false },
  { id: "diamond_collector", name: "Diamond Collector", description: "Hold 10+ NFTs", emoji: "💠", rarity: "epic", earned: false },
];

const RARITY_STYLES: Record<string, string> = {
  common: "border-white/20 bg-white/5",
  rare: "border-accent-primary/40 bg-accent-primary/10",
  epic: "border-accent-secondary/40 bg-accent-secondary/10",
  legendary: "border-brand-warning/40 bg-brand-warning/10",
};

const RARITY_TEXT: Record<string, string> = {
  common: "text-text-secondary",
  rare: "text-accent-primary",
  epic: "text-accent-secondary",
  legendary: "text-brand-warning",
};

export function BadgeCabinet() {
  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display font-bold text-xl text-text-primary">Badge Cabinet</h2>
        <span className="text-sm text-text-secondary">
          {MOCK_BADGES.filter((b) => b.earned).length}/{MOCK_BADGES.length} earned
        </span>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {MOCK_BADGES.map((badge, i) => (
          <motion.div
            key={badge.id}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            title={`${badge.name}: ${badge.description}`}
            className={`relative aspect-square rounded-xl border flex flex-col items-center justify-center p-2 transition-all
              ${RARITY_STYLES[badge.rarity]}
              ${badge.earned ? "cursor-default" : "opacity-30 grayscale cursor-not-allowed"}
            `}
          >
            <span className="text-3xl">{badge.emoji}</span>
            <span className={`text-[10px] font-semibold mt-1 text-center leading-tight ${RARITY_TEXT[badge.rarity]}`}>
              {badge.name}
            </span>
            {badge.earned && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-accent-secondary rounded-full" />
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
