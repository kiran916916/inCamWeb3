"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { CheckCircle, Users } from "lucide-react";

const MOCK_CREATORS = [
  {
    id: "1",
    username: "nova_creates",
    displayName: "Nova Creates",
    avatar: null,
    subscribers: 48200,
    totalNFTs: 342,
    floorPrice: "120 INCAM",
    category: "Digital Art",
    verified: true,
  },
  {
    id: "2",
    username: "soundwave_dao",
    displayName: "SoundWave DAO",
    avatar: null,
    subscribers: 31500,
    totalNFTs: 198,
    floorPrice: "85 INCAM",
    category: "Music",
    verified: true,
  },
  {
    id: "3",
    username: "cryptovlogger",
    displayName: "CryptoVlogger",
    avatar: null,
    subscribers: 92100,
    totalNFTs: 507,
    floorPrice: "250 INCAM",
    category: "Video",
    verified: true,
  },
  {
    id: "4",
    username: "pixel_prophet",
    displayName: "Pixel Prophet",
    avatar: null,
    subscribers: 14300,
    totalNFTs: 89,
    floorPrice: "45 INCAM",
    category: "Photography",
    verified: false,
  },
];

function formatNumber(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}

export function FeaturedCreators() {
  return (
    <section className="py-20 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-end justify-between mb-12">
          <div>
            <div className="text-accent-primary text-sm font-semibold uppercase tracking-wider mb-2">
              Featured
            </div>
            <h2 className="section-header">Top Creators</h2>
          </div>
          <Link href="/discover" className="btn-ghost text-sm">
            View all →
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {MOCK_CREATORS.map((creator, i) => (
            <motion.div
              key={creator.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              <Link href={`/creator/${creator.username}`} className="card-hover block p-6 group">
                {/* Avatar */}
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent-primary to-accent-secondary mb-4 flex items-center justify-center text-2xl font-display font-bold text-white">
                  {creator.displayName[0]}
                </div>

                {/* Name */}
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="font-display font-bold text-text-primary group-hover:text-accent-primary transition-colors">
                    {creator.displayName}
                  </span>
                  {creator.verified && (
                    <CheckCircle className="w-4 h-4 text-accent-secondary flex-shrink-0" />
                  )}
                </div>
                <div className="text-text-secondary text-sm mb-4">@{creator.username}</div>

                {/* Category badge */}
                <div className="badge-free mb-4">{creator.category}</div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/5">
                  <div>
                    <div className="text-xs text-text-secondary mb-0.5">Subscribers</div>
                    <div className="font-semibold text-text-primary flex items-center gap-1">
                      <Users className="w-3 h-3" /> {formatNumber(creator.subscribers)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-text-secondary mb-0.5">Floor Price</div>
                    <div className="font-semibold text-accent-primary">{creator.floorPrice}</div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
