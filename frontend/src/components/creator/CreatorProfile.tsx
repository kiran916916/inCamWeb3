"use client";

import { motion } from "framer-motion";
import { CheckCircle, Users, Image, TrendingUp, Star } from "lucide-react";

// In production, fetched from API
const MOCK_CREATOR = {
  username: "nova_creates",
  displayName: "Nova Creates",
  bio: "Digital artist, NFT creator, and Web3 enthusiast. Turning pixels into provenance since 2021.",
  verified: true,
  level: 72,
  xp: 98500,
  subscribers: 48200,
  totalNFTs: 342,
  totalVolume: "142,800 INCAM",
  floorPrice: "120 INCAM",
  royaltyBps: 750, // 7.5%
  coverGradient: "from-accent-primary/40 via-bg-surface to-bg-primary",
};

const MOCK_NFTS = [
  { id: "1", title: "Neon City #1", price: "240 INCAM", tier: "premium" },
  { id: "2", title: "Digital Dreams", price: "180 INCAM", tier: "freemium" },
  { id: "3", title: "Pixel Portal #7", price: "890 INCAM", tier: "premium" },
  { id: "4", title: "Future Echo", price: "65 INCAM", tier: "freemium" },
  { id: "5", title: "Cyber Bloom", price: "1,200 INCAM", tier: "premium" },
  { id: "6", title: "Static Wave", price: "120 INCAM", tier: "freemium" },
];

export function CreatorProfile({ username }: { username: string }) {
  const creator = MOCK_CREATOR; // In production: useSWR(`/api/creators/${username}`)

  return (
    <div className="min-h-screen">
      {/* Cover */}
      <div className={`h-48 md:h-64 bg-gradient-to-br ${creator.coverGradient}`} />

      {/* Profile section */}
      <div className="max-w-6xl mx-auto px-4">
        <div className="relative -mt-16 mb-6 flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-6">
          {/* Avatar */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-28 h-28 rounded-2xl bg-gradient-to-br from-accent-primary to-accent-secondary border-4 border-bg-primary flex items-center justify-center text-4xl font-display font-bold text-white shadow-2xl flex-shrink-0"
          >
            {creator.displayName[0]}
          </motion.div>

          <div className="flex-1 pb-1">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="font-display text-2xl md:text-3xl font-bold text-text-primary">
                {creator.displayName}
              </h1>
              {creator.verified && <CheckCircle className="w-6 h-6 text-accent-secondary" />}
              <span className="badge-premium">Lv.{creator.level}</span>
            </div>
            <div className="text-text-secondary text-sm">@{creator.username}</div>
          </div>

          <div className="flex gap-3">
            <button className="btn-secondary">Subscribe</button>
            <button className="btn-primary">Collect NFTs</button>
          </div>
        </div>

        {/* Bio */}
        <p className="text-text-secondary mb-6 max-w-2xl">{creator.bio}</p>

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { icon: Users, label: "Subscribers", value: creator.subscribers.toLocaleString() },
            { icon: Image, label: "NFTs Created", value: creator.totalNFTs.toString() },
            { icon: TrendingUp, label: "Total Volume", value: creator.totalVolume },
            { icon: Star, label: "Floor Price", value: creator.floorPrice },
          ].map((stat) => (
            <div key={stat.label} className="card p-4">
              <div className="flex items-center gap-2 text-text-secondary text-xs mb-1">
                <stat.icon className="w-3.5 h-3.5" /> {stat.label}
              </div>
              <div className="font-display font-bold text-lg text-text-primary">{stat.value}</div>
            </div>
          ))}
        </div>

        {/* NFT Collection */}
        <div className="mb-10">
          <h2 className="font-display text-xl font-bold text-text-primary mb-4">NFT Collection</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {MOCK_NFTS.map((nft, i) => (
              <motion.div
                key={nft.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className="nft-card"
              >
                <div className="aspect-square bg-gradient-to-br from-accent-primary/20 to-accent-secondary/20 rounded-t-xl flex items-center justify-center text-3xl">
                  🎨
                </div>
                <div className="p-2">
                  <div className="text-xs font-medium text-text-primary truncate">{nft.title}</div>
                  <div className="text-xs text-accent-primary mt-0.5">{nft.price}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
