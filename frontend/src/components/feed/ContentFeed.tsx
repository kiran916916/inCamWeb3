"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Lock, Play, Image as ImageIcon, Music, FileText, Heart, MessageCircle, Share2, Zap } from "lucide-react";
import Link from "next/link";

type FeedFilter = "all" | "freemium" | "premium" | "following";

const CONTENT_TYPE_ICONS = {
  video: Play,
  image: ImageIcon,
  audio: Music,
  text: FileText,
};

const MOCK_FEED = [
  { id: "1", creator: { username: "nova_creates", displayName: "Nova Creates", verified: true }, title: "Behind the Canvas — My Latest Digital Art Collection", type: "image", tier: "freemium", thumbnail: null, likes: 1240, comments: 87, views: 48200, createdAt: "2h ago", teaser: "Sharing the process behind my latest NFT drop featuring neon cityscapes and cyberpunk aesthetics..." },
  { id: "2", creator: { username: "cryptovlogger", displayName: "CryptoVlogger", verified: true }, title: "Exclusive: Web3 Strategy Deep Dive 2024", type: "video", tier: "premium", thumbnail: null, likes: 890, comments: 234, views: 12100, createdAt: "5h ago", teaser: null },
  { id: "3", creator: { username: "soundwave_dao", displayName: "SoundWave DAO", verified: false }, title: "New Album Drop — Blockchain Beats Vol. 3", type: "audio", tier: "freemium", thumbnail: null, likes: 2100, comments: 156, views: 89300, createdAt: "1d ago", teaser: "Listen to the first track from our new album, available as a limited NFT collection..." },
  { id: "4", creator: { username: "pixel_prophet", displayName: "Pixel Prophet", verified: false }, title: "How I Made $50K from NFT Royalties in 6 Months", type: "text", tier: "premium", thumbnail: null, likes: 3400, comments: 412, views: 156000, createdAt: "2d ago", teaser: null },
];

export function ContentFeed() {
  const [filter, setFilter] = useState<FeedFilter>("all");

  const filtered = MOCK_FEED.filter((item) => {
    if (filter === "all" || filter === "following") return true;
    return item.tier === filter;
  });

  return (
    <div>
      {/* Filters */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {(["all", "following", "freemium", "premium"] as FeedFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              filter === f
                ? "bg-accent-primary text-white"
                : "bg-bg-surface text-text-secondary border border-white/10 hover:text-text-primary"
            }`}
          >
            {f === "all" ? "All Content" : f === "freemium" ? "Free" : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-5">
        {filtered.map((post, i) => {
          const TypeIcon = CONTENT_TYPE_ICONS[post.type as keyof typeof CONTENT_TYPE_ICONS] || ImageIcon;

          return (
            <motion.article
              key={post.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="card-hover p-5"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center text-sm font-bold text-white">
                    {post.creator.displayName[0]}
                  </div>
                  <div>
                    <div className="flex items-center gap-1">
                      <Link href={`/creator/${post.creator.username}`} className="font-semibold text-sm text-text-primary hover:text-accent-primary transition-colors">
                        {post.creator.displayName}
                      </Link>
                      {post.creator.verified && (
                        <span className="w-4 h-4 text-accent-secondary">✓</span>
                      )}
                    </div>
                    <div className="text-xs text-text-secondary">{post.createdAt}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {post.tier === "premium" ? (
                    <span className="badge-premium flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Premium
                    </span>
                  ) : (
                    <span className="badge-free">Free</span>
                  )}
                  <span className="badge bg-bg-secondary border border-white/10 text-text-secondary">
                    <TypeIcon className="w-3 h-3 inline mr-1" />{post.type}
                  </span>
                </div>
              </div>

              {/* Content */}
              <div className="mb-4">
                <Link href={`/content/${post.id}`}>
                  <h2 className="font-display font-bold text-lg text-text-primary mb-2 hover:text-accent-primary transition-colors">
                    {post.title}
                  </h2>
                </Link>

                {post.tier === "premium" && !post.teaser ? (
                  <div className="relative rounded-xl overflow-hidden bg-bg-secondary p-8 text-center border border-white/10">
                    <Lock className="w-8 h-8 text-accent-primary mx-auto mb-2" />
                    <p className="text-text-secondary text-sm mb-3">Premium content — unlock to view</p>
                    <button className="btn-primary text-sm px-5 py-2">
                      <Zap className="w-4 h-4" /> Unlock Access
                    </button>
                  </div>
                ) : (
                  <p className="text-text-secondary text-sm leading-relaxed">
                    {post.teaser}
                    {post.tier === "premium" && (
                      <span className="text-accent-primary ml-1 cursor-pointer hover:underline">
                        Read more →
                      </span>
                    )}
                  </p>
                )}
              </div>

              {/* Engagement */}
              <div className="flex items-center justify-between pt-4 border-t border-white/5">
                <div className="flex items-center gap-4">
                  <button className="btn-ghost text-sm flex items-center gap-1.5 py-1.5 px-3">
                    <Heart className="w-4 h-4" /> {post.likes.toLocaleString()}
                  </button>
                  <button className="btn-ghost text-sm flex items-center gap-1.5 py-1.5 px-3">
                    <MessageCircle className="w-4 h-4" /> {post.comments}
                  </button>
                  <button className="btn-ghost text-sm flex items-center gap-1.5 py-1.5 px-3">
                    <Share2 className="w-4 h-4" /> Share
                  </button>
                </div>
                <div className="text-xs text-text-secondary">
                  {post.views.toLocaleString()} views
                </div>
              </div>
            </motion.article>
          );
        })}
      </div>
    </div>
  );
}
