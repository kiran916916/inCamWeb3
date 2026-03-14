import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifyCors from "@fastify/cors";
import fastifyHelmet from "@fastify/helmet";
import fastifyJwt from "@fastify/jwt";
import fastifyRateLimit from "@fastify/rate-limit";
import * as dotenv from "dotenv";
import { authRoutes } from "./routes/auth";
import { healthRoutes } from "./routes/health";

dotenv.config();

const PORT = Number(process.env.PORT) || 3001;
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
  // Security headers
  await app.register(fastifyHelmet, {
    contentSecurityPolicy: false, // handled by Next.js
    crossOriginEmbedderPolicy: false,
  });

  // CORS — whitelist only allowed origins
  await app.register(fastifyCors, {
    origin: (process.env.ALLOWED_ORIGINS || "http://localhost:3000").split(","),
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  });

  // Cookies (httpOnly, Secure, SameSite=Strict in production)
  await app.register(fastifyCookie, {
    secret: process.env.COOKIE_SECRET || "change-me-in-production",
    hook: "onRequest",
  });

  // Rate limiting
  await app.register(fastifyRateLimit, {
    global: true,
    max: 100,
    timeWindow: "1 minute",
    keyGenerator: (request) => request.ip,
    errorResponseBuilder: () => ({
      statusCode: 429,
      error: "Too Many Requests",
      message: "Rate limit exceeded. Please try again later.",
    }),
  });

  // JWT with RS256 asymmetric keys
  await app.register(fastifyJwt, {
    secret: {
      private: process.env.JWT_PRIVATE_KEY || "",
      public: process.env.JWT_PUBLIC_KEY || "",
    },
    sign: {
      algorithm: "RS256",
      expiresIn: "15m",
      issuer: "incam-auth",
      audience: "incam-platform",
    },
    verify: {
      algorithms: ["RS256"],
      issuer: "incam-auth",
      audience: "incam-platform",
    },
  });

  // Routes
  await app.register(healthRoutes, { prefix: "/health" });
  await app.register(authRoutes, { prefix: "/api/auth" });

  // Global error handler
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
  app.log.info(`Auth service listening on ${HOST}:${PORT}`);
}

bootstrap().catch((err) => {
  console.error("Failed to start auth service:", err);
  process.exit(1);
});
