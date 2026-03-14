# Development Backlog & Next Steps

Priority levels: **P0** = blocks launch · **P1** = required for production · **P2** = important · **P3** = nice to have

---

## SPRINT 1 — Legal & Security Baseline (P0, do first)

These items must exist before any real user can use the platform.

- [ ] **CSAM scanning** — Integrate PhotoDNA or equivalent into content upload pipeline. Content must be scanned before any storage write. Block and report on match.
- [ ] **ClamAV malware scanner** — Wire up ClamAV container into content-service upload flow. Quarantine files that fail scan.
- [ ] **NSFW detection** — Integrate AWS Rekognition (or equivalent) into the content moderation pipeline. Route flagged content to human review queue.
- [ ] **GDPR data export** — Build `GET /api/users/:id/export` endpoint that returns all off-chain personal data as a downloadable JSON archive.
- [ ] **GDPR right to erasure** — Build `DELETE /api/users/:id` that removes all off-chain data. Add privacy policy clause explaining on-chain data is immutable.
- [ ] **Age verification** — Integrate a KYC/age verification step (Stripe Identity or Persona) during creator onboarding. Platform is 18+.
- [ ] **Terms of Service wallet-sign** — Require creators to sign a structured EIP-712 message acknowledging ToS before first monetisation action is enabled.
- [ ] **KYC for creator withdrawals** — Integrate Stripe Identity or Persona for first-withdrawal KYC. Block withdrawal until verified.
- [ ] **AML check** — Apply AML screening for users withdrawing >$1,000/month equivalent.

---

## SPRINT 2 — Smart Contract Production Hardening (P0)

- [ ] **Fix auction refund gas DoS** — Replace the `for` loop over all bids in `settleAuction` with a pull-payment pattern. Each losing bidder calls `claimRefund(listingId)` independently.
- [ ] **Deploy Governance DAO** — Build `PlatformDAO.sol` using OpenZeppelin Governor. Wire UPGRADER_ROLE to a 3-of-5 multisig (Gnosis Safe). Set 48-hour timelock on all upgrades.
- [ ] **Minimum bid increment** — Add configurable minimum bid increment (e.g. 5%) to `listAuction` and enforce in `revealBid` to prevent increment spam.
- [ ] **Creator withdrawal lock** — Implement 48-hour hold on first creator withdrawal in Marketplace or a dedicated Vesting contract. Configurable by governance.
- [ ] **Slither static analysis** — Run `slither .` and resolve all high/critical findings. Document medium findings with mitigations.
- [ ] **100% branch coverage** — Expand contract tests to achieve 100% branch coverage as measured by `hardhat coverage`. Focus on: Marketplace auction edge cases, RewardDistributor batch edge cases, CreatorPass expiry boundary.
- [ ] **External audit** — Engage Certik, Trail of Bits, or equivalent. Scope: all contracts in `contracts/contracts/`. Budget 4–8 weeks before mainnet.
- [ ] **Deploy multisig** — Deploy a Gnosis Safe 3-of-5 and transfer `DEFAULT_ADMIN_ROLE` and `UPGRADER_ROLE` on all contracts to the multisig.
- [ ] **Chainlink VRF** — Integrate `VRFConsumerBaseV2Plus` for any on-chain randomness (mystery badge draws, seasonal event prizes).
- [ ] **Chainlink price feeds** — Integrate `AggregatorV3Interface` for USD/MATIC price in auction settlement and fee calculations.
- [ ] **Contract verification** — Verify all contracts on Polygonscan. Add as a mandatory deploy script step.

---

## SPRINT 3 — Missing Backend Services (P1)

### nft-service (new service, not yet built)
- [ ] Receive `content.published` event from message bus
- [ ] Build ERC-721 metadata JSON (name, description, image, attributes)
- [ ] Pin metadata JSON to IPFS via Pinata
- [ ] Call `ContentNFT.mintContent()` with IPFS URI
- [ ] Store tokenId + contract address in content DB record
- [ ] Emit `nft.minted` event to message bus
- [ ] Arweave permanence upload for content files

### marketplace-service (new service)
- [ ] Maintain off-chain order book (listed, price, seller)
- [ ] Subscribe to on-chain `Sale` events via The Graph
- [ ] Provide REST API: `GET /listings`, `GET /nft/:contract/:tokenId/history`
- [ ] Price history storage in PostgreSQL with time-series indexing
- [ ] Bid history for auctions

### payment-service (new service)
- [ ] Stripe fiat on-ramp integration: create payment intent → confirm → mint INCAM
- [ ] Pay-per-view unlock: create access record after payment confirmation
- [ ] Webhook handler for Stripe events (idempotent: verify Stripe signature)
- [ ] Revenue split recording: track creator earnings, platform fees, royalties

### notification-service (new service)
- [ ] Subscribe to events: new subscriber, NFT sold, royalty received, quest completed, badge minted
- [ ] Email delivery via SendGrid or AWS SES
- [ ] In-app notification store (PostgreSQL + WebSocket push)
- [ ] New device login alert implementation (currently a `console.info` stub)

### search-service (new service)
- [ ] ElasticSearch cluster setup
- [ ] Indexers: content (title, description, creator), creators (username, displayName)
- [ ] REST API: `GET /search?q=&type=content|creator&tier=`
- [ ] Autocomplete endpoint for search bar
- [ ] Index on `content.published` event

### analytics-service (new service)
- [ ] Event ingestion from message bus (view, like, trade, mint, quest complete)
- [ ] Creator dashboard: views per content, earnings breakdown, subscriber growth
- [ ] Platform dashboard (admin): daily active users, trading volume, top creators
- [ ] TimescaleDB or ClickHouse for time-series analytics

### api-gateway (new service)
- [ ] Route all external traffic through a single gateway
- [ ] Central rate limiting (100 req/min public, 1000 req/min authenticated)
- [ ] JWT validation once at gateway — downstream services trust forwarded identity
- [ ] Request logging with correlation IDs for distributed tracing

---

## SPRINT 4 — Authentication Completion (P1)

- [ ] **TOTP enforcement** — Build TOTP verification endpoint. Require TOTP on sign-in for CREATOR and ADMIN roles. Use `otpauth` library. Encrypt TOTP secret at rest.
- [ ] **OAuth 2.0 + PKCE** — Implement Google/X social login with PKCE flow. After OAuth, require wallet linking before on-chain actions.
- [ ] **JWKS endpoint** — Expose `GET /.well-known/jwks.json` with the RS256 public key. Other services fetch this on startup for JWT verification.
- [ ] **Re-auth for withdrawals** — On withdrawal request, issue a re-authentication challenge (SIWE nonce or TOTP). Do not process until challenge is verified.
- [ ] **Multi-wallet linking** — Allow users to link multiple Ethereum addresses to one account. Verify each with SIWE.

---

## SPRINT 5 — Content Pipeline (P1)

- [ ] **Video transcoding** — Integrate AWS MediaConvert or FFmpeg worker to transcode uploads to HLS (adaptive bitrate) for streaming. Store HLS playlist and segments in R2.
- [ ] **MIME magic-byte validation** — In content-service upload handler, read the first 16 bytes of the uploaded file and compare against a whitelist of magic byte signatures before accepting.
- [ ] **Content moderation state machine** — Formalise states: `draft` → `scanning` → `pending_review` (if flagged) → `published` / `rejected`. Expose moderation queue API for MODERATOR role.
- [ ] **DMCA takedown endpoint** — `POST /api/content/:id/takedown` with reason. Content moves to `removed` state. Creator notified. Counter-notice workflow defined.

---

## SPRINT 6 — Reward System Completion (P1)

- [ ] **Gitcoin Passport integration** — Before issuing XP or token rewards, check Passport score via Gitcoin Passport API. Require score > configured threshold.
- [ ] **Streak shield inventory** — Add item inventory table. Streak shield earnable via quests. Apply shield automatically when login missed. Not purchasable.
- [ ] **Weekly leaderboard settlement** — Cron job runs every Monday: reads top-10 from Redis, calls `RewardDistributor.batchClaimRewards()` on-chain, resets weekly key.
- [ ] **Sybil burst detection** — Add anomaly detection: if a wallet earns XP at >3× its 7-day average rate in a 1-hour window, auto-flag and hold pending manual review.
- [ ] **Quest scheduler** — Daily cron generates active quests at 00:00 UTC. Weekly cron generates weekly quests every Monday. Seasonal quests configured in advance.

---

## SPRINT 7 — Frontend Completion (P1/P2)

- [ ] **Wallet/Portfolio dashboard** — Page showing: all NFTs held (by creator), total portfolio value, unrealised P&L, recent trade history, token balance.
- [ ] **NFT detail page** — `/nft/[contract]/[tokenId]`: image, metadata, price history chart (Recharts), ownership history, bid history (for auctions), buy/bid actions.
- [ ] **Live stream page** — Video player (HLS.js), real-time chat (WebSocket), live gifting (send INCAM tokens), viewer count.
- [ ] **Discover page** — `/discover`: creator search, trending content, category browse, new arrivals.
- [ ] **Wallet address truncation audit** — Search all components for raw `walletAddress` display and ensure all use the `truncateAddress` utility.
- [ ] **Accessibility audit** — Run axe-core on all pages. Fix all WCAG 2.1 AA violations. Add ARIA labels to all icon buttons. Test with VoiceOver and NVDA.
- [ ] **Reduced motion support** — Add `@media (prefers-reduced-motion: reduce)` CSS to disable all animations.
- [ ] **SRI on third-party scripts** — Add `integrity` attribute to all `<script>` and `<link>` tags loading from external origins.

---

## SPRINT 8 — Infrastructure & DevOps (P1)

- [ ] **Kubernetes manifests** — Write Deployment, Service, HPA, and NetworkPolicy manifests for all services. Store in `infrastructure/kubernetes/`.
- [ ] **Terraform modules** — IaC for: Cloudflare R2 bucket, PostgreSQL (RDS), Redis (ElastiCache), EKS cluster, IAM roles. Store in `infrastructure/terraform/`.
- [ ] **Database migrations in CI** — Add `prisma migrate deploy` as a deploy step before rolling out new service versions.
- [ ] **OpenTelemetry instrumentation** — Add `@opentelemetry/sdk-node` to all services. Export traces to Jaeger or Grafana Tempo.
- [ ] **Prometheus metrics** — Expose `/metrics` on each service. Collect: request rate, error rate, latency P50/P95/P99, queue depth.
- [ ] **Grafana dashboards** — Create dashboards for: service health, trading volume, XP issuance rate, leaderboard update latency.
- [ ] **PagerDuty alerting** — Define alert rules: service down, error rate >1%, DB connection pool exhausted, Redis memory >80%.
- [ ] **Database backup** — Configure automated PostgreSQL snapshots every 6 hours. Retain 30 days. Run restore test quarterly.
- [ ] **Redis Cluster** — Replace single Redis instance with Redis Cluster for HA. Update BullMQ and IORedis client configs.
- [ ] **mTLS via Istio** — Deploy Istio service mesh. Enable strict mTLS between all pods. Define AuthorizationPolicy: deny by default.
- [ ] **The Graph subgraph** — Write subgraph schema and mappings for: ContentNFT transfers, Marketplace Sale events, RewardDistributor claims, BadgeNFT awards.

---

## SPRINT 9 — Gas Abstraction (P2)

- [ ] **ERC-4337 integration** — Integrate Biconomy or Pimlico as the Paymaster. Platform sponsors gas for: NFT minting, badge claiming, Creator Pass renewal.
- [ ] **Meta-transaction support** — For non-ERC-4337 users, implement EIP-2612 permit signatures for token approvals (removes one approval transaction).
- [ ] **Gas estimation UI** — Show estimated gas cost (in USD) before any transaction. If platform is sponsoring, show "Free" badge.

---

## SPRINT 10 — Performance & Load Testing (P1 before launch)

- [ ] **k6 load tests** — Script simulating 10,000 concurrent users on the marketplace. Target: P95 API response <200ms.
- [ ] **LCP optimisation** — Measure and optimise Largest Contentful Paint. Target <2.5s. Add image `priority` prop to above-fold images, preconnect to CDN.
- [ ] **Redis caching** — Cache premium content access checks (60s TTL per wallet+content pair). Cache creator profile data (30s TTL). Cache leaderboard pages (5s TTL).
- [ ] **CDN configuration** — Configure Cloudflare caching rules: freemium content thumbnails (24h), static assets (1 year), API responses (no-cache).
- [ ] **Database indexes** — Add indexes to: `content(creatorId, status, tier)`, `trades(buyer_wallet, traded_at)`, `user_quests(userId, dateBucket)`.

---

## Bug Backlog

| ID | Bug | Severity | Notes |
|---|---|---|---|
| BUG-001 | `settleAuction` iterates unbounded over all bids — gas DoS on large auctions | Critical | Replace with pull-payment pattern |
| BUG-002 | Access cache in content-service not implemented — RPC call on every premium request | High | Add Redis cache layer |
| BUG-003 | `notifyNewDeviceLogin` is a `console.info` stub | Medium | Wire to notification-service |
| BUG-004 | NFT Ticker uses `<style jsx>` which requires `styled-jsx` dep | Low | Convert to Tailwind keyframe animation |
| BUG-005 | `MarketplaceFilters` filter state is local only — not reflected in URL | Low | Add URL search params for shareable filter URLs |
| BUG-006 | `CreatorStudio` submit handler is a `console.log` stub | High | Wire to content-service API |
| BUG-007 | `BadgeMintWorker` `processOnChainReward` is a stub | High | Implement full on-chain call |
| BUG-008 | No loading skeleton states — layout shift during data fetch | Low | Add Skeleton components |
| BUG-009 | `StudioPage` uses client-side redirect — SSR incompatible | Medium | Use Next.js middleware for auth guard |
| BUG-010 | `walletAddress` in rewards routes declared but not used (TypeScript warning) | Low | Fix type annotations |
