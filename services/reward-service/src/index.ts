import Fastify from "fastify";
import fastifyCors from "@fastify/cors";
import fastifyHelmet from "@fastify/helmet";
import fastifyJwt, { FastifyJWTOptions } from "@fastify/jwt";
import fastifyRateLimit from "@fastify/rate-limit";
import * as dotenv from "dotenv";
import { rewardRoutes } from "./routes/rewards";
import { questRoutes } from "./routes/quests";
import { leaderboardRoutes } from "./routes/leaderboard";
import { BadgeMintWorker } from "./workers/BadgeMintWorker";

dotenv.config();

const PORT = Number(process.env.PORT) || 3004;

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || "info",
    transport: process.env.NODE_ENV === "development" ? { target: "pino-pretty" } : undefined,
  },
  trustProxy: true,
});

async function bootstrap() {
  await app.register(fastifyHelmet, { contentSecurityPolicy: false });
  await app.register(fastifyCors, {
    origin: (process.env.ALLOWED_ORIGINS || "http://localhost:3000").split(","),
    credentials: true,
  });
  await app.register(fastifyRateLimit, {
    max: 1000, // authenticated endpoints get higher limits
    timeWindow: "1 minute",
    keyGenerator: (req) => (req.headers.authorization ? `auth:${req.ip}` : req.ip),
  });
  await app.register(fastifyJwt, {
    secret: { public: process.env.JWT_PUBLIC_KEY || "" },
    verify: { algorithms: ["RS256"] },
  } as FastifyJWTOptions);

  // Decorator for protecting routes — verifies JWT and attaches user to request
  app.decorate("authenticate", async (request: any, reply: any) => {
    try {
      await request.jwtVerify();
    } catch {
      reply.status(401).send({ error: "Unauthorized" });
    }
  });

  // Health check
  app.get("/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }));

  await app.register(rewardRoutes, { prefix: "/api/rewards" });
  await app.register(questRoutes, { prefix: "/api/quests" });
  await app.register(leaderboardRoutes, { prefix: "/api/leaderboard" });

  // Start background workers
  const badgeMintWorker = new BadgeMintWorker();
  badgeMintWorker.start();

  await app.listen({ port: PORT, host: "0.0.0.0" });
  app.log.info(`Reward service listening on port ${PORT}`);
}

bootstrap().catch((err) => {
  console.error("Failed to start reward service:", err);
  process.exit(1);
});
