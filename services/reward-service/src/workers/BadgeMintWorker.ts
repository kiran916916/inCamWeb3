import { Worker, Job } from "bullmq";
import { createPublicClient, createWalletClient, http, parseAbi } from "viem";
import { polygon, polygonAmoy } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { redis } from "../utils/redis";
import { db } from "../utils/db";

const BADGE_CONTRACT = process.env.BADGE_NFT_CONTRACT as `0x${string}`;
const REWARD_DISTRIBUTOR = process.env.REWARD_DISTRIBUTOR_CONTRACT as `0x${string}`;
const MINTER_PRIVATE_KEY = process.env.MINTER_PRIVATE_KEY as `0x${string}`;

const BADGE_CONDITIONS: Record<number, (userId: string) => Promise<boolean>> = {
  1: async (userId) => {
    // Early Adopter: joined in first month of launch
    const user = await db.user.findUnique({ where: { id: userId }, select: { createdAt: true } });
    const launchDate = new Date("2024-06-01");
    const oneMonthLater = new Date("2024-07-01");
    return !!user && user.createdAt >= launchDate && user.createdAt <= oneMonthLater;
  },
  2: async (userId) => {
    // First Collector: has bought at least 1 NFT
    const trades = await db.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count FROM trades WHERE buyer_user_id = ${userId}
    `;
    return Number(trades[0].count) >= 1;
  },
  // Additional badge conditions defined here...
};

export class BadgeMintWorker {
  private worker: Worker | null = null;

  start() {
    const chain = process.env.CHAIN_ID === "137" ? polygon : polygonAmoy;
    const account = privateKeyToAccount(MINTER_PRIVATE_KEY);

    const walletClient = createWalletClient({
      account,
      chain: polygon,
      transport: http(process.env.RPC_URL),
    });

    const badgeAbi = parseAbi([
      "function awardBadge(address recipient, uint256 badgeId) external",
      "function hasBadge(address, uint256) view returns (bool)",
    ]);

    this.worker = new Worker(
      "rewards",
      async (job: Job) => {
        if (job.name === "check-badges") {
          await this.processBadgeCheck(job.data, walletClient, badgeAbi, polygon);
        } else if (job.name === "on-chain-reward") {
          await this.processOnChainReward(job.data);
        }
      },
      {
        connection: redis as any,
        concurrency: 3,
        limiter: { max: 10, duration: 1000 }, // 10 jobs/sec max
      }
    );

    this.worker.on("completed", (job) => {
      console.info(`Job ${job.id} (${job.name}) completed`);
    });

    this.worker.on("failed", (job, err) => {
      console.error(`Job ${job?.id} (${job?.name}) failed:`, err);
    });

    console.info("BadgeMintWorker started");
  }

  private async processBadgeCheck(
    data: { userId: string; newXP: number; newLevel: number },
    walletClient: any,
    badgeAbi: readonly unknown[],
    chain: typeof polygon
  ) {
    const user = await db.user.findUnique({ where: { id: data.userId }, select: { walletAddress: true } });
    if (!user) return;

    for (const [badgeIdStr, checkFn] of Object.entries(BADGE_CONDITIONS)) {
      const badgeId = Number(badgeIdStr);
      const qualifies = await checkFn(data.userId);
      if (!qualifies) continue;

      // Idempotency: check if already minted
      const publicClient = createPublicClient({ chain, transport: http(process.env.RPC_URL) });
      const alreadyHas = await publicClient.readContract({
        address: BADGE_CONTRACT,
        abi: badgeAbi,
        functionName: "hasBadge",
        args: [user.walletAddress as `0x${string}`, BigInt(badgeId)],
      });

      if (alreadyHas) continue;

      // Mint badge on-chain (async, does not block user)
      await walletClient.writeContract({
        address: BADGE_CONTRACT,
        abi: badgeAbi,
        functionName: "awardBadge",
        args: [user.walletAddress as `0x${string}`, BigInt(badgeId)],
      });

      console.info(`Badge ${badgeId} minted for user ${data.userId}`);
    }
  }

  private async processOnChainReward(data: { userId: string; rewardId: string; tokenAmount: string }) {
    // Call RewardDistributor.claimReward on-chain
    // Implementation uses the same pattern as badge minting
    console.info(`Processing on-chain reward: rewardId=${data.rewardId} amount=${data.tokenAmount}`);
  }

  async stop() {
    await this.worker?.close();
  }
}
