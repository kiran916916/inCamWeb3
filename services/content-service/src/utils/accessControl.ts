import { createPublicClient, http, parseAbi } from "viem";
import { polygon, polygonAmoy } from "viem/chains";

const chain = process.env.CHAIN_ID === "137" ? polygon : polygonAmoy;

const publicClient = createPublicClient({
  chain,
  transport: http(process.env.RPC_URL),
});

const creatorPassAbi = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
  "function isActivePass(uint256 tokenId) view returns (bool)",
  "function passToTier(uint256 tokenId) view returns (uint256)",
]);

const contentNFTAbi = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
]);

interface Content {
  accessMode: string | null;
  nftContract: string | null;
  price: string | null;
}

interface AccessCheckParams {
  walletAddress: string;
  content: Content;
}

export async function verifyContentAccess({ walletAddress, content }: AccessCheckParams): Promise<boolean> {
  // Always re-validate on the server — never trust client-side checks
  const address = walletAddress as `0x${string}`;

  switch (content.accessMode) {
    case "token_gated": {
      if (!content.nftContract) return false;
      const balance = await publicClient.readContract({
        address: content.nftContract as `0x${string}`,
        abi: contentNFTAbi,
        functionName: "balanceOf",
        args: [address],
      });
      return balance > 0n;
    }

    case "subscription": {
      const passContract = process.env.CREATOR_PASS_CONTRACT as `0x${string}`;
      if (!passContract) return false;
      const balance = await publicClient.readContract({
        address: passContract,
        abi: creatorPassAbi,
        functionName: "balanceOf",
        args: [address],
      });
      // Has at least one active pass
      return balance > 0n; // Full implementation would check specific tier + expiry
    }

    case "pay_per_view": {
      // Check off-chain payment record
      return false; // Implemented by payment service
    }

    default:
      return false;
  }
}
