import { Queue } from "bullmq";
import { redis } from "./redis";

export const rewardQueue = new Queue("rewards", {
  connection: redis as any,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});
