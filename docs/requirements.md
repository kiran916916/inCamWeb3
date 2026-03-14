# Comprehensive Requirements

## 1. Functional Requirements

### 1.1 Authentication & Identity

| ID | Requirement | Priority |
|---|---|---|
| AUTH-01 | Users connect wallets via MetaMask, Coinbase Wallet, or WalletConnect v2 | P0 |
| AUTH-02 | Sign-In with Ethereum (SIWE / EIP-4361) as the primary auth mechanism | P0 |
| AUTH-03 | Server issues a one-time nonce with a 5-minute expiry; nonce is consumed on use | P0 |
| AUTH-04 | Access tokens are RS256 JWT with 15-minute expiry | P0 |
| AUTH-05 | Refresh tokens are single-use, rotated on every use, stored hashed in DB | P0 |
| AUTH-06 | Refresh tokens stored in httpOnly, Secure, SameSite=Strict cookies | P0 |
| AUTH-07 | Platform never transmits, logs, or stores private keys or seed phrases | P0 |
| AUTH-08 | Social login (Google/X) available as fallback; must link to a wallet before on-chain actions | P1 |
| AUTH-09 | PKCE enforced on all OAuth 2.0 flows | P1 |
| AUTH-10 | TOTP (2FA) enforced for Creator and Admin accounts | P1 |
| AUTH-11 | Alert user by email/notification on login from a new device or IP | P1 |
| AUTH-12 | Re-authentication required for withdrawal actions | P1 |
| AUTH-13 | Public JWKS endpoint at `/.well-known/jwks.json` for service-to-service JWT verification | P1 |
| AUTH-14 | Users can link multiple wallets to one account | P2 |
| AUTH-15 | Social recovery via account abstraction (ERC-4337) | P3 |

### 1.2 User Roles

| Role | Capabilities |
|---|---|
| VIEWER | Browse freemium content; connect wallet; earn XP; trade NFTs |
| CREATOR | All VIEWER + upload content; mint NFTs; configure tiers; access Studio; view analytics |
| MODERATOR | All VIEWER + review flagged content; issue content takedowns |
| ADMIN | All roles + manage platform config; pause contracts; manage roles; access audit logs |

### 1.3 Content System

| ID | Requirement | Priority |
|---|---|---|
| CONT-01 | Freemium content publicly accessible without wallet connection | P0 |
| CONT-02 | Premium content served only after server-side access re-validation | P0 |
| CONT-03 | Premium media served via signed, expiring URLs (15-minute TTL) | P0 |
| CONT-04 | Never serve premium content via persistent public URLs | P0 |
| CONT-05 | Supported types: video (≤2GB, ≤4K), image, audio, text/article | P0 |
| CONT-06 | Three premium access modes: token-gated, subscription, pay-per-view | P0 |
| CONT-07 | All uploaded files scanned with ClamAV before storage | P0 |
| CONT-08 | NSFW detection run on all content before publishing | P0 |
| CONT-09 | CSAM scanning via PhotoDNA before any storage | P0 — Legal |
| CONT-10 | MIME type validated via magic bytes (not filename extension) | P0 |
| CONT-11 | Content metadata pinned to IPFS after publishing | P1 |
| CONT-12 | Video transcoded to adaptive bitrate (HLS) for streaming | P1 |
| CONT-13 | Live streaming with <3 second first-frame latency | P1 |
| CONT-14 | Users can flag content; 3 flags trigger automatic hold + moderator review | P1 |
| CONT-15 | DMCA takedown processed within 24 hours | P1 — Legal |
| CONT-16 | Creator KYC required before first withdrawal | P1 — Legal |
| CONT-17 | Freemium content can be converted to a Free Edition NFT (unlimited supply, 0 mint cost) | P2 |

### 1.4 NFT Exchange

| ID | Requirement | Priority |
|---|---|---|
| NFT-01 | ContentNFT (ERC-721) minted per content piece | P0 |
| NFT-02 | EditionNFT (ERC-1155) for limited-run drops | P0 |
| NFT-03 | BadgeNFT (ERC-1155) soulbound — transfers blocked at contract level | P0 |
| NFT-04 | CreatorPass (ERC-721) with monthly subscription pricing and expiry | P0 |
| NFT-05 | ERC-2981 on-chain royalties enforced at contract level (2–10%) | P0 |
| NFT-06 | Marketplace supports fixed-price listings | P0 |
| NFT-07 | Marketplace supports commit-reveal auctions (front-running protection) | P0 |
| NFT-08 | All trades atomic — NFT transfer and payment happen in one transaction | P0 |
| NFT-09 | Platform protocol fee: 2.5% (max 5%, configurable by FEE_MANAGER_ROLE) | P0 |
| NFT-10 | Escrow holds funds during auctions; losing bidders can pull refunds | P0 |
| NFT-11 | Slippage protection on auctions (minimum bid increment) | P1 |
| NFT-12 | NFT metadata pinned to IPFS; content on Arweave for permanence | P1 |
| NFT-13 | Trade history and price chart on each NFT detail page | P1 |
| NFT-14 | Governance NFT (ERC-721) for DAO voting rights | P2 |
| NFT-15 | Contract verification on Polygonscan; source code public | P1 |
| NFT-16 | External audit (Certik / Trail of Bits) before mainnet | P0 — Pre-launch |

### 1.5 Reward System

| ID | Requirement | Priority |
|---|---|---|
| RWD-01 | XP earned for: posting, likes, comments, NFT trades, passes held, referrals, login | P0 |
| RWD-02 | Daily login streak multiplies XP (1× at day 1 → 3× at day 30) | P0 |
| RWD-03 | All reward claims idempotent — retrying never double-awards | P0 |
| RWD-04 | Badge minting happens asynchronously — never blocks user action | P0 |
| RWD-05 | Daily quests reset at 00:00 UTC; weekly quests reset on Monday | P0 |
| RWD-06 | Leaderboard updates within 5 seconds of action | P0 |
| RWD-07 | Global, country-level, and creator-community leaderboards | P1 |
| RWD-08 | Weekly top-10 receive INCAM token rewards from DAO treasury | P1 |
| RWD-09 | Streak shield earnable via quests (not purchasable) | P1 |
| RWD-10 | Quest completion rate-limited per user per day (anti-cheat) | P0 |
| RWD-11 | Gitcoin Passport proof-of-humanity score required for reward claims | P1 |
| RWD-12 | Suspicious burst activity triggers automatic hold + review queue | P1 |
| RWD-13 | Seasonal events with limited-edition NFTs and boosted XP (quarterly) | P2 |
| RWD-14 | XP-based level gates: live streaming unlocks at Level 10 | P2 |
| RWD-15 | Chainlink VRF for any on-chain randomness (mystery badge draws) | P1 |

### 1.6 Payments

| ID | Requirement | Priority |
|---|---|---|
| PAY-01 | Native INCAM platform token as primary currency | P0 |
| PAY-02 | ETH/MATIC accepted as secondary trading currency | P1 |
| PAY-03 | Stripe fiat on-ramp for users without crypto | P1 |
| PAY-04 | Creator funds locked 48 hours after first withdrawal request | P1 |
| PAY-05 | Streaming subscription payments via Sablier or similar | P2 |
| PAY-06 | Revenue split: 85% creator / 2.5% platform / royalty to original creator | P0 |
| PAY-07 | AML/KYC for users withdrawing > $1,000/month equivalent | P1 — Legal |

---

## 2. Non-Functional Requirements

### 2.1 Performance

| Metric | Target | Current Status |
|---|---|---|
| Page LCP | < 2.5 seconds | Not measured |
| API response P95 | < 200ms | Not load-tested |
| Video first frame | < 3 seconds on 4G | Not implemented (no transcoding) |
| NFT trade settlement | < 2 block confirmations (~4s on Polygon) | Met by contract design |
| Leaderboard update latency | < 5 seconds | Met (Redis) |
| Uptime SLA | 99.9% | Not instrumented |
| Concurrent users | 100,000+ | Not load-tested |

### 2.2 Security

| Requirement | Status |
|---|---|
| SIWE — no private keys transmitted | Implemented |
| JWT RS256 asymmetric signing | Implemented |
| Refresh token single-use rotation | Implemented |
| httpOnly + Secure + SameSite=Strict cookies | Implemented |
| Server-side premium content re-validation | Implemented |
| Signed expiring media URLs | Implemented |
| ReentrancyGuard on all payable contract functions | Implemented |
| UUPS proxy upgrades require multisig | Design only — multisig not deployed |
| TOTP enforcement for Creator/Admin | Schema only — verification flow not built |
| Slither static analysis with zero high/critical | Not run yet (needs install) |
| Annual external pentest + bug bounty | Pre-production requirement |
| ClamAV malware scanning | Not wired |
| CSAM scanning | Not implemented |
| PKCE for OAuth flows | Not implemented |
| Gitcoin Passport integration | Not implemented |

### 2.3 Compliance

| Requirement | Status |
|---|---|
| GDPR: user data export endpoint | Not built |
| GDPR: right to erasure (off-chain data) | Not built |
| GDPR: on-chain data immutability disclosure | Needed in Privacy Policy |
| Age verification (18+ platform) | Not built |
| DMCA takedown process | Process undefined |
| Terms of Service wallet-signed acknowledgment | Not built |
| AML/KYC for >$1K/month withdrawals | Not built |

### 2.4 Accessibility

| Requirement | Target | Status |
|---|---|---|
| WCAG compliance level | 2.1 AA | Not audited |
| Keyboard navigation | All interactive elements | Not tested |
| Screen reader support | Full | Not tested |
| Colour contrast ratio | 4.5:1 minimum | Not measured |
| Media alt text and captions | All content | Not implemented |

### 2.5 Mobile

| Requirement | Status |
|---|---|
| Mobile-first design at 375px | Implemented |
| NFT cards legible at 160px width | Implemented |
| Wallet-optional entry for freemium | Implemented |
| Gas abstraction (no manual gas approval) | Not implemented |

---

## 3. Smart Contract Requirements

| Requirement | Implemented |
|---|---|
| Inherit from OpenZeppelin audited base contracts | Yes |
| ReentrancyGuard on all value-transfer functions | Yes |
| Pausable on all critical functions | Yes |
| AccessControl (not Ownable) | Yes |
| UUPS upgradeable | Yes |
| No tx.origin for auth | Yes |
| No block.timestamp for security logic | Yes |
| ERC-2981 royalty standard | Yes |
| Slither: zero high/critical findings | Not verified |
| 100% branch coverage in tests | Not achieved |
| Chainlink VRF for randomness | Not implemented |
| Chainlink price feeds for USD values | Not implemented |
| External audit before mainnet | Required |
| Contract verification on Polygonscan | Post-deployment step |
| Emergency pause by ADMIN multisig | Pause implemented; multisig not deployed |

---

## 4. Infrastructure Requirements

| Requirement | Status |
|---|---|
| Docker Compose for local dev | Implemented |
| Kubernetes manifests | Not created |
| Terraform IaC for all cloud resources | Not created |
| GitHub Actions CI (lint/test/security) | Implemented |
| GitHub Actions CD (blue/green deploy) | Skeleton implemented |
| Database snapshots every 6 hours | Not configured |
| Backup restore tested quarterly | Process not defined |
| PagerDuty alerting | Not configured |
| OpenTelemetry distributed tracing | Not instrumented |
| Snyk in CI for dependency scanning | In CI config |
| Gitleaks in CI for secret scanning | In CI config |
| mTLS between services (Istio/Linkerd) | Not deployed |
