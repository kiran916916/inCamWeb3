import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { redis } from "../utils/redis";
import { db } from "../utils/db";
import { rewardQueue } from "../utils/queue";

// Maps each trackable action to its base XP value.
// These values are applied before any streak multiplier.
// Add new actions here when new platform features are released.
const XP_ACTIONS: Record<string, number> = {
  post_content:      100,
  receive_like:        5,
  receive_comment:    10,
  buy_nft:            50,
  sell_nft:           30,
  hold_creator_pass:  20, // awarded daily per pass held
  refer_user:        500,
  daily_login:        25,
  watch_premium:      15,
};

// Streak multiplier table — index represents (streak_days / 3).
// A 0-2 day streak gives 1.0×, 3-5 days gives 1.1×, ..., 30+ days gives 3.0×.
// Capped at 3× to prevent excessive advantage over new users.
const STREAK_MULTIPLIERS = [1, 1.1, 1.2, 1.3, 1.5, 1.7, 2.0, 2.0, 2.0, 2.5, 2.5, 2.5, 3.0];

function getStreakMultiplier(streak: number): number {
  // Clamp the index to the table length so 100-day streaks still cap at 3×
  const idx = Math.min(Math.floor(streak / 3), STREAK_MULTIPLIERS.length - 1);
  return STREAK_MULTIPLIERS[idx];
}

/**
 * Anti-cheat rate limiter: checks how many times a user has performed a
 * given action today (UTC day boundary). Returns false if the limit is exceeded.
 *
 * Implementation: Redis INCR on a key that expires at midnight.
 * Each unique (userId, action, date) combination has its own counter.
 * The first INCR sets the counter to 1 and also schedules deletion.
 */
async function checkActionRateLimit(userId: string, action: string): Promise<boolean> {
  const today = new Date().toISOString().slice(0, 10); // e.g. "2024-01-15"
  const key   = `rl:xp:${userId}:${action}:${today}`;

  // Per-action daily limits — actions not in this map have a very high limit
  const limits: Record<string, number> = {
    receive_like:    50,   // can't farm XP from spamming likes across accounts
    receive_comment: 20,
    watch_premium:   10,
    refer_user:       5,
  };
  const limit   = limits[action] ?? 999;
  const current = await redis.incr(key);

  // Set the expiry only on the first increment (when counter transitions 0 → 1)
  if (current === 1) await redis.expire(key, 86400); // 24 hours

  return current <= limit;
}

// Input schema for XP award endpoint — validated before any business logic
const AwardXPSchema = z.object({
  userId: z.string().cuid(),                   // must be a valid CUID (from our DB)
  action: z.string().min(1),                   // must match a key in XP_ACTIONS
  metadata: z.record(z.unknown()).optional(),  // optional context (e.g. contentId)
});

export async function rewardRoutes(app: FastifyInstance) {

  // ── POST /api/rewards/xp ────────────────────────────────────────────────────
  // Awards XP to a user for completing a tracked action.
  //
  // Flow:
  //  1. Validate input
  //  2. Anti-cheat rate limit check (Redis)
  //  3. Fetch user's current streak → calculate multiplier
  //  4. Update XP + level in PostgreSQL
  //  5. Update Redis leaderboard sorted set (O log N)
  //  6. Queue async badge check (never blocks the HTTP response)
  app.post(
    "/xp",
    { preHandler: [app.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = AwardXPSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid request" });
      }

      const { userId, action } = parsed.data;

      // Look up the base XP for this action — reject unknown actions
      const baseXP = XP_ACTIONS[action];
      if (!baseXP) {
        return reply.status(400).send({ error: `Unknown action: ${action}` });
      }

      // Anti-cheat: reject if the user has performed this action too many times today
      const allowed = await checkActionRateLimit(userId, action);
      if (!allowed) {
        return reply.status(429).send({ error: "XP action rate limit exceeded for today" });
      }

      // Fetch only the fields we need to minimise DB read cost
      const user = await db.user.findUnique({
        where:  { id: userId },
        select: { streak: true, xp: true, level: true },
      });
      if (!user) return reply.status(404).send({ error: "User not found" });

      // Apply streak multiplier to base XP — floor to integer tokens
      const multiplier = getStreakMultiplier(user.streak);
      const xpToAward  = Math.floor(baseXP * multiplier);

      const newXP    = user.xp + xpToAward;
      const newLevel = calculateLevel(newXP); // check if XP crosses a level threshold

      // Persist XP and level atomically in one DB write
      await db.user.update({
        where: { id: userId },
        data:  { xp: newXP, level: newLevel },
      });

      // Update leaderboard in Redis — ZINCRBY is O(log N) and non-blocking
      // Two sorted sets: all-time global, and current week (resets weekly)
      await redis.zincrby("leaderboard:global",                    xpToAward, userId);
      await redis.zincrby(`leaderboard:weekly:${getWeekKey()}`,    xpToAward, userId);

      // Queue badge eligibility check in BullMQ.
      // The worker runs asynchronously and mints badges on-chain without blocking this request.
      await rewardQueue.add("check-badges", { userId, action, newXP, newLevel });

      return reply.send({ xpAwarded: xpToAward, newXP, newLevel, multiplier });
    },
  );

  // ── POST /api/rewards/claim-quest ──────────────────────────────────────────
  // Marks a completed quest as claimed and triggers any associated rewards.
  //
  // Idempotency: if the quest has already been claimed, returns { alreadyClaimed: true }
  // instead of an error. The client can safely retry this endpoint.
  //
  // The database-level unique constraint on (userId, questId, dateBucket) ensures
  // that even if two concurrent requests race, only one claim succeeds.
  app.post(
    "/claim-quest",
    { preHandler: [app.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const schema = z.object({
        questId: z.string(),
        userId:  z.string().cuid(),
      });
      const parsed = schema.safeParse(request.body);
      if (!parsed.success) return reply.status(400).send({ error: "Invalid request" });

      const { questId, userId } = parsed.data;

      // Date bucket prevents claiming the same daily quest more than once per calendar day
      const dateBucket = new Date().toISOString().slice(0, 10);

      // Look up the specific user-quest record for today
      const userQuest = await db.userQuest.findUnique({
        where: {
          userId_questId_dateBucket: { userId, questId, dateBucket },
        },
        include: { quest: true },
      });

      if (!userQuest) {
        return reply.status(404).send({ error: "Quest not found or not started" });
      }

      // Idempotent: if already claimed, return success without re-processing
      if (userQuest.claimedAt) {
        return reply.send({ alreadyClaimed: true, claimedAt: userQuest.claimedAt });
      }

      // Cannot claim a quest that is not yet complete
      if (!userQuest.completedAt) {
        return reply.status(400).send({ error: "Quest not completed yet" });
      }

      // Mark claimed — the DB unique constraint prevents a concurrent duplicate
      await db.userQuest.update({
        where: { id: userQuest.id },
        data:  { claimedAt: new Date() },
      });

      // If the quest has a token reward, queue an on-chain distribution.
      // This is done asynchronously — the user gets immediate UI feedback.
      if (userQuest.quest.tokenReward !== "0") {
        await rewardQueue.add("on-chain-reward", {
          userId,
          questId,
          tokenAmount: userQuest.quest.tokenReward,
          // Deterministic rewardId — same key used on-chain for idempotency
          rewardId: `quest:${userId}:${questId}:${dateBucket}`,
        });
      }

      return reply.send({ success: true, xpRewarded: userQuest.quest.xpReward });
    },
  );
}

/**
 * Converts a total XP value into a platform level (1–100).
 * Each level requires progressively more XP — this creates a meaningful progression curve.
 * The thresholds array defines the minimum XP required to reach each level.
 */
function calculateLevel(xp: number): number {
  const thresholds = [0, 100, 250, 500, 1000, 2000, 4000, 8000, 16000, 30000, 50000];
  let level = 1;
  for (let i = 1; i < thresholds.length; i++) {
    if (xp >= thresholds[i]) level = i + 1;
    else break;
  }
  return level;
}

/**
 * Returns a string identifier for the current ISO week (e.g. "2833").
 * Used as the key suffix for the weekly leaderboard sorted set in Redis.
 * A new key is created each week; the old key is manually flushed after settlement.
 */
function getWeekKey(): string {
  const week = Math.floor(Date.now() / (7 * 24 * 3600 * 1000));
  return String(week);
}
