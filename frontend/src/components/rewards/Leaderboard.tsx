"use client";

import { useState } from "react";
import { Trophy, Medal } from "lucide-react";

const TABS = ["Global", "Community", "Country"];

const MOCK_LEADERS = [
  { rank: 1, username: "nova_creates", xp: 124000, level: 87, country: "US" },
  { rank: 2, username: "soundwave_dao", xp: 98500, level: 72, country: "UK" },
  { rank: 3, username: "cryptovlogger", xp: 87200, level: 65, country: "DE" },
  { rank: 4, username: "pixel_prophet", xp: 61000, level: 51, country: "JP" },
  { rank: 5, username: "artblock_alice", xp: 54000, level: 46, country: "CA" },
  { rank: 6, username: "defi_dan", xp: 48900, level: 42, country: "AU" },
  { rank: 7, username: "nft_nina", xp: 43100, level: 39, country: "FR" },
  { rank: 8, username: "gamefi_greg", xp: 38700, level: 36, country: "KR" },
  { rank: 9, username: "melody_maker", xp: 34200, level: 33, country: "BR" },
  { rank: 10, username: "meta_marco", xp: 29800, level: 30, country: "IT" },
];

const MEDAL_COLORS = ["text-brand-warning", "text-gray-400", "text-amber-600"];

export function Leaderboard() {
  const [activeTab, setActiveTab] = useState("Global");

  return (
    <div className="card p-6 sticky top-24">
      <div className="flex items-center gap-2 mb-6">
        <Trophy className="w-5 h-5 text-brand-warning" />
        <h2 className="font-display font-bold text-xl text-text-primary">Leaderboard</h2>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-bg-secondary rounded-lg p-1">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === tab
                ? "bg-accent-primary text-white"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {MOCK_LEADERS.map((leader) => (
          <div key={leader.rank} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
            <div className="w-8 text-center flex-shrink-0">
              {leader.rank <= 3 ? (
                <Medal className={`w-5 h-5 mx-auto ${MEDAL_COLORS[leader.rank - 1]}`} />
              ) : (
                <span className="text-sm text-text-secondary font-mono">{leader.rank}</span>
              )}
            </div>
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
              {leader.username[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-text-primary truncate">@{leader.username}</div>
              <div className="text-xs text-text-secondary">Level {leader.level}</div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-xs font-mono font-bold text-accent-primary">
                {(leader.xp / 1000).toFixed(0)}K
              </div>
              <div className="text-[10px] text-text-secondary">XP</div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-white/5 text-center">
        <div className="text-xs text-text-secondary mb-2">Your rank this week</div>
        <div className="font-display text-2xl font-bold gradient-text">#342</div>
      </div>
    </div>
  );
}
