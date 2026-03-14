"use client";

import { motion } from "framer-motion";
import { Clock, Zap, CheckCircle, Trophy } from "lucide-react";

interface Quest {
  id: string;
  title: string;
  description: string;
  xpReward: number;
  tokenReward: number;
  progress: number;
  total: number;
  completed: boolean;
  type: "daily" | "weekly" | "seasonal";
  expiresIn: string;
}

const MOCK_QUESTS: Quest[] = [
  { id: "1", title: "Early Bird", description: "Log in before 9 AM", xpReward: 25, tokenReward: 0, progress: 1, total: 1, completed: true, type: "daily", expiresIn: "12h" },
  { id: "2", title: "Content Connoisseur", description: "Watch 5 premium videos today", xpReward: 50, tokenReward: 0, progress: 3, total: 5, completed: false, type: "daily", expiresIn: "8h" },
  { id: "3", title: "Social Butterfly", description: "Comment on 3 different creators' posts", xpReward: 30, tokenReward: 0, progress: 1, total: 3, completed: false, type: "daily", expiresIn: "8h" },
  { id: "4", title: "First Collector", description: "Purchase your first NFT this week", xpReward: 200, tokenReward: 10, progress: 0, total: 1, completed: false, type: "weekly", expiresIn: "4d" },
  { id: "5", title: "Community Champion", description: "Refer 2 friends who complete sign-up", xpReward: 500, tokenReward: 50, progress: 1, total: 2, completed: false, type: "weekly", expiresIn: "4d" },
];

const TYPE_COLORS = {
  daily: "text-accent-secondary bg-accent-secondary/10 border-accent-secondary/30",
  weekly: "text-accent-primary bg-accent-primary/10 border-accent-primary/30",
  seasonal: "text-brand-warning bg-brand-warning/10 border-brand-warning/30",
};

export function QuestBoard() {
  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display font-bold text-xl text-text-primary">Quest Board</h2>
        <div className="flex gap-2">
          <span className="badge text-xs bg-bg-secondary border border-white/10 text-text-secondary">Daily</span>
          <span className="badge text-xs bg-bg-secondary border border-white/10 text-text-secondary">Weekly</span>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {MOCK_QUESTS.map((quest, i) => (
          <motion.div
            key={quest.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`relative p-4 rounded-xl border transition-all ${
              quest.completed
                ? "bg-accent-secondary/5 border-accent-secondary/20 opacity-75"
                : "bg-bg-secondary border-white/10 hover:border-accent-primary/30"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  quest.completed ? "bg-accent-secondary/20" : "bg-bg-surface"
                }`}>
                  {quest.completed
                    ? <CheckCircle className="w-5 h-5 text-accent-secondary" />
                    : <Zap className="w-5 h-5 text-accent-primary" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-text-primary">{quest.title}</span>
                    <span className={`badge text-xs border ${TYPE_COLORS[quest.type]}`}>{quest.type}</span>
                  </div>
                  <p className="text-xs text-text-secondary mt-0.5">{quest.description}</p>

                  {/* Progress bar */}
                  {!quest.completed && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs text-text-secondary mb-1">
                        <span>{quest.progress}/{quest.total}</span>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{quest.expiresIn}</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-bg-surface rounded-full overflow-hidden">
                        <div
                          className="h-full bg-accent-primary rounded-full transition-all duration-500"
                          style={{ width: `${(quest.progress / quest.total) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="text-right flex-shrink-0">
                <div className="flex items-center gap-1 justify-end text-accent-primary font-semibold text-sm">
                  +{quest.xpReward} <span className="text-xs font-normal">XP</span>
                </div>
                {quest.tokenReward > 0 && (
                  <div className="flex items-center gap-1 justify-end text-brand-warning text-xs mt-0.5">
                    <Trophy className="w-3 h-3" />
                    +{quest.tokenReward} INCAM
                  </div>
                )}
                {quest.completed && (
                  <button className="mt-2 btn-secondary py-1 px-3 text-xs">Claim</button>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
