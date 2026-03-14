# InCam Web3 — Social Media & NFT Exchange Platform

A decentralised social media platform where creators monetise content as NFTs, fans earn rewards, and every interaction builds verifiable on-chain value.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Frontend (Next.js 14 + Wagmi v2 + RainbowKit)                  │
├─────────────────────────────────────────────────────────────────┤
│  Backend Microservices (Fastify + Node.js)                       │
│  auth-service │ content-service │ nft-service │ reward-service  │
├─────────────────────────────────────────────────────────────────┤
│  Smart Contracts (Solidity ^0.8.24 on Polygon)                   │
│  PlatformToken │ ContentNFT │ EditionNFT │ BadgeNFT             │
│  Marketplace   │ Escrow     │ RewardDistributor │ CreatorPass   │
├─────────────────────────────────────────────────────────────────┤
│  Infrastructure: PostgreSQL │ Redis │ Cloudflare R2 │ IPFS      │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env

# Start infrastructure
docker-compose up postgres redis -d

# Deploy contracts locally
docker-compose --profile dev up hardhat-node -d
npm run contracts:deploy:local

# Run all services
npm run dev
```

## Smart Contracts

| Contract | Purpose | Standard |
|---|---|---|
| `PlatformToken` | Governance + utility ERC-20 | ERC-20 + ERC-20Votes |
| `ContentNFT` | Per-content NFTs | ERC-721 + ERC-2981 |
| `EditionNFT` | Limited-run drops | ERC-1155 |
| `BadgeNFT` | Soulbound achievements | ERC-1155 (soulbound) |
| `Marketplace` | Commit-reveal auctions + fixed listings | — |
| `Escrow` | Atomic swap escrow | — |
| `RewardDistributor` | Idempotent token rewards | — |
| `CreatorPass` | Subscription access key | ERC-721 |

## Security Highlights

- **Auth**: SIWE — no private keys ever transmitted
- **JWT**: RS256, 15-min access + 7-day httpOnly refresh (single-use rotation)
- **Content gating**: Always server-side validated
- **Premium media**: Signed, expiring R2 URLs (15-min TTL)
- **Contracts**: UUPS proxies, ReentrancyGuard, Pausable, 3-of-5 multisig upgrades
- **Rewards**: Idempotent by design — DB-level unique constraints prevent double-awards