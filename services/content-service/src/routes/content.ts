import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { db } from "../utils/db";
import { s3 } from "../utils/storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { verifyContentAccess } from "../utils/accessControl";
import * as mime from "mime-types";

const SIGNED_URL_TTL_SECONDS = 900; // 15 minutes
const MAX_UPLOAD_SIZE_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB

const ContentCreateSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  type: z.enum(["video", "image", "audio", "text"]),
  tier: z.enum(["freemium", "premium"]),
  accessMode: z.enum(["token_gated", "subscription", "pay_per_view"]).optional(),
  price: z.string().optional(),
});

export async function contentRoutes(app: FastifyInstance) {
  // POST /api/content/upload-url — get pre-signed S3 upload URL
  app.post(
    "/upload-url",
    { preHandler: [app.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const schema = z.object({ filename: z.string(), contentType: z.string(), size: z.number().max(MAX_UPLOAD_SIZE_BYTES) });
      const parsed = schema.safeParse(request.body);
      if (!parsed.success) return reply.status(400).send({ error: "Invalid request" });

      const { filename, contentType, size } = parsed.data;

      // Validate MIME type (magic bytes validated on upload)
      const allowedTypes = [
        "video/mp4", "video/webm", "video/quicktime",
        "image/jpeg", "image/png", "image/webp", "image/gif",
        "audio/mpeg", "audio/ogg", "audio/wav",
        "application/pdf", "text/plain",
      ];
      if (!allowedTypes.includes(contentType)) {
        return reply.status(400).send({ error: "Unsupported file type" });
      }

      const user = request.user as { sub: string };
      const key = `uploads/${user.sub}/${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

      const command = new PutObjectCommand({
        Bucket: process.env.R2_BUCKET!,
        Key: key,
        ContentType: contentType,
        ContentLength: size,
        Metadata: { userId: user.sub },
      });

      const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 600 }); // 10 min to upload

      return reply.send({ uploadUrl, key });
    }
  );

  // POST /api/content — create content record after upload
  app.post(
    "/",
    { preHandler: [app.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as { sub: string };
      const parsed = ContentCreateSchema.safeParse(request.body);
      if (!parsed.success) return reply.status(400).send({ error: "Invalid request", details: parsed.error.format() });

      const body = parsed.data as z.infer<typeof ContentCreateSchema> & { storageKey?: string; thumbnailKey?: string };

      const content = await db.content.create({
        data: {
          creatorId: user.sub,
          title: body.title,
          description: body.description,
          type: body.type,
          tier: body.tier,
          accessMode: body.accessMode,
          price: body.price,
          status: "processing", // triggers moderation + IPFS pinning pipeline
        },
      });

      // Queue moderation scan (ClamAV + NSFW detection)
      // contentProcessingQueue.add("scan", { contentId: content.id, storageKey });

      return reply.status(201).send({ content });
    }
  );

  // GET /api/content/:id — get content (with access check for premium)
  app.get(
    "/:id",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;
      const content = await db.content.findUnique({ where: { id }, include: { creator: { select: { username: true, walletAddress: true } } } });

      if (!content || content.status !== "published") {
        return reply.status(404).send({ error: "Content not found" });
      }

      // Freemium content: no access check needed
      if (content.tier === "freemium") {
        return reply.send({ content, mediaUrl: null }); // public URL served via CDN
      }

      // Premium: server-side access validation (NEVER trust client-side only)
      const user = request.user as { sub: string } | null;
      if (!user) {
        return reply.status(401).send({ error: "Authentication required for premium content" });
      }

      const dbUser = await db.user.findUnique({ where: { id: user.sub }, select: { walletAddress: true } });
      if (!dbUser) return reply.status(401).send({ error: "User not found" });

      const hasAccess = await verifyContentAccess({
        walletAddress: dbUser.walletAddress,
        content,
      });

      if (!hasAccess) {
        return reply.status(403).send({
          error: "Access denied",
          accessMode: content.accessMode,
          message: "Purchase a Creator Pass or pay for access to view this premium content",
        });
      }

      // Issue signed, expiring URL (never persistent public URLs for premium)
      const signedUrl = await getSignedUrl(
        s3,
        new GetObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: content.ipfsCid! }),
        { expiresIn: SIGNED_URL_TTL_SECONDS }
      );

      return reply.send({ content, mediaUrl: signedUrl });
    }
  );

  // GET /api/content/feed — paginated content feed
  app.get(
    "/feed",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { page = 1, limit = 20, tier, creatorId } = request.query as {
        page?: number; limit?: number; tier?: string; creatorId?: string;
      };

      const where: Record<string, unknown> = { status: "published" };
      if (tier) where["tier"] = tier;
      if (creatorId) where["creatorId"] = creatorId;

      const [items, total] = await Promise.all([
        db.content.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (Number(page) - 1) * Number(limit),
          take: Math.min(Number(limit), 50),
          include: { creator: { select: { username: true, walletAddress: true } } },
        }),
        db.content.count({ where }),
      ]);

      return reply.send({ items, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
    }
  );
}
