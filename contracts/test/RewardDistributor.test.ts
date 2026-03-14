import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { parseEther } from "ethers";

describe("RewardDistributor", function () {
  async function deployFixture() {
    const [admin, minter, distributor, user1, user2] = await ethers.getSigners();

    const PlatformToken = await ethers.getContractFactory("PlatformToken");
    const token = await upgrades.deployProxy(PlatformToken, [
      "InCam Token", "INCAM", admin.address, minter.address, admin.address
    ]);

    const RewardDistributor = await ethers.getContractFactory("RewardDistributor");
    const rewards = await upgrades.deployProxy(RewardDistributor, [
      admin.address, distributor.address, await token.getAddress()
    ]);
    const rewardsAddr = await rewards.getAddress();

    // Fund rewards contract
    await token.connect(minter).mint(rewardsAddr, parseEther("1000000"));

    return { rewards, token, admin, minter, distributor, user1, user2 };
  }

  it("should idempotently claim reward (no double award)", async function () {
    const { rewards, token, distributor, user1 } = await loadFixture(deployFixture);

    const rewardId = ethers.id("quest:daily:user1:2024-01-01");
    const amount = parseEther("50");

    await rewards.connect(distributor).claimReward(rewardId, user1.address, amount);
    const bal1 = await token.balanceOf(user1.address);

    // Retry must not double-award
    await expect(rewards.connect(distributor).claimReward(rewardId, user1.address, amount))
      .to.be.revertedWith("RewardDistributor: already claimed");

    const bal2 = await token.balanceOf(user1.address);
    expect(bal1).to.equal(bal2);
    expect(bal1).to.equal(amount);
  });

  it("should batch claim rewards idempotently", async function () {
    const { rewards, token, distributor, user1, user2 } = await loadFixture(deployFixture);

    const rewardIds = [ethers.id("batch:1"), ethers.id("batch:2")];
    const users = [user1.address, user2.address];
    const amounts = [parseEther("100"), parseEther("200")];

    await rewards.connect(distributor).batchClaimRewards(rewardIds, users, amounts);

    expect(await token.balanceOf(user1.address)).to.equal(amounts[0]);
    expect(await token.balanceOf(user2.address)).to.equal(amounts[1]);

    // Second batch with same IDs should be noop (skip)
    await rewards.connect(distributor).batchClaimRewards(rewardIds, users, amounts);
    expect(await token.balanceOf(user1.address)).to.equal(amounts[0]);
  });

  it("should record correction in append-only audit trail", async function () {
    const { rewards, token, admin, user1 } = await loadFixture(deployFixture);

    const originalId = ethers.id("original:reward");
    const correctionId = ethers.id("correction:1");

    await rewards.connect(admin).issueCorrection(
      user1.address, originalId, -50n, "Sybil detection clawback", correctionId, 0n
    );

    const correction = await rewards.corrections(0);
    expect(correction.user).to.equal(user1.address);
    expect(correction.originalRewardId).to.equal(originalId);
    expect(correction.adjustment).to.equal(-50n);
  });

  it("should reject unauthorized callers", async function () {
    const { rewards, user1, user2 } = await loadFixture(deployFixture);

    await expect(
      rewards.connect(user1).claimReward(ethers.id("test"), user2.address, parseEther("1"))
    ).to.be.reverted;
  });
});
