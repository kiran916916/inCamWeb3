import { ethers, upgrades } from "hardhat";
import { parseEther } from "ethers";
import * as fs from "fs";

interface DeployedAddresses {
  platformToken: string;
  contentNFT: string;
  editionNFT: string;
  badgeNFT: string;
  marketplace: string;
  escrow: string;
  rewardDistributor: string;
  creatorPass: string;
}

async function main() {
  const [deployer, admin, minter, feeRecipient] = await ethers.getSigners();

  console.log("Deploying contracts with:", deployer.address);
  console.log("Network:", (await ethers.provider.getNetwork()).name);

  const deployedAddresses: DeployedAddresses = {} as DeployedAddresses;

  // 1. PlatformToken
  console.log("\n1. Deploying PlatformToken...");
  const PlatformToken = await ethers.getContractFactory("PlatformToken");
  const platformToken = await upgrades.deployProxy(PlatformToken, [
    "InCam Token",
    "INCAM",
    admin.address,
    minter.address,
    admin.address,
  ]);
  await platformToken.waitForDeployment();
  deployedAddresses.platformToken = await platformToken.getAddress();
  console.log("  PlatformToken:", deployedAddresses.platformToken);

  // Mint initial supply to treasury
  const mintRole = await platformToken.MINTER_ROLE();
  const initialSupply = parseEther("100000000"); // 100M tokens
  await platformToken.connect(minter).mint(admin.address, initialSupply);
  console.log("  Minted 100M INCAM to treasury");

  // 2. ContentNFT
  console.log("\n2. Deploying ContentNFT...");
  const ContentNFT = await ethers.getContractFactory("ContentNFT");
  const contentNFT = await upgrades.deployProxy(ContentNFT, [
    "InCam Content",
    "ICC",
    admin.address,
    minter.address,
  ]);
  await contentNFT.waitForDeployment();
  deployedAddresses.contentNFT = await contentNFT.getAddress();
  console.log("  ContentNFT:", deployedAddresses.contentNFT);

  // 3. EditionNFT
  console.log("\n3. Deploying EditionNFT...");
  const EditionNFT = await ethers.getContractFactory("EditionNFT");
  const editionNFT = await upgrades.deployProxy(EditionNFT, [
    admin.address,
    minter.address,
  ]);
  await editionNFT.waitForDeployment();
  deployedAddresses.editionNFT = await editionNFT.getAddress();
  console.log("  EditionNFT:", deployedAddresses.editionNFT);

  // 4. BadgeNFT
  console.log("\n4. Deploying BadgeNFT...");
  const BadgeNFT = await ethers.getContractFactory("BadgeNFT");
  const badgeNFT = await upgrades.deployProxy(BadgeNFT, [
    admin.address,
    minter.address,
  ]);
  await badgeNFT.waitForDeployment();
  deployedAddresses.badgeNFT = await badgeNFT.getAddress();
  console.log("  BadgeNFT:", deployedAddresses.badgeNFT);

  // 5. Escrow
  console.log("\n5. Deploying Escrow...");
  const Escrow = await ethers.getContractFactory("Escrow");
  const escrow = await upgrades.deployProxy(Escrow, [
    admin.address,
    admin.address, // operator — will be updated to Marketplace address
  ]);
  await escrow.waitForDeployment();
  deployedAddresses.escrow = await escrow.getAddress();
  console.log("  Escrow:", deployedAddresses.escrow);

  // 6. Marketplace
  console.log("\n6. Deploying Marketplace...");
  const Marketplace = await ethers.getContractFactory("Marketplace");
  const marketplace = await upgrades.deployProxy(Marketplace, [
    admin.address,
    feeRecipient.address,
    deployedAddresses.platformToken,
    250, // 2.5% protocol fee
  ]);
  await marketplace.waitForDeployment();
  deployedAddresses.marketplace = await marketplace.getAddress();
  console.log("  Marketplace:", deployedAddresses.marketplace);

  // 7. RewardDistributor
  console.log("\n7. Deploying RewardDistributor...");
  const RewardDistributor = await ethers.getContractFactory("RewardDistributor");
  const rewardDistributor = await upgrades.deployProxy(RewardDistributor, [
    admin.address,
    admin.address, // distributor — will be reward service wallet
    deployedAddresses.platformToken,
  ]);
  await rewardDistributor.waitForDeployment();
  deployedAddresses.rewardDistributor = await rewardDistributor.getAddress();
  console.log("  RewardDistributor:", deployedAddresses.rewardDistributor);

  // Fund the reward distributor with tokens
  const rewardPool = parseEther("10000000"); // 10M tokens
  await platformToken.connect(minter).mint(deployedAddresses.rewardDistributor, rewardPool);
  console.log("  Funded RewardDistributor with 10M INCAM");

  // 8. CreatorPass
  console.log("\n8. Deploying CreatorPass...");
  const CreatorPass = await ethers.getContractFactory("CreatorPass");
  const creatorPass = await upgrades.deployProxy(CreatorPass, [
    "InCam Creator Pass",
    "ICCP",
    admin.address,
    minter.address,
    deployedAddresses.platformToken,
  ]);
  await creatorPass.waitForDeployment();
  deployedAddresses.creatorPass = await creatorPass.getAddress();
  console.log("  CreatorPass:", deployedAddresses.creatorPass);

  // Save addresses
  const outputPath = `./deployments/${(await ethers.provider.getNetwork()).chainId}.json`;
  fs.mkdirSync("./deployments", { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify({ ...deployedAddresses, deployedAt: new Date().toISOString() }, null, 2));
  console.log(`\nDeployment addresses saved to ${outputPath}`);
  console.log("\nDeployment complete!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
