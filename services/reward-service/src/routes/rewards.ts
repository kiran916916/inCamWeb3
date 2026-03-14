import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { redis } from "../utils/redis";
import { db } from "../utils/db";
import { rewardQueue } from "../utils/queue";

const XP_ACTIONS: Record<string, number> = {
  post_content: 100,
  receive_like: 5,
  receive_comment: 10,
  buy_nft: 50,
  sell_nft: 30,
  hold_creator_pass: 20, // per day
  refer_user: 500,
  daily_login: 25,
  watch_premium: 15,
};

const STREAK_MULTIPLIERS = [1, 1.1, 1.2, 1.3, 1.5, 1.7, 2.0, 2.0, 2.0, 2.5, 2.5, 2.5, 3.0];

function getStreakMultiplier(streak: number): number {
  const idx = Math.min(Math.floor(streak / 3), STREAK_MULTIPLIERS.length - 1);
  return STREAK_MULTIPLIERS[idx];
}

// Rate-limit keys for anti-cheat
async function checkActionRateLimit(userId: string, action: string): Promise<boolean> {
  const key = `rl:xp:${userId}:${action}:${new Date().toISOString().slice(0, 10)}`;
  const limits: Record<string, number> = {
    receive_like: 50,
    receive_comment: 20,
    watch_premium: 10,
    refer_user: 5,
  };
  const limit = limits[action] ?? 999;
  const current = await redis.incr(key);
  if (current === 1) await redis.expire(key, 86400);
  return current <= limit;
}

const AwardXPSchema = z.object({
  userId: z.string().cuid(),
  action: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
});

export async function rewardRoutes(app: FastifyInstance) {
  // POST /api/rewards/xp — award XP for an action
  app.post(
    "/xp",
    { preHandler: [app.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = AwardXPSchema.safeParse(request.body);
      if (!parsed.success) return reply.status(400).send({ error: "Invalid request" });

      const { userId, action } = parsed.data;
      const baseXP = XP_ACTIONS[action];
      if (!baseXP) return reply.status(400).send({ error: `Unknown action: ${action}` });

      // Anti-cheat: rate limit check
      const allowed = await checkActionRateLimit(userId, action);
      if (!allowed) {
        return reply.status(429).send({ error: "XP action rate limit exceeded for today" });
      }

      // Get streak multiplier
      const user = await db.user.findUnique({ where: { id: userId }, select: { streak: true, xp: true, level: true } });
      if (!user) return reply.status(404).send({ error: "User not found" });

      const multiplier = getStreakMultiplier(user.streak);
      const xpToAward = Math.floor(baseXP * multiplier);

      // Update XP and level
      const newXP = user.xp + xpToAward;
      const newLevel = calculateLevel(newXP);

      await db.user.update({
        where: { id: userId },
        data: { xp: newXP, level: newLevel },
      });

      // Update leaderboard in Redis sorted set
      await redis.zincrby("leaderboard:global", xpToAward, userId);
      await redis.zincrby(`leaderboard:weekly:${getWeekKey()}`, xpToAward, userId);

      // Queue badge check asynchronously
      await rewardQueue.add("check-badges", { userId, action, newXP, newLevel });

      return reply.send({ xpAwarded: xpToAward, newXP, newLevel, multiplier });
    }
  );

  // POST /api/rewards/claim-quest — claim completed quest reward (idempotent)
  app.post(
    "/claim-quest",
    { preHandler: [app.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const schema = z.object({ questId: z.string(), userId: z.string().cuid() });
      const parsed = schema.safeParse(request.body);
      if (!parsed.success) return reply.status(400).send({ error: "Invalid request" });

      const { questId, userId } = parsed.data;
      const dateBucket = new Date().toISOString().slice(0, 10);

      // Check if already claimed — database-level unique constraint
      const userQuest = await db.userQuest.findUnique({
        where: { userId_questId_dateBucket: { userId, questId, dateBucket } },
        include: { quest: true },
      });

      if (!userQuest) return reply.status(404).send({ error: "Quest not found or not started" });
      if (userQuest.claimedAt) return reply.send({ alreadyClaimed: true, claimedAt: userQuest.claimedAt });
      if (!userQuest.completedAt) return reply.status(400).send({ error: "Quest not completed yet" });

      // Mark as claimed
      await db.userQuest.update({
        where: { id: userQuest.id },
        data: { claimedAt: new Date() },
      });

      // Queue on-chain token reward (badge minting async, never block user)
      if (userQuest.quest.tokenReward !== "0") {
        await rewardQueue.add("on-chain-reward", {
          userId,
          questId,
          tokenAmount: userQuest.quest.tokenReward,
          rewardId: `quest:${userId}:${questId}:${dateBucket}`,
        });
      }

      return reply.send({ success: true, xpRewarded: userQuest.quest.xpReward });
    }
  );
}

function calculateLevel(xp: number): number {
  const thresholds = [0, 100, 250, 500, 1000, 2000, 4000, 8000, 16000, 30000, 50000];
  let level = 1;
  for (let i = 1; i < thresholds.length; i++) {
    if (xp >= thresholds[i]) level = i + 1;
    else break;
  }
  return level;
}

function getWeekKey(): string {
  const now = new Date();
  const week = Math.floor(now.getTime() / (7 * 24 * 3600 * 1000));
  return String(week);
}
