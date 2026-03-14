"use client";

import { motion } from "framer-motion";
import { Flame, Shield } from "lucide-react";

const LEVEL_XP_THRESHOLDS = [0, 100, 250, 500, 1000, 2000, 4000, 8000, 16000, 30000, 50000];

function getLevelInfo(xp: number) {
  let level = 1;
  for (let i = 1; i < LEVEL_XP_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_XP_THRESHOLDS[i]) level = i + 1;
    else break;
  }
  const currentLevelXP = LEVEL_XP_THRESHOLDS[Math.min(level - 1, LEVEL_XP_THRESHOLDS.length - 1)];
  const nextLevelXP = LEVEL_XP_THRESHOLDS[Math.min(level, LEVEL_XP_THRESHOLDS.length - 1)];
  const progress = nextLevelXP > currentLevelXP
    ? ((xp - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100
    : 100;
  return { level, currentLevelXP, nextLevelXP, progress, xpToNext: nextLevelXP - xp };
}

// Mock user state
const MOCK_USER = { xp: 3200, streak: 14, streakShields: 1 };

export function XPProgress() {
  const { level, progress, nextLevelXP, xpToNext } = getLevelInfo(MOCK_USER.xp);
  const streakMultiplier = Math.min(1 + (MOCK_USER.streak / 30) * 2, 3);

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-text-secondary text-sm mb-1">Your Progress</div>
          <div className="font-display text-3xl font-bold text-text-primary">
            Level <span className="gradient-text">{level}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-2xl font-bold text-text-primary">{MOCK_USER.xp.toLocaleString()} XP</div>
          <div className="text-xs text-text-secondary mt-0.5">{xpToNext.toLocaleString()} XP to Level {level + 1}</div>
        </div>
      </div>

      {/* XP bar */}
      <div className="relative mb-6">
        <div className="h-3 bg-bg-secondary rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="h-full rounded-full bg-gradient-to-r from-accent-primary to-accent-secondary"
          />
        </div>
        <div
          className="absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-accent-primary border-2 border-bg-primary shadow-glow-accent transition-all"
          style={{ left: `calc(${progress}% - 10px)` }}
        />
      </div>

      {/* Streak + Multiplier */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-bg-secondary rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
            <Flame className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <div className="font-display font-bold text-xl text-text-primary">{MOCK_USER.streak} days</div>
            <div className="text-xs text-text-secondary">Current Streak</div>
          </div>
        </div>
        <div className="bg-bg-secondary rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent-primary/20 flex items-center justify-center">
            <span className="text-lg font-display font-bold text-accent-primary">{streakMultiplier.toFixed(1)}×</span>
          </div>
          <div>
            <div className="font-display font-bold text-xl text-text-primary">XP Boost</div>
            <div className="flex items-center gap-1 text-xs text-text-secondary">
              <Shield className="w-3 h-3 text-accent-secondary" />
              {MOCK_USER.streakShields} shield{MOCK_USER.streakShields !== 1 ? "s" : ""}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
