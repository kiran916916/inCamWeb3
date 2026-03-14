import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { parseEther } from "ethers";

describe("Marketplace", function () {
  async function deployMarketplaceFixture() {
    const [admin, minter, seller, buyer, feeRecipient] = await ethers.getSigners();

    // Deploy PlatformToken
    const PlatformToken = await ethers.getContractFactory("PlatformToken");
    const platformToken = await upgrades.deployProxy(PlatformToken, [
      "InCam Token", "INCAM", admin.address, minter.address, admin.address
    ]);
    const tokenAddr = await platformToken.getAddress();

    // Mint tokens to buyer
    await platformToken.connect(minter).mint(buyer.address, parseEther("10000"));

    // Deploy ContentNFT
    const ContentNFT = await ethers.getContractFactory("ContentNFT");
    const contentNFT = await upgrades.deployProxy(ContentNFT, [
      "InCam Content", "ICC", admin.address, minter.address
    ]);
    const nftAddr = await contentNFT.getAddress();

    // Mint NFT to seller
    const tx = await contentNFT.connect(minter).mintContent(
      seller.address, "ipfs://test", seller.address, 1, 0, 500
    );
    const receipt = await tx.wait();
    const tokenId = 0n;

    // Deploy Marketplace
    const Marketplace = await ethers.getContractFactory("Marketplace");
    const marketplace = await upgrades.deployProxy(Marketplace, [
      admin.address, feeRecipient.address, tokenAddr, 250
    ]);
    const marketAddr = await marketplace.getAddress();

    // Approve marketplace
    await contentNFT.connect(seller).setApprovalForAll(marketAddr, true);
    await platformToken.connect(buyer).approve(marketAddr, parseEther("10000"));

    return { marketplace, contentNFT, platformToken, admin, minter, seller, buyer, feeRecipient, tokenId, marketAddr, nftAddr, tokenAddr };
  }

  it("should list and buy a fixed-price NFT atomically", async function () {
    const { marketplace, contentNFT, platformToken, seller, buyer, tokenId, marketAddr } = await loadFixture(deployMarketplaceFixture);

    const price = parseEther("100");
    const listTx = await marketplace.connect(seller).listFixed(
      await contentNFT.getAddress(), tokenId, 1, price, 0 // 0 = ERC721
    );
    await listTx.wait();

    const sellerBalanceBefore = await platformToken.balanceOf(seller.address);
    await marketplace.connect(buyer).buyFixed(0);

    expect(await contentNFT.ownerOf(tokenId)).to.equal(buyer.address);
    const sellerBalanceAfter = await platformToken.balanceOf(seller.address);
    expect(sellerBalanceAfter).to.be.gt(sellerBalanceBefore);
  });

  it("should distribute royalties on sale", async function () {
    const { marketplace, contentNFT, platformToken, seller, buyer, tokenId } = await loadFixture(deployMarketplaceFixture);

    const price = parseEther("100");
    await marketplace.connect(seller).listFixed(await contentNFT.getAddress(), tokenId, 1, price, 0);

    const creatorBalBefore = await platformToken.balanceOf(seller.address);
    await marketplace.connect(buyer).buyFixed(0);

    const creatorBalAfter = await platformToken.balanceOf(seller.address);
    // Creator gets seller proceeds + royalty (seller IS creator here)
    expect(creatorBalAfter).to.be.gt(creatorBalBefore);
  });

  it("should enforce protocol fee", async function () {
    const { marketplace, platformToken, feeRecipient, contentNFT, seller, buyer, tokenId } = await loadFixture(deployMarketplaceFixture);

    const price = parseEther("100");
    await marketplace.connect(seller).listFixed(await contentNFT.getAddress(), tokenId, 1, price, 0);

    const feeBalBefore = await platformToken.balanceOf(feeRecipient.address);
    await marketplace.connect(buyer).buyFixed(0);
    const feeBalAfter = await platformToken.balanceOf(feeRecipient.address);

    // 2.5% of 100 = 2.5 tokens
    expect(feeBalAfter - feeBalBefore).to.equal(parseEther("2.5"));
  });

  it("should reject seller buying their own listing", async function () {
    const { marketplace, contentNFT, platformToken, seller, tokenId } = await loadFixture(deployMarketplaceFixture);

    await platformToken.connect(seller).approve(await marketplace.getAddress(), parseEther("1000"));
    await marketplace.connect(seller).listFixed(await contentNFT.getAddress(), tokenId, 1, parseEther("100"), 0);

    await expect(marketplace.connect(seller).buyFixed(0)).to.be.revertedWith("Marketplace: seller cannot buy");
  });

  it("should allow listing cancellation", async function () {
    const { marketplace, contentNFT, seller, tokenId } = await loadFixture(deployMarketplaceFixture);

    await marketplace.connect(seller).listFixed(await contentNFT.getAddress(), tokenId, 1, parseEther("100"), 0);
    await marketplace.connect(seller).cancelListing(0);

    expect(await contentNFT.ownerOf(tokenId)).to.equal(seller.address);
  });
});
