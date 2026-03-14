"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { NFTCard } from "./NFTCard";
import { Grid, List, Loader2 } from "lucide-react";

// Mock data — replaced by real API in production
const MOCK_NFTS = Array.from({ length: 12 }, (_, i) => ({
  id: String(i + 1),
  tokenId: i,
  contractAddress: "0x1234...abcd",
  title: `Creator Content #${i + 1}`,
  creator: { username: `creator_${i % 4}`, displayName: `Creator ${i % 4}`, verified: i % 3 === 0 },
  thumbnail: null,
  price: (Math.random() * 2000 + 50).toFixed(0),
  currency: "INCAM",
  tier: i % 3 === 0 ? "premium" : "freemium",
  contentType: ["video", "image", "audio", "text"][i % 4] as string,
  royaltyBps: 500,
  listed: true,
  listingType: i % 5 === 0 ? "auction" : "fixed",
  auctionEnd: i % 5 === 0 ? new Date(Date.now() + 1000 * 3600 * 24).toISOString() : null,
}));

export function MarketplaceGrid() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState("recent");
  const isLoading = false;

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="text-text-secondary text-sm">
          Showing <span className="text-text-primary font-medium">{MOCK_NFTS.length}</span> results
        </div>
        <div className="flex items-center gap-3">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="input-field py-2 text-sm w-auto"
          >
            <option value="recent">Most Recent</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
            <option value="trending">Trending</option>
          </select>
          <div className="flex items-center gap-1 bg-bg-surface rounded-lg p-1 border border-white/10">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-md transition-colors ${viewMode === "grid" ? "bg-accent-primary/20 text-accent-primary" : "text-text-secondary hover:text-text-primary"}`}
              aria-label="Grid view"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-md transition-colors ${viewMode === "list" ? "bg-accent-primary/20 text-accent-primary" : "text-text-secondary hover:text-text-primary"}`}
              aria-label="List view"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-accent-primary animate-spin" />
        </div>
      ) : (
        <motion.div
          layout
          className={viewMode === "grid"
            ? "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5"
            : "flex flex-col gap-4"
          }
        >
          {MOCK_NFTS.map((nft, i) => (
            <motion.div
              key={nft.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <NFTCard nft={nft} viewMode={viewMode} />
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
