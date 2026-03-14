import { FastifyInstance } from "fastify";
import { redis } from "../utils/redis";
import { db } from "../utils/db";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/", async (_request, reply) => {
    const checks = await Promise.allSettled([
      db.$queryRaw`SELECT 1`,
      redis.ping(),
    ]);

    const dbOk = checks[0].status === "fulfilled";
    const redisOk = checks[1].status === "fulfilled";
    const allOk = dbOk && redisOk;

    reply.status(allOk ? 200 : 503).send({
      status: allOk ? "ok" : "degraded",
      checks: {
        database: dbOk ? "ok" : "error",
        redis: redisOk ? "ok" : "error",
      },
      timestamp: new Date().toISOString(),
    });
  });
}
