"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Clock, CheckCircle, Lock } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";

interface NFT {
  id: string;
  tokenId: number;
  contractAddress: string;
  title: string;
  creator: { username: string; displayName: string; verified: boolean };
  thumbnail: string | null;
  price: string;
  currency: string;
  tier: string;
  contentType: string;
  royaltyBps: number;
  listed: boolean;
  listingType: string;
  auctionEnd: string | null;
}

export function NFTCard({ nft, viewMode = "grid" }: { nft: NFT; viewMode?: "grid" | "list" }) {
  const { isAuthenticated } = useAuth();
  const isPremium = nft.tier === "premium";
  const isAuction = nft.listingType === "auction";

  const timeLeft = nft.auctionEnd
    ? Math.max(0, new Date(nft.auctionEnd).getTime() - Date.now())
    : null;
  const hoursLeft = timeLeft ? Math.floor(timeLeft / (1000 * 3600)) : null;

  const contentTypeEmoji: Record<string, string> = {
    video: "🎬",
    image: "🖼",
    audio: "🎵",
    text: "📝",
  };

  if (viewMode === "list") {
    return (
      <Link href={`/nft/${nft.contractAddress}/${nft.tokenId}`} className="card-hover flex items-center gap-4 p-4">
        <div className="w-16 h-16 rounded-xl bg-gradient-cyber flex items-center justify-center text-2xl flex-shrink-0">
          {contentTypeEmoji[nft.contentType] || "🖼"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-text-primary truncate">{nft.title}</div>
          <div className="flex items-center gap-1 text-sm text-text-secondary mt-0.5">
            @{nft.creator.username}
            {nft.creator.verified && <CheckCircle className="w-3 h-3 text-accent-secondary" />}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="font-display font-bold text-text-primary">{nft.price} {nft.currency}</div>
          <div className="text-xs text-text-secondary mt-0.5">
            {isAuction ? "Current bid" : "Fixed price"}
          </div>
        </div>
        {isPremium && <span className="badge-premium flex-shrink-0">Premium</span>}
      </Link>
    );
  }

  return (
    <Link href={`/nft/${nft.contractAddress}/${nft.tokenId}`} className="nft-card block group">
      {/* Image area */}
      <div className="relative aspect-square overflow-hidden bg-bg-secondary">
        <div className="w-full h-full bg-gradient-to-br from-accent-primary/20 to-accent-secondary/20 flex items-center justify-center text-5xl transition-transform duration-500 group-hover:scale-110">
          {contentTypeEmoji[nft.contentType] || "🖼"}
        </div>

        {/* Tier badge overlay */}
        <div className="absolute top-3 left-3">
          {isPremium ? (
            <span className="badge-premium flex items-center gap-1">
              <Lock className="w-3 h-3" /> Premium
            </span>
          ) : (
            <span className="badge-free">Free</span>
          )}
        </div>

        {/* Auction countdown */}
        {isAuction && hoursLeft !== null && (
          <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-bg-primary/80 backdrop-blur-sm rounded-full px-2 py-1 text-xs text-brand-warning">
            <Clock className="w-3 h-3" />
            {hoursLeft}h left
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="p-4">
        <div className="flex items-center gap-1 text-xs text-text-secondary mb-2">
          @{nft.creator.username}
          {nft.creator.verified && <CheckCircle className="w-3 h-3 text-accent-secondary" />}
        </div>
        <h3 className="font-display font-semibold text-text-primary text-sm mb-3 truncate">
          {nft.title}
        </h3>

        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-text-secondary mb-0.5">{isAuction ? "Current bid" : "Price"}</div>
            <div className="font-display font-bold text-text-primary">
              {nft.price} <span className="text-accent-primary text-sm">{nft.currency}</span>
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="btn-primary py-2 px-4 text-xs"
            onClick={(e) => {
              e.preventDefault();
              // handled by link navigation to detail page
            }}
          >
            {isAuction ? "Bid" : "Buy"}
          </motion.button>
        </div>
      </div>
    </Link>
  );
}
