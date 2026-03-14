# System Architecture

## High-Level Overview

```
                        ┌──────────────────────────────────────────┐
                        │              USERS / CLIENTS              │
                        │   Browser · Mobile · Wallet Extension     │
                        └──────────────────┬───────────────────────┘
                                           │ HTTPS / WSS
                        ┌──────────────────▼───────────────────────┐
                        │           Cloudflare (Edge)               │
                        │  WAF · DDoS Shield · R2 CDN · Workers     │
                        └──────────────────┬───────────────────────┘
                                           │
          ┌─────────────────────────────────▼──────────────────────────────────┐
          │                         API Gateway                                │
          │        Rate Limiting · JWT Validation · Request Routing            │
          └──┬──────────────┬──────────────┬──────────────┬───────────────────┘
             │              │              │              │
     ┌───────▼───┐  ┌───────▼───┐  ┌──────▼────┐  ┌─────▼──────┐
     │   Auth    │  │  Content  │  │    NFT    │  │  Reward    │
     │  Service  │  │  Service  │  │  Service  │  │  Service   │
     │  :3001    │  │  :3002    │  │  :3003    │  │  :3004     │
     └───────┬───┘  └───────┬───┘  └──────┬────┘  └─────┬──────┘
             │              │              │              │
     ┌───────▼───┐  ┌───────▼───┐  ┌──────▼────┐  ┌─────▼──────┐
     │  Market   │  │  Payment  │  │  Search   │  │ Analytics  │
     │  Service  │  │  Service  │  │  Service  │  │  Service   │
     │  :3005    │  │  :3006    │  │  :3007    │  │  :3008     │
     └───────────┘  └───────────┘  └───────────┘  └────────────┘
             │              │              │              │
          ┌──▼──────────────▼──────────────▼──────────────▼──┐
          │                  Message Bus (Kafka / SQS)         │
          │       NFT Minted · Trade Settled · XP Awarded      │
          └──────────────────────────────────────────────────┘
                                    │
          ┌─────────────────────────▼──────────────────────────┐
          │                  Data Layer                         │
          │  PostgreSQL (primary) · Redis (cache/leaderboards)  │
          │  ElasticSearch (search) · TimescaleDB (analytics)   │
          └─────────────────────────────────────────────────────┘
                                    │
          ┌─────────────────────────▼──────────────────────────┐
          │              Decentralised Layer                     │
          │                                                      │
          │  ┌─────────────────────────────────────────────┐    │
          │  │        EVM Smart Contracts (Polygon)         │    │
          │  │                                              │    │
          │  │  PlatformToken ──► RewardDistributor         │    │
          │  │       │                   │                  │    │
          │  │  ContentNFT          BadgeNFT (soulbound)    │    │
          │  │  EditionNFT               │                  │    │
          │  │  CreatorPass ◄────────────┘                  │    │
          │  │       │                                       │    │
          │  │  Marketplace ──► Escrow                      │    │
          │  │       │                                       │    │
          │  │  PlatformDAO (governance + treasury)         │    │
          │  └─────────────────────────────────────────────┘    │
          │                                                      │
          │  ┌──────────────────┐  ┌──────────────────────┐     │
          │  │  IPFS / Pinata   │  │  The Graph Protocol  │     │
          │  │  Content Storage │  │  On-chain Indexing   │     │
          │  └──────────────────┘  └──────────────────────┘     │
          └─────────────────────────────────────────────────────┘
```

---

## Network Request Flow — Sign In with Ethereum

```
Browser                Auth Service              Database / Redis
   │                        │                         │
   │── GET /auth/nonce ─────►│                         │
   │                        │── SET nonce:xyz TTL=300 ►│
   │◄── { nonce: "xyz" } ───│                         │
   │                        │                         │
   │  [User signs SIWE      │                         │
   │   message in wallet]   │                         │
   │                        │                         │
   │── POST /auth/verify ──►│                         │
   │   { message, sig }     │── GET nonce:xyz ────────►│
   │                        │◄── "1" ─────────────────│
   │                        │── DEL nonce:xyz ────────►│  (replay prevention)
   │                        │── verify signature       │
   │                        │── UPSERT user ──────────►│
   │                        │── store refresh hash ───►│
   │◄── accessToken (JWT)   │                         │
   │    Set-Cookie: refresh │                         │
```

---

## Network Request Flow — Premium Content Access

```
Browser            Content Service        Blockchain RPC           R2 Storage
   │                    │                      │                       │
   │── GET /content/:id ►│                      │                       │
   │                    │── verify JWT          │                       │
   │                    │── fetch content row   │                       │
   │                    │                      │                       │
   │                    │  [tier=premium]       │                       │
   │                    │── balanceOf(wallet) ──►│                       │
   │                    │◄── balance > 0 ───────│                       │
   │                    │                      │                       │
   │                    │── getSignedUrl() ─────────────────────────────►│
   │                    │◄── signed URL (TTL=15min) ─────────────────────│
   │◄── { content, mediaUrl } │               │                       │
   │── fetch media ──────────────────────────────────────────────────────►│
```

---

## NFT Lifecycle

```
Creator Studio        Content Service         NFT Service          Blockchain
     │                     │                      │                    │
     │── upload file ──────►│                      │                    │
     │                     │── ClamAV scan         │                    │
     │                     │── NSFW detect         │                    │
     │                     │── pin to IPFS         │                    │
     │                     │── create DB record    │                    │
     │                     │── emit ContentReady ──►│                    │
     │                     │                      │── build metadata    │
     │                     │                      │── pin metadata IPFS │
     │                     │                      │── mintContent() ────►│
     │                     │                      │◄── tokenId ─────────│
     │                     │                      │── update DB record  │
     │◄── NFT minted ──────│◄─────────────────────│                    │
```

---

## Reward Engine — XP + Badge Flow

```
User Action         Reward Service              Redis              Blockchain
     │                   │                       │                    │
     │── POST /xp ───────►│                       │                    │
     │                   │── rate limit check ───►│                    │
     │                   │── get streak ──────────►│                    │
     │                   │── calculate XP×multi   │                    │
     │                   │── update user.xp ──────►│ (DB)               │
     │                   │── ZINCRBY leaderboard ─►│                    │
     │◄── { xpAwarded }  │                       │                    │
     │                   │                       │                    │
     │                   │── queue: check-badges  │                    │
     │                   │   [async, BullMQ]      │                    │
     │                   │        │               │                    │
     │                   │        ▼               │                    │
     │                   │   BadgeMintWorker       │                    │
     │                   │── hasBadge(wallet) ─────────────────────────►│
     │                   │◄── false ───────────────────────────────────│
     │                   │── awardBadge(wallet) ───────────────────────►│
     │                   │◄── tx confirmed ────────────────────────────│
```

---

## Marketplace — Commit-Reveal Auction

```
Phase 1: Commit (during auction window)
  Bidder ──── commitBid(listing, keccak256(amount, salt)) ──► Marketplace

Phase 2: Reveal (24h window after auction ends)
  Bidder ──── revealBid(listing, idx, amount, salt) ──────► Marketplace
              [Marketplace escrows tokens, tracks highest bid]

Phase 3: Settlement
  Anyone ─── settleAuction(listing) ──────────────────────► Marketplace
             [Highest bidder gets NFT + royalties distributed]
             [Losing bidders claim refunds via pull pattern]
```

---

## Data Flow — Leaderboard

```
Action occurs ──► reward-service updates XP
                          │
                          ▼
               Redis: ZINCRBY leaderboard:global {userId} {xp}
               Redis: ZINCRBY leaderboard:weekly:{weekKey} {userId} {xp}
                          │
                  < 5 second latency
                          │
               GET /leaderboard/global
                   ──► ZREVRANGEBYSCORE (O log N)
                   ──► hydrate usernames from Postgres
                   ──► return ranked list
                          │
               Weekly settlement (cron)
                   ──► top 10 wallets
                   ──► RewardDistributor.batchClaimRewards()
                   ──► FLUSHDB leaderboard:weekly:{weekKey}
```

---

## Security Perimeter

```
                    ┌─────────────────────────────────────┐
  Internet ─────────► Cloudflare WAF + DDoS Shield         │
                    └─────────────┬───────────────────────┘
                                  │
                    ┌─────────────▼───────────────────────┐
                    │  API Gateway (rate limit, JWT verify) │
                    └─────────────┬───────────────────────┘
                                  │
            Private VPC           │
  ┌─────────────────────────────────────────────────────┐
  │         ┌────────────┐   ┌─────────────────┐        │
  │         │ Services   │   │ Kubernetes pods  │        │
  │         │ (mTLS via  │   │ (network policy: │        │
  │         │  Istio)    │   │  deny by default)│        │
  │         └─────┬──────┘   └────────┬────────┘        │
  │               │                   │                  │
  │         ┌─────▼───────────────────▼───────────┐     │
  │         │         PostgreSQL + Redis            │     │
  │         │   (no public internet access)         │     │
  │         └──────────────────────────────────────┘     │
  └─────────────────────────────────────────────────────┘
```
