import { createConfig, http } from "wagmi";
import { polygon, polygonAmoy, hardhat } from "wagmi/chains";
import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  metaMaskWallet,
  coinbaseWallet,
  walletConnectWallet,
  rainbowWallet,
} from "@rainbow-me/rainbowkit/wallets";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "";

const connectors = connectorsForWallets(
  [
    {
      groupName: "Recommended",
      wallets: [metaMaskWallet, coinbaseWallet, walletConnectWallet, rainbowWallet],
    },
  ],
  { appName: "InCam Web3 Platform", projectId }
);

export const wagmiConfig = createConfig({
  connectors,
  chains: [polygon, polygonAmoy, hardhat],
  transports: {
    [polygon.id]: http(process.env.NEXT_PUBLIC_POLYGON_RPC || "https://polygon-rpc.com"),
    [polygonAmoy.id]: http(process.env.NEXT_PUBLIC_POLYGON_AMOY_RPC || "https://rpc-amoy.polygon.technology"),
    [hardhat.id]: http("http://127.0.0.1:8545"),
  },
  ssr: true,
});

export const SUPPORTED_CHAIN_ID =
  process.env.NEXT_PUBLIC_CHAIN_ID === "137" ? polygon.id : polygonAmoy.id;
