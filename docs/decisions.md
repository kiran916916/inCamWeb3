# Architecture Decision Records

## ADR-001 — Polygon L2 over Ethereum Mainnet

**Status:** Accepted

**Context:**
The platform requires frequent micro-transactions: NFT minting, badge awards, XP-linked on-chain actions, and leaderboard settlements. Ethereum mainnet gas costs ($5–$50 per transaction) make this economically unviable for casual users.

**Decision:**
Deploy on Polygon PoS (mainnet) with Amoy testnet for staging. EVM-compatible so all OpenZeppelin contracts work unchanged.

**Consequences:**
- Gas per transaction: ~$0.001–$0.01 vs $5–$50 on mainnet
- Trade-off: lower decentralisation than mainnet
- Bridge risk: MATIC bridge has had historical issues; mitigated by not holding large platform treasury on the bridge
- Future path: evaluate Base or Arbitrum if Polygon throughput becomes a constraint

---

## ADR-002 — UUPS Proxy Pattern for Upgradability

**Status:** Accepted

**Context:**
Smart contracts are immutable once deployed. Platform features will evolve and bugs may be found. Full re-deployment means migrating all NFT ownership — unacceptable.

**Decision:**
Use OpenZeppelin's UUPS (EIP-1822) proxy pattern. Upgrade logic lives in the implementation contract (not the proxy), reducing attack surface compared to Transparent Proxy.

**Constraints applied:**
- UPGRADER_ROLE required to call `_authorizeUpgrade`
- Intended: 3-of-5 multisig holds UPGRADER_ROLE
- 48-hour timelock on upgrades (via `PlatformDAO` governor — not yet wired)
- All upgrades emit events, tracked by The Graph

**Consequences:**
- Storage layout must never reorder existing variables; new variables appended only
- `_disableInitializers()` in all constructors prevents implementation contract initialisation attacks

---

## ADR-003 — SIWE over API-Key / OAuth-only Authentication

**Status:** Accepted

**Context:**
Traditional username/password or OAuth-only authentication does not align with the self-sovereign identity model. Users should not need to trust the platform with credentials.

**Decision:**
Sign-In with Ethereum (EIP-4361) as the primary authentication mechanism. The user signs a structured message with their wallet; the server verifies the signature. No private key is ever transmitted.

**Flow:**
1. Server issues a one-time nonce (stored in Redis with 5-minute TTL)
2. Client constructs a SIWE message and signs it in the wallet provider
3. Server verifies signature + consumes nonce (replay prevention)
4. Server issues RS256 JWT (15-min) + httpOnly refresh token (7-day, single-use rotation)

**OAuth fallback:**
Social login (Google/X) is retained as a secondary option for non-crypto users. It must link to a wallet address before any on-chain action is permitted. PKCE enforced for all OAuth flows.

**Consequences:**
- Users without a wallet can browse freemium content (wallet-optional entry)
- Signature replay window limited to 5 minutes
- Lost wallet = lost account (mitigated by: allow linking multiple wallets, social recovery via account abstraction in future)

---

## ADR-004 — RS256 (Asymmetric) JWT Signing

**Status:** Accepted

**Context:**
Multiple backend services need to verify JWTs. Sharing a symmetric HMAC secret across services creates a wide blast radius if one service is compromised.

**Decision:**
RS256 (RSA-SHA256) with a 4096-bit key pair. Private key held only by `auth-service`. Public key published at `/.well-known/jwks.json` for other services to verify independently.

**Consequences:**
- Any service can verify a JWT without calling `auth-service` on every request
- Compromise of `content-service` does not expose the ability to forge tokens
- Key rotation: new key added to JWKS, old key removed after all existing tokens expire (15-min window)

---

## ADR-005 — Server-Side Premium Content Access Re-Validation

**Status:** Accepted (non-negotiable)

**Context:**
It is tempting to gate premium content purely on the frontend (check wallet balance, show/hide content). This is trivially bypassable by anyone who can read network traffic or disable JavaScript.

**Decision:**
Backend re-validates access on every request for premium content:
1. Verify JWT
2. Read `content.accessMode` from database
3. Call blockchain RPC to verify `balanceOf(wallet)` or `isActivePass(tokenId)`
4. Only if access confirmed: generate a signed, expiring Cloudflare R2 URL (15-min TTL)
5. Signed URL served directly from R2; no proxying through the application server

**Consequences:**
- +50–100ms latency on premium content requests (RPC call)
- Mitigation: cache access-check results in Redis with short TTL (60 seconds) per wallet+content pair
- Signed URLs prevent sharing: each URL is wallet-specific and time-limited

---

## ADR-006 — Idempotent Reward Engine

**Status:** Accepted

**Context:**
Reward claims must survive network failures, retries, and duplicate event delivery from the message bus. Application-level "if not already claimed" checks have race conditions under concurrent load.

**Decision:**
Database-level unique constraint on `(user_id, quest_id, date_bucket)` in `user_quests`. On-chain: `RewardDistributor` maintains a `mapping(bytes32 => bool) claimed` keyed on a deterministic `rewardId`.

**Generating rewardId:**
```
rewardId = keccak256(abi.encodePacked(userId, questId, dateBucket))
```

**Consequences:**
- Retrying a claim is always safe — second attempt is a no-op
- Corrections issued as separate entries with audit trail; rewards are never deleted or modified retroactively
- `batchClaimRewards` skips already-claimed entries rather than reverting the whole batch

---

## ADR-007 — Commit-Reveal Scheme for Auctions

**Status:** Accepted

**Context:**
On-chain auctions where bids are visible in the mempool allow front-running: a miner or MEV bot can see a bid and insert a higher bid before it confirms. This extracts value from honest bidders.

**Decision:**
Two-phase commit-reveal:
1. **Commit phase** (during auction): bidder submits `keccak256(abi.encodePacked(amount, salt))` — amount is hidden
2. **Reveal phase** (24h after auction end): bidder submits `amount + salt`; contract verifies commitment and escrows tokens
3. **Settlement** (after reveal phase): winner gets NFT, losers can pull their refunds

**Consequences:**
- Eliminates mempool front-running of bids
- Gas cost higher (two transactions per bid)
- Bidders who reveal a lower amount than highest bid lose their reveal transaction gas (acceptable)
- **Known gap**: losing bidder refunds currently iterate over all bids in `settleAuction` — this is a gas DoS vector; must be replaced with pull-payment pattern before production

---

## ADR-008 — Soulbound Badges via Transfer Block

**Status:** Accepted

**Context:**
Achievement badges should reflect genuine on-chain behaviour. If badges are transferable, they can be bought/sold, defeating the purpose.

**Decision:**
Override `_update` in `BadgeNFT.sol` to revert on any transfer where `from != address(0)`. Minting is allowed; all transfers are blocked at the contract level.

**Consequences:**
- Badges are permanently tied to the earning wallet
- Aligns with EIP-5192 (Minimal Soulbound Token) spirit
- Lost wallet = lost badges (no recovery mechanism; acceptable for badges, not for funds)

---

## ADR-009 — BullMQ for Async Badge Minting

**Status:** Accepted

**Context:**
Minting a badge requires sending an Ethereum transaction, waiting for confirmation (~2–4 seconds on Polygon), and handling nonce management. Doing this synchronously on a user action would stall the HTTP response.

**Decision:**
Badge checks and on-chain minting are queued via BullMQ (Redis-backed) and processed by `BadgeMintWorker` in a background worker process. The HTTP response returns immediately with XP awarded; the badge minting happens asynchronously.

**Consequences:**
- User action never blocks on blockchain confirmation
- Worker retries on failure (3 attempts, exponential backoff: 2s/4s/8s)
- Idempotency: `hasBadge(wallet, badgeId)` is checked before minting to prevent duplicates
- Worker failure: badge may be delayed but will retry; worst case requires manual re-queue

---

## ADR-010 — Cloudflare R2 over S3 for Media Storage

**Status:** Accepted

**Context:**
Platform serves potentially petabytes of video/image content. AWS S3 egress costs ~$0.09/GB. At scale this becomes the largest infrastructure cost.

**Decision:**
Cloudflare R2 for primary media storage. R2 has zero egress fees. S3-compatible API means the AWS SDK works without changes (just point to R2 endpoint).

**Consequences:**
- Cloudflare Workers can serve R2 content with custom logic (access control, analytics) at the edge
- R2 is newer than S3; some advanced S3 features (S3 Batch, S3 Inventory) are not available
- Vendor lock-in to Cloudflare; mitigated by S3-compatible API making migration feasible

---

## ADR-011 — Redis Sorted Sets for Leaderboards

**Status:** Accepted

**Context:**
Leaderboard reads need to return ranked results in <5 seconds of an action. PostgreSQL `ORDER BY xp DESC` with 100K+ users requires a sequential scan or full index scan on every read.

**Decision:**
Maintain leaderboards as Redis Sorted Sets (`ZINCRBY`, `ZREVRANGEBYSCORE`). Redis sorted set operations are O(log N) for updates and reads. Weekly leaderboards keyed as `leaderboard:weekly:{weekKey}`.

**Consequences:**
- Leaderboard updates are near-real-time (<100ms)
- Redis is a separate system of record for leaderboard state; PostgreSQL `user.xp` is the authoritative source for user XP
- On Redis failure, leaderboards degrade gracefully (return empty); XP is not lost (PostgreSQL is authoritative)
- Weekly settlement: cron reads top-10, issues on-chain rewards, flushes the weekly key

---

## ADR-012 — ERC-2981 On-Chain Royalties

**Status:** Accepted

**Context:**
Creator royalties could be enforced off-chain (platform takes a cut and pays creators) or on-chain. Off-chain enforcement requires trust in the platform.

**Decision:**
Implement ERC-2981 royalty standard on all NFT contracts. The `Marketplace` contract reads `royaltyInfo(tokenId, salePrice)` from the NFT contract and distributes the royalty atomically in the same transaction as the sale.

**Consequences:**
- Royalties cannot be bypassed by using the platform's marketplace
- External marketplaces (OpenSea etc.) may or may not honour ERC-2981; this is a known limitation of the standard
- Creator royalty range: 2–10% (200–1000 basis points), set at mint time, immutable per token
- Platform fee: 2.5% (configurable up to 5% by FEE_MANAGER_ROLE)

---

## ADR-013 — Microservices over Monolith

**Status:** Accepted

**Context:**
The platform has services with very different scaling characteristics: the reward engine processes bursts of XP events, the content service handles large file uploads, and the marketplace handles trade settlement. A monolith would require scaling all components together.

**Decision:**
Eight microservices, each independently deployable and scalable. Inter-service communication: synchronous REST for user-facing paths, Kafka/SQS for event-driven flows.

**Service boundaries:**
| Service | Scaling Driver |
|---|---|
| auth-service | Login volume |
| content-service | Upload bandwidth / transcode CPU |
| nft-service | Mint queue throughput |
| marketplace-service | Trade settlement throughput |
| reward-service | XP event burst volume |
| payment-service | Fiat transaction volume |
| search-service | Query volume |
| analytics-service | Event ingestion volume |

**Consequences:**
- Operational complexity increases significantly vs a monolith
- mTLS (Istio/Linkerd) required for service-to-service security
- Distributed tracing (OpenTelemetry) needed for debugging
- Shared Prisma schema creates coupling; long-term each service should own its own schema

---

## ADR-014 — Next.js 14 App Router (Server Components)

**Status:** Accepted

**Context:**
Server Components allow data fetching at the component level without waterfalls, reduce client-side JavaScript bundle size, and support streaming. These improve LCP (target <2.5s).

**Decision:**
Use App Router throughout. Page-level components are Server Components by default. Client Components (`"use client"`) used only where interactivity or browser APIs are required (wallet connection, animations, form state).

**Consequences:**
- Wallet hooks (Wagmi, RainbowKit) require Client Components; `Providers` wrapper isolates this
- Framer Motion animations require `"use client"`
- Server Components cannot use `useState`, `useEffect`, or browser APIs directly
- `AuthProvider` is a Client Component wrapping the tree; initial auth state is client-side only
