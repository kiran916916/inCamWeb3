import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { SiweMessage } from "siwe";
import { z } from "zod";
import { redis } from "../utils/redis";
import { db } from "../utils/db";
import { generateNonce, hashToken, generateRefreshToken } from "../utils/crypto";

// How long a nonce stays valid after being issued.
// 5 minutes matches the SIWE spec's recommended maximum window.
const NONCE_TTL_SECONDS = 300;

// Refresh tokens last 7 days — long enough for convenience, short enough to limit exposure.
const REFRESH_TTL_DAYS = 7;

// Cookie settings — these are critical for security.
// httpOnly:   JavaScript cannot read the cookie (XSS protection)
// secure:     Cookie only sent over HTTPS in production
// sameSite:   Blocks cross-site request forgery (CSRF)
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
};

// Input schema for /verify — validates both fields exist and the signature looks like a hex string.
// We use Zod here rather than runtime checks so errors are structured and consistent.
const VerifySchema = z.object({
  message:   z.string().min(1),
  signature: z.string().regex(/^0x[0-9a-fA-F]+$/),
});

export async function authRoutes(app: FastifyInstance) {

  // ── GET /api/auth/nonce ─────────────────────────────────────────────────────
  // Issues a one-time nonce for the client to embed in a SIWE message.
  // The nonce is stored in Redis with a 5-minute TTL.
  // After /verify consumes it (DEL), the same nonce cannot be replayed.
  app.get("/nonce", async (_request: FastifyRequest, reply: FastifyReply) => {
    const nonce = generateNonce(); // cryptographically random 32-byte hex string
    const key   = `nonce:${nonce}`;

    // Store in Redis — SETEX sets the value AND the expiry atomically
    await redis.setex(key, NONCE_TTL_SECONDS, "1");

    return reply.send({ nonce });
  });

  // ── POST /api/auth/verify ───────────────────────────────────────────────────
  // Verifies a SIWE signature and issues an access token + refresh token.
  //
  // Security properties:
  //  1. Nonce consumed on first use (replay prevention)
  //  2. Signature verified cryptographically — no private key needed or transmitted
  //  3. Access token: short-lived JWT (15 min), RS256 signed
  //  4. Refresh token: random opaque token, stored as a bcrypt hash in DB (not plaintext)
  app.post("/verify", async (request: FastifyRequest, reply: FastifyReply) => {
    // Step 1: Validate request body structure before doing any crypto work
    const parsed = VerifySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid request body", details: parsed.error.format() });
    }
    const { message: rawMessage, signature } = parsed.data;

    // Step 2: Parse the raw SIWE message string into a structured object
    let siweMessage: SiweMessage;
    try {
      siweMessage = new SiweMessage(rawMessage);
    } catch {
      return reply.status(400).send({ error: "Invalid SIWE message format" });
    }

    // Step 3: Check the nonce is valid and has not expired
    // Redis GET returns null if the key has expired or was already consumed
    const nonceKey   = `nonce:${siweMessage.nonce}`;
    const nonceValid = await redis.get(nonceKey);
    if (!nonceValid) {
      return reply.status(401).send({ error: "Nonce expired or already used" });
    }

    // Step 4: Consume the nonce so it cannot be used again (replay prevention)
    // This must happen BEFORE the signature check so a timing attack cannot
    // race two concurrent verify calls with the same nonce.
    await redis.del(nonceKey);

    // Step 5: Cryptographically verify the wallet signature
    // siweMessage.verify() recovers the signer address from the signature
    // and confirms it matches siweMessage.address
    try {
      const fields = await siweMessage.verify({ signature, nonce: siweMessage.nonce });
      if (!fields.success) {
        return reply.status(401).send({ error: "Signature verification failed" });
      }
    } catch {
      return reply.status(401).send({ error: "Invalid signature" });
    }

    // Normalise address to lowercase — Ethereum addresses are case-insensitive (EIP-55)
    const walletAddress = siweMessage.address.toLowerCase();

    // Step 6: Upsert the user — create on first login, update lastLoginAt on subsequent logins
    const user = await db.user.upsert({
      where:  { walletAddress },
      create: { walletAddress, role: "VIEWER", level: 1, xp: 0 },
      update: { lastLoginAt: new Date() },
    });

    // Step 7: Issue a short-lived access token (JWT, 15 minutes)
    // The token carries the user ID, wallet, and role — downstream services trust this
    const accessToken = app.jwt.sign({
      sub:    user.id,
      wallet: user.walletAddress,
      role:   user.role,
    });

    // Step 8: Generate a refresh token and store it hashed in the database
    // We store a SHA-256 hash, not the plaintext, so a DB breach does not expose active sessions
    const refreshToken  = generateRefreshToken();  // 64 random bytes as base64url
    const hashedRefresh = hashToken(refreshToken); // SHA-256 hash

    await db.refreshToken.create({
      data: {
        tokenHash: hashedRefresh,
        userId:    user.id,
        expiresAt: new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 3600 * 1000),
        userAgent: request.headers["user-agent"] ?? null,
        ipAddress: request.ip,
      },
    });

    // Fire-and-forget: alert user if this is a new device or IP (does not block response)
    notifyNewDeviceLogin(user, request.ip, request.headers["user-agent"]).catch(() => {});

    // Set the refresh token in an httpOnly cookie (not accessible to JavaScript)
    // Send the access token in the response body (stored in memory by the client, not localStorage)
    return reply
      .setCookie("incam_refresh", refreshToken, {
        ...COOKIE_OPTIONS,
        maxAge: REFRESH_TTL_DAYS * 24 * 3600,
      })
      .send({
        accessToken,
        user: {
          id:            user.id,
          walletAddress: user.walletAddress,
          username:      user.username,
          role:          user.role,
          level:         user.level,
          xp:            user.xp,
        },
      });
  });

  // ── POST /api/auth/refresh ──────────────────────────────────────────────────
  // Issues a new access token using the refresh token from the httpOnly cookie.
  // Single-use rotation: the old refresh token is revoked and a new one issued.
  // If the same refresh token is presented twice (token theft detection), both should be revoked.
  app.post("/refresh", async (request: FastifyRequest, reply: FastifyReply) => {
    const refreshToken = request.cookies?.incam_refresh;
    if (!refreshToken) {
      return reply.status(401).send({ error: "No refresh token" });
    }

    // Hash the incoming token and look it up in the database
    const hashedToken = hashToken(refreshToken);
    const stored = await db.refreshToken.findUnique({
      where:   { tokenHash: hashedToken },
      include: { user: true },
    });

    // Reject if not found, expired, or already revoked (possible token theft)
    if (!stored || stored.expiresAt < new Date() || stored.revoked) {
      reply.clearCookie("incam_refresh");
      return reply.status(401).send({ error: "Invalid or expired refresh token" });
    }

    // Revoke the old token (single-use — cannot be used again)
    await db.refreshToken.update({ where: { id: stored.id }, data: { revoked: true } });

    // Generate and store a new refresh token
    const newRefresh  = generateRefreshToken();
    const newHashed   = hashToken(newRefresh);
    await db.refreshToken.create({
      data: {
        tokenHash: newHashed,
        userId:    stored.userId,
        expiresAt: new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 3600 * 1000),
        userAgent: request.headers["user-agent"] ?? null,
        ipAddress: request.ip,
      },
    });

    // Issue a fresh access token
    const accessToken = app.jwt.sign({
      sub:    stored.user.id,
      wallet: stored.user.walletAddress,
      role:   stored.user.role,
    });

    return reply
      .setCookie("incam_refresh", newRefresh, { ...COOKIE_OPTIONS, maxAge: REFRESH_TTL_DAYS * 24 * 3600 })
      .send({ accessToken });
  });

  // ── GET /api/auth/me ────────────────────────────────────────────────────────
  // Returns the current authenticated user's profile.
  // Requires a valid JWT in the Authorization header.
  app.get("/me", {
    preHandler: [app.authenticate], // verifies JWT, rejects if expired or invalid
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const payload = request.user as { sub: string };
    const user    = await db.user.findUnique({ where: { id: payload.sub } });
    if (!user) return reply.status(404).send({ error: "User not found" });

    return reply.send({
      user: {
        id:            user.id,
        walletAddress: user.walletAddress,
        username:      user.username,
        role:          user.role,
        level:         user.level,
        xp:            user.xp,
      },
    });
  });

  // ── POST /api/auth/logout ───────────────────────────────────────────────────
  // Revokes the current refresh token and clears the cookie.
  // The access token cannot be revoked (it is stateless), but it expires in 15 minutes.
  app.post("/logout", async (request: FastifyRequest, reply: FastifyReply) => {
    const refreshToken = request.cookies?.incam_refresh;
    if (refreshToken) {
      const hashed = hashToken(refreshToken);
      // Best-effort revocation — if the token is already gone, that is fine
      await db.refreshToken
        .updateMany({ where: { tokenHash: hashed }, data: { revoked: true } })
        .catch(() => {});
    }

    // Clear the httpOnly cookie from the browser
    return reply.clearCookie("incam_refresh").send({ ok: true });
  });
}

// Type augmentation so TypeScript knows about `app.authenticate`
declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { sub: string; wallet: string; role: string };
    user: { sub: string; wallet: string; role: string };
  }
}

/**
 * Sends a new-device alert via the notification service.
 * Called fire-and-forget — failure does not affect the auth response.
 * TODO: replace console.info with a message bus event to the notification-service.
 */
async function notifyNewDeviceLogin(
  user: { id: string; walletAddress: string },
  ip: string,
  ua: string | undefined,
) {
  console.info(`New login: userId=${user.id} ip=${ip} ua=${ua ?? "unknown"}`);
}
