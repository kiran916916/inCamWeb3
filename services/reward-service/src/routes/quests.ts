import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { db } from "../utils/db";

export async function questRoutes(app: FastifyInstance) {
  // GET /api/quests/active — get today's quests
  app.get("/active", async (request: FastifyRequest, reply: FastifyReply) => {
    const now = new Date();
    const quests = await db.quest.findMany({
      where: {
        active: true,
        startAt: { lte: now },
        endAt: { gte: now },
      },
      orderBy: { questType: "asc" },
    });
    return reply.send({ quests });
  });

  // GET /api/quests/user/:userId — get quests with user progress
  app.get<{ Params: { userId: string } }>(
    "/user/:userId",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { userId } = request.params;
      const dateBucket = new Date().toISOString().slice(0, 10);
      const now = new Date();

      const quests = await db.quest.findMany({
        where: { active: true, startAt: { lte: now }, endAt: { gte: now } },
        include: {
          userQuests: {
            where: { userId, dateBucket },
          },
        },
      });

      return reply.send({
        quests: quests.map((q) => ({
          ...q,
          userProgress: q.userQuests[0] ?? null,
        })),
      });
    }
  );
}
