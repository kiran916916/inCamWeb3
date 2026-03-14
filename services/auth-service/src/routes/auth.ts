import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { SiweMessage } from "siwe";
import { z } from "zod";
import { redis } from "../utils/redis";
import { db } from "../utils/db";
import { generateNonce, hashToken, generateRefreshToken } from "../utils/crypto";

const NONCE_TTL_SECONDS = 300; // 5 minutes — replay protection
const REFRESH_TTL_DAYS = 7;
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
};

const VerifySchema = z.object({
  message: z.string().min(1),
  signature: z.string().regex(/^0x[0-9a-fA-F]+$/),
});

export async function authRoutes(app: FastifyInstance) {
  // GET /api/auth/nonce — issue a fresh nonce per IP/session
  app.get("/nonce", async (request: FastifyRequest, reply: FastifyReply) => {
    const nonce = generateNonce();
    const key = `nonce:${nonce}`;
    await redis.setex(key, NONCE_TTL_SECONDS, "1");

    return reply.send({ nonce });
  });

  // POST /api/auth/verify — verify SIWE signature
  app.post("/verify", async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = VerifySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid request body", details: parsed.error.format() });
    }
    const { message: rawMessage, signature } = parsed.data;

    // 1. Parse and validate the SIWE message
    let siweMessage: SiweMessage;
    try {
      siweMessage = new SiweMessage(rawMessage);
    } catch {
      return reply.status(400).send({ error: "Invalid SIWE message format" });
    }

    // 2. Verify nonce has not been used and is still valid
    const nonceKey = `nonce:${siweMessage.nonce}`;
    const nonceValid = await redis.get(nonceKey);
    if (!nonceValid) {
      return reply.status(401).send({ error: "Nonce expired or already used" });
    }
    // Consume nonce (replay protection)
    await redis.del(nonceKey);

    // 3. Verify the cryptographic signature
    try {
      const fields = await siweMessage.verify({ signature, nonce: siweMessage.nonce });
      if (!fields.success) {
        return reply.status(401).send({ error: "Signature verification failed" });
      }
    } catch {
      return reply.status(401).send({ error: "Invalid signature" });
    }

    const walletAddress = siweMessage.address.toLowerCase();

    // 4. Upsert user in DB
    const user = await db.user.upsert({
      where: { walletAddress },
      create: {
        walletAddress,
        role: "VIEWER",
        level: 1,
        xp: 0,
      },
      update: { lastLoginAt: new Date() },
    });

    // 5. Issue JWT (15 min) + refresh token (7 days httpOnly)
    const accessToken = app.jwt.sign({
      sub: user.id,
      wallet: user.walletAddress,
      role: user.role,
    });

    const refreshToken = generateRefreshToken();
    const hashedRefresh = hashToken(refreshToken);

    await db.refreshToken.create({
      data: {
        tokenHash: hashedRefresh,
        userId: user.id,
        expiresAt: new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 3600 * 1000),
        userAgent: request.headers["user-agent"] ?? null,
        ipAddress: request.ip,
      },
    });

    // Alert on new device login (fire-and-forget)
    notifyNewDeviceLogin(user, request.ip, request.headers["user-agent"]).catch(() => {});

    reply
      .setCookie("incam_refresh", refreshToken, {
        ...COOKIE_OPTIONS,
        maxAge: REFRESH_TTL_DAYS * 24 * 3600,
      })
      .send({
        accessToken,
        user: {
          id: user.id,
          walletAddress: user.walletAddress,
          username: user.username,
          role: user.role,
          level: user.level,
          xp: user.xp,
        },
      });
  });

  // POST /api/auth/refresh — rotate refresh token (single-use)
  app.post("/refresh", async (request: FastifyRequest, reply: FastifyReply) => {
    const refreshToken = request.cookies?.incam_refresh;
    if (!refreshToken) {
      return reply.status(401).send({ error: "No refresh token" });
    }

    const hashedToken = hashToken(refreshToken);
    const stored = await db.refreshToken.findUnique({
      where: { tokenHash: hashedToken },
      include: { user: true },
    });

    if (!stored || stored.expiresAt < new Date() || stored.revoked) {
      reply.clearCookie("incam_refresh");
      return reply.status(401).send({ error: "Invalid or expired refresh token" });
    }

    // Rotate: revoke old, issue new (single-use)
    await db.refreshToken.update({ where: { id: stored.id }, data: { revoked: true } });

    const newRefresh = generateRefreshToken();
    const newHashed = hashToken(newRefresh);
    await db.refreshToken.create({
      data: {
        tokenHash: newHashed,
        userId: stored.userId,
        expiresAt: new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 3600 * 1000),
        userAgent: request.headers["user-agent"] ?? null,
        ipAddress: request.ip,
      },
    });

    const accessToken = app.jwt.sign({
      sub: stored.user.id,
      wallet: stored.user.walletAddress,
      role: stored.user.role,
    });

    reply
      .setCookie("incam_refresh", newRefresh, { ...COOKIE_OPTIONS, maxAge: REFRESH_TTL_DAYS * 24 * 3600 })
      .send({ accessToken });
  });

  // GET /api/auth/me — return current user (requires valid JWT)
  app.get("/me", {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const payload = request.user as { sub: string };
    const user = await db.user.findUnique({ where: { id: payload.sub } });
    if (!user) return reply.status(404).send({ error: "User not found" });

    return reply.send({
      user: {
        id: user.id,
        walletAddress: user.walletAddress,
        username: user.username,
        role: user.role,
        level: user.level,
        xp: user.xp,
      },
    });
  });

  // POST /api/auth/logout
  app.post("/logout", async (request: FastifyRequest, reply: FastifyReply) => {
    const refreshToken = request.cookies?.incam_refresh;
    if (refreshToken) {
      const hashed = hashToken(refreshToken);
      await db.refreshToken.updateMany({ where: { tokenHash: hashed }, data: { revoked: true } }).catch(() => {});
    }
    reply.clearCookie("incam_refresh").send({ ok: true });
  });
}

// Decorate app with authenticate preHandler
declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    user: unknown;
  }
}

async function notifyNewDeviceLogin(user: { id: string; walletAddress: string }, ip: string, ua: string | undefined) {
  // TODO: emit event to notification service via message queue
  console.info(`New device login: user=${user.id} ip=${ip} ua=${ua}`);
}
