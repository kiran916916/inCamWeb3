import { QuestBoard } from "@/components/rewards/QuestBoard";
import { BadgeCabinet } from "@/components/rewards/BadgeCabinet";
import { XPProgress } from "@/components/rewards/XPProgress";
import { Leaderboard } from "@/components/rewards/Leaderboard";

export const metadata = { title: "Reward Centre — InCam" };

export default function RewardsPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="font-display text-4xl font-bold text-text-primary mb-2">Reward Centre</h1>
        <p className="text-text-secondary">Complete quests, earn XP, collect badges, and climb the leaderboard</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <XPProgress />
          <QuestBoard />
          <BadgeCabinet />
        </div>

        {/* Right column */}
        <div>
          <Leaderboard />
        </div>
      </div>
    </div>
  );
}
