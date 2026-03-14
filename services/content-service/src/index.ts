import Fastify from "fastify";
import fastifyCors from "@fastify/cors";
import fastifyHelmet from "@fastify/helmet";
import fastifyJwt, { FastifyJWTOptions } from "@fastify/jwt";
import fastifyRateLimit from "@fastify/rate-limit";
import * as dotenv from "dotenv";
import { contentRoutes } from "./routes/content";

dotenv.config();

const PORT = Number(process.env.PORT) || 3002;
const HOST = process.env.HOST || "0.0.0.0";

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || "info",
    transport: process.env.NODE_ENV === "development"
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
  },
  trustProxy: true,
});

async function bootstrap() {
  await app.register(fastifyHelmet, {
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  });

  await app.register(fastifyCors, {
    origin: (process.env.ALLOWED_ORIGINS || "http://localhost:3000").split(","),
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  });

  await app.register(fastifyRateLimit, {
    global: true,
    max: 100,
    timeWindow: "1 minute",
    keyGenerator: (request) => request.ip,
  });

  // Content service only needs JWT verification (public key), not signing
  await app.register(fastifyJwt, {
    secret: { public: process.env.JWT_PUBLIC_KEY || "" },
    verify: {
      algorithms: ["RS256"],
    },
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

  await app.register(contentRoutes, { prefix: "/api/content" });

  app.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error, path: request.url }, "Request error");
    const statusCode = error.statusCode ?? 500;
    reply.status(statusCode).send({
      statusCode,
      error: error.name || "Internal Server Error",
      message: statusCode < 500 ? error.message : "An unexpected error occurred",
    });
  });

  await app.listen({ port: PORT, host: HOST });
  app.log.info(`Content service listening on ${HOST}:${PORT}`);
}

bootstrap().catch((err) => {
  console.error("Failed to start content service:", err);
  process.exit(1);
});
