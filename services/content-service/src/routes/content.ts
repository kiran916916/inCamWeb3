import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { db } from "../utils/db";
import { s3 } from "../utils/storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { verifyContentAccess } from "../utils/accessControl";

// Maximum file size accepted for upload — 2 GB as specified in requirements
const MAX_UPLOAD_SIZE_BYTES = 2 * 1024 * 1024 * 1024;

// How long a signed media URL remains valid.
// Short TTL prevents sharing of premium content via URL forwarding.
// After expiry, the client must request a new signed URL (requires re-authentication).
const SIGNED_URL_TTL_SECONDS = 900; // 15 minutes

// Validation schema for content creation — applied before any DB write.
// Zod ensures that tier and accessMode values are exactly one of the allowed strings.
const ContentCreateSchema = z.object({
  title:       z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  type:        z.enum(["video", "image", "audio", "text"]),
  tier:        z.enum(["freemium", "premium"]),
  accessMode:  z.enum(["token_gated", "subscription", "pay_per_view"]).optional(),
  price:       z.string().optional(), // stored as string to preserve BigInt precision
});

export async function contentRoutes(app: FastifyInstance) {

  // ── POST /api/content/upload-url ────────────────────────────────────────────
  // Issues a pre-signed S3-compatible URL so the browser can upload directly to
  // Cloudflare R2 without the file passing through the application server.
  //
  // Why pre-signed upload instead of proxying?
  //  - Avoids the application server becoming a bandwidth bottleneck
  //  - R2 handles large uploads natively
  //  - The URL expires in 10 minutes, limiting the window for misuse
  //
  // Security note: MIME type validation via magic bytes must happen server-side
  // after upload (TODO: trigger a post-upload ClamAV scan via a bucket event/webhook).
  app.post(
    "/upload-url",
    { preHandler: [app.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const schema = z.object({
        filename:    z.string(),
        contentType: z.string(),
        size:        z.number().max(MAX_UPLOAD_SIZE_BYTES),
      });
      const parsed = schema.safeParse(request.body);
      if (!parsed.success) return reply.status(400).send({ error: "Invalid request" });

      const { filename, contentType, size } = parsed.data;

      // Allowlist of accepted MIME types — anything else is rejected at the API boundary
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

      // Sanitise the filename — strip anything that is not alphanumeric, dot, dash, or underscore
      // to prevent path traversal or directory separator injection in the storage key
      const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
      const key          = `uploads/${user.sub}/${Date.now()}-${safeFilename}`;

      // Create the pre-signed PUT command — the browser uses this URL to upload directly to R2
      const command = new PutObjectCommand({
        Bucket:        process.env.R2_BUCKET!,
        Key:           key,
        ContentType:   contentType,
        ContentLength: size,
        Metadata:      { userId: user.sub }, // attach uploader identity for audit
      });

      // URL valid for 10 minutes — enough time for the browser to initiate and complete the upload
      const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 600 });

      return reply.send({ uploadUrl, key });
    },
  );

  // ── POST /api/content ───────────────────────────────────────────────────────
  // Creates the content database record after the file has been uploaded to R2.
  // Status starts as "processing" — a background job handles moderation and IPFS pinning.
  app.post(
    "/",
    { preHandler: [app.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user   = request.user as { sub: string };
      const parsed = ContentCreateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid request", details: parsed.error.format() });
      }

      const body = parsed.data as z.infer<typeof ContentCreateSchema> & {
        storageKey?: string;
        thumbnailKey?: string;
      };

      const content = await db.content.create({
        data: {
          creatorId:   user.sub,
          title:       body.title,
          description: body.description,
          type:        body.type,
          tier:        body.tier,
          accessMode:  body.accessMode,
          price:       body.price,
          // "processing" triggers the moderation pipeline:
          //   ClamAV scan → NSFW detect → CSAM scan → IPFS pin → publish
          status: "processing",
        },
      });

      // TODO: emit "content.created" event to the message bus here.
      // The content-moderation worker consumes this event and transitions status.

      return reply.status(201).send({ content });
    },
  );

  // ── GET /api/content/:id ────────────────────────────────────────────────────
  // Retrieves content metadata and (for premium) a signed media URL.
  //
  // This is the most security-critical endpoint in the platform.
  // Premium content access is ALWAYS re-validated on the server — the client-side
  // UI gate (showing a lock icon) is only cosmetic. The real enforcement is here.
  app.get(
    "/:id",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;

      const content = await db.content.findUnique({
        where:   { id },
        include: { creator: { select: { username: true, walletAddress: true } } },
      });

      // Return 404 for non-existent or non-published content to avoid information disclosure
      // (don't reveal that a draft exists)
      if (!content || content.status !== "published") {
        return reply.status(404).send({ error: "Content not found" });
      }

      // Freemium content: serve metadata with a CDN public URL — no authentication required
      // This satisfies the "wallet-optional entry" UX requirement
      if (content.tier === "freemium") {
        return reply.send({ content, mediaUrl: null }); // CDN URL determined by client from ipfsCid
      }

      // Premium content: must be authenticated and pass server-side access check
      const user = request.user as { sub: string } | null;
      if (!user) {
        return reply.status(401).send({ error: "Authentication required for premium content" });
      }

      // Fetch the user's wallet address — we need it to check on-chain token holdings
      const dbUser = await db.user.findUnique({
        where:  { id: user.sub },
        select: { walletAddress: true },
      });
      if (!dbUser) return reply.status(401).send({ error: "User not found" });

      // Call the blockchain RPC to verify the user actually holds the required tokens/pass.
      // This cannot be faked by manipulating client-side state or forging a JWT.
      const hasAccess = await verifyContentAccess({
        walletAddress: dbUser.walletAddress,
        content,
      });

      if (!hasAccess) {
        return reply.status(403).send({
          error:      "Access denied",
          accessMode: content.accessMode,
          message:    "Purchase a Creator Pass or pay for access to view this premium content",
        });
      }

      // Access confirmed — generate a signed R2 URL that expires in 15 minutes.
      // This URL is specific to this request; sharing it only works for 15 minutes.
      // Premium content is NEVER served via a persistent public URL.
      const signedUrl = await getSignedUrl(
        s3,
        new GetObjectCommand({
          Bucket: process.env.R2_BUCKET!,
          Key:    content.ipfsCid!, // the R2 key where the content is stored
        }),
        { expiresIn: SIGNED_URL_TTL_SECONDS },
      );

      return reply.send({ content, mediaUrl: signedUrl });
    },
  );

  // ── GET /api/content/feed ───────────────────────────────────────────────────
  // Returns a paginated list of published content for the feed.
  // Freemium and premium metadata both returned — the client shows a lock for premium.
  // Media URLs are NOT included here — fetched individually on the content detail page.
  app.get(
    "/feed",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const {
        page      = 1,
        limit     = 20,
        tier,
        creatorId,
      } = request.query as { page?: number; limit?: number; tier?: string; creatorId?: string };

      const where: Record<string, unknown> = { status: "published" };
      if (tier)      where["tier"]      = tier;
      if (creatorId) where["creatorId"] = creatorId;

      // Run count and data queries in parallel for performance
      const [items, total] = await Promise.all([
        db.content.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip:    (Number(page) - 1) * Math.min(Number(limit), 50),
          take:    Math.min(Number(limit), 50), // hard cap at 50 to prevent oversized responses
          include: { creator: { select: { username: true, walletAddress: true } } },
        }),
        db.content.count({ where }),
      ]);

      return reply.send({
        items,
        total,
        page:  Number(page),
        pages: Math.ceil(total / Math.min(Number(limit), 50)),
      });
    },
  );
}
