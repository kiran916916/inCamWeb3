import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { redis } from "../utils/redis";
import { db } from "../utils/db";

export async function leaderboardRoutes(app: FastifyInstance) {
  // GET /api/leaderboard/global?limit=50&offset=0
  app.get("/global", async (request: FastifyRequest, reply: FastifyReply) => {
    const { limit = 50, offset = 0 } = request.query as { limit?: number; offset?: number };
    const safeLimit = Math.min(Number(limit), 100);
    const safeOffset = Math.max(Number(offset), 0);

    // O(log N) range query on Redis sorted set
    const entries = await redis.zrevrangebyscore(
      "leaderboard:global",
      "+inf",
      "-inf",
      "WITHSCORES",
      "LIMIT",
      safeOffset,
      safeLimit
    );

    const leaders = [];
    for (let i = 0; i < entries.length; i += 2) {
      const userId = entries[i];
      const xp = parseInt(entries[i + 1]);
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { id: true, username: true, walletAddress: true, level: true },
      });
      if (user) {
        leaders.push({ rank: safeOffset + Math.floor(i / 2) + 1, ...user, xp });
      }
    }

    return reply.send({ leaders });
  });

  // GET /api/leaderboard/weekly
  app.get("/weekly", async (request: FastifyRequest, reply: FastifyReply) => {
    const weekKey = getWeekKey();
    const entries = await redis.zrevrangebyscore(
      `leaderboard:weekly:${weekKey}`,
      "+inf",
      "-inf",
      "WITHSCORES",
      "LIMIT",
      0,
      10
    );

    const leaders = [];
    for (let i = 0; i < entries.length; i += 2) {
      const userId = entries[i];
      const xp = parseInt(entries[i + 1]);
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { id: true, username: true, level: true },
      });
      if (user) leaders.push({ rank: Math.floor(i / 2) + 1, ...user, xp });
    }

    return reply.send({ leaders, weekKey });
  });

  // GET /api/leaderboard/rank/:userId
  app.get("/rank/:userId", async (request: FastifyRequest<{ Params: { userId: string } }>, reply: FastifyReply) => {
    const { userId } = request.params;
    const rank = await redis.zrevrank("leaderboard:global", userId);
    const xp = await redis.zscore("leaderboard:global", userId);

    return reply.send({
      userId,
      rank: rank !== null ? rank + 1 : null,
      xp: xp ? parseInt(xp) : 0,
    });
  });
}

function getWeekKey(): string {
  const week = Math.floor(Date.now() / (7 * 24 * 3600 * 1000));
  return String(week);
}
