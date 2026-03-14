# Implementation Guide

## 1. Repository Structure

```
inCamWeb3/
├── contracts/                    # Solidity smart contracts
│   ├── contracts/
│   │   ├── token/PlatformToken.sol
│   │   ├── nft/ContentNFT.sol
│   │   ├── nft/EditionNFT.sol
│   │   ├── nft/BadgeNFT.sol
│   │   ├── marketplace/Marketplace.sol
│   │   ├── marketplace/Escrow.sol
│   │   ├── rewards/RewardDistributor.sol
│   │   └── access/CreatorPass.sol
│   ├── scripts/deploy.ts         # Deployment script
│   ├── test/                     # Contract tests
│   └── hardhat.config.ts
│
├── frontend/                     # Next.js 14 application
│   ├── src/
│   │   ├── app/                  # App Router pages
│   │   ├── components/           # React components
│   │   ├── lib/                  # Utilities and hooks
│   │   │   ├── auth/             # SIWE AuthProvider
│   │   │   ├── api.ts            # Axios client
│   │   │   └── wagmi.ts          # Wagmi config
│   │   ├── store/                # Zustand state
│   │   └── types/                # Shared TypeScript types
│   ├── tests/e2e/                # Playwright tests
│   └── public/
│
├── services/
│   ├── auth-service/             # SIWE auth, JWT issuance
│   │   ├── src/
│   │   │   ├── routes/auth.ts    # Auth endpoints
│   │   │   ├── routes/health.ts  # Health check
│   │   │   └── utils/            # Redis, DB, crypto helpers
│   │   └── prisma/schema.prisma  # Database schema
│   │
│   ├── content-service/          # Upload, access control, feed
│   │   └── src/
│   │       ├── routes/content.ts
│   │       └── utils/            # Storage, access control, DB
│   │
│   └── reward-service/           # XP, quests, badges, leaderboard
│       └── src/
│           ├── routes/           # rewards, quests, leaderboard
│           ├── workers/          # BadgeMintWorker (BullMQ)
│           └── utils/            # Redis, DB, queue
│
├── infrastructure/
│   ├── docker/                   # Dockerfiles
│   ├── kubernetes/               # K8s manifests (to be created)
│   └── terraform/                # IaC (to be created)
│
├── docs/                         # This documentation
├── docker-compose.yml
├── .env.example
└── turbo.json                    # Turborepo pipeline config
```

---

## 2. Smart Contract Patterns

### 2.1 All Contracts Follow This Pattern

```solidity
contract Example is
    Initializable,          // OpenZeppelin: prevent double-init
    ERC721Upgradeable,      // base token standard
    AccessControlUpgradeable, // role-based access (not Ownable)
    PausableUpgradeable,    // emergency pause
    ReentrancyGuardUpgradeable, // prevent re-entrant calls
    UUPSUpgradeable         // upgrade pattern
{
    // 1. Role constants (keccak256 hashes)
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    // 2. Storage variables (never reorder — breaks proxy storage layout)

    // 3. Events (emitted for every state change — indexed by The Graph)

    // 4. Constructor disables initializers (security: prevent impl attack)
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    // 5. Initialize (replaces constructor for proxy pattern)
    function initialize(...) public initializer {
        __ERC721_init(...);
        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    // 6. State-changing functions: onlyRole + nonReentrant + whenNotPaused

    // 7. View functions

    // 8. Required overrides (always last)
}
```

### 2.2 Adding New Contract State (Proxy Safety)

When upgrading a contract, **always append** new storage variables. Never remove or reorder existing ones.

```solidity
// V1 storage
uint256 public feeRate;
address public treasury;

// V2 storage — append only
uint256 public feeRate;    // unchanged
address public treasury;   // unchanged
bool public newFeature;    // new variable appended at end
```

### 2.3 Generating Idempotent Reward IDs

```typescript
// Off-chain (TypeScript)
import { keccak256, encodePacked } from 'viem'

const rewardId = keccak256(encodePacked(
  ['string', 'string', 'string'],
  [userId, questId, dateBucket]  // e.g. "clxyz", "daily-login", "2024-01-15"
))
```

```solidity
// On-chain (Solidity)
bytes32 rewardId = keccak256(abi.encodePacked(userId, questId, dateBucket));
require(!claimed[rewardId], "already claimed");
claimed[rewardId] = true;
```

---

## 3. Backend Service Patterns

### 3.1 Service Bootstrap Template

Every Fastify service follows the same bootstrap order:

```typescript
// 1. Register security plugins first
await app.register(fastifyHelmet, ...)
await app.register(fastifyCors, { origin: allowedOrigins, credentials: true })

// 2. Authentication middleware
await app.register(fastifyJwt, { secret: { public: publicKey } })

// 3. Rate limiting
await app.register(fastifyRateLimit, { max: 100, timeWindow: '1 minute' })

// 4. Routes (with prefix)
await app.register(routes, { prefix: '/api/resource' })

// 5. Global error handler
app.setErrorHandler((error, request, reply) => { ... })
```

### 3.2 Protected Route Pattern

```typescript
// Attach authenticate decorator once at startup
app.decorate('authenticate', async (request, reply) => {
  try {
    await request.jwtVerify()
  } catch (err) {
    reply.status(401).send({ error: 'Unauthorized' })
  }
})

// Use as preHandler on any protected endpoint
app.post('/protected', {
  preHandler: [app.authenticate]
}, async (request, reply) => {
  const { sub: userId } = request.user as { sub: string }
  // ...
})
```

### 3.3 Input Validation — Schema First

Every endpoint defines a Zod schema before implementation.

```typescript
// Define schema
const CreateContentSchema = z.object({
  title:       z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  tier:        z.enum(['freemium', 'premium']),
  type:        z.enum(['video', 'image', 'audio', 'text']),
})

// Validate before any business logic
const parsed = CreateContentSchema.safeParse(request.body)
if (!parsed.success) {
  return reply.status(400).send({
    error: 'Validation failed',
    details: parsed.error.format(),
  })
}
// Only use parsed.data from here — never request.body directly
```

### 3.4 Parameterised Queries (Prisma ORM)

Never concatenate user input into SQL. All queries use Prisma's parameterised interface.

```typescript
// Correct — parameterised
const user = await db.user.findUnique({
  where: { walletAddress: walletAddress.toLowerCase() }
})

// Never do this — SQL injection risk
const user = await db.$queryRawUnsafe(
  `SELECT * FROM users WHERE wallet = '${walletAddress}'`
)
```

### 3.5 Redis Key Conventions

```
Sessions:      session:{userId}              TTL: 7 days
Nonces:        nonce:{nonceValue}            TTL: 5 minutes
Rate limits:   rl:{action}:{userId}:{date}   TTL: 1 day
Leaderboard:   leaderboard:global            No TTL (permanent sorted set)
Weekly board:  leaderboard:weekly:{weekKey}  Manually flushed on settlement
Access cache:  access:{wallet}:{contentId}   TTL: 60 seconds
```

---

## 4. Frontend Patterns

### 4.1 Server vs Client Components

```typescript
// Server Component (default) — for data fetching, no interactivity
// src/app/marketplace/page.tsx
export default async function MarketplacePage() {
  const data = await fetch('...')  // runs on server
  return <MarketplaceGrid initialData={data} />
}

// Client Component — for interactivity, hooks, wallet access
// src/components/marketplace/MarketplaceGrid.tsx
'use client'
import { useState } from 'react'
export function MarketplaceGrid() {
  const [filter, setFilter] = useState('all')
  // ...
}
```

### 4.2 Wallet Interaction Pattern

Always use `wagmi` hooks. Never access `window.ethereum` directly.

```typescript
'use client'
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { marketplaceAbi } from '@/lib/abis'

export function BuyButton({ listingId }: { listingId: bigint }) {
  const { writeContract, data: hash } = useWriteContract()
  const { isLoading } = useWaitForTransactionReceipt({ hash })

  return (
    <button
      onClick={() => writeContract({
        address: MARKETPLACE_ADDRESS,
        abi: marketplaceAbi,
        functionName: 'buyFixed',
        args: [listingId],
      })}
      disabled={isLoading}
    >
      {isLoading ? 'Confirming...' : 'Buy Now'}
    </button>
  )
}
```

### 4.3 API Client Usage

```typescript
import { api } from '@/lib/api'

// GET request — withCredentials sends the refresh cookie automatically
const { data } = await api.get<{ user: User }>('/auth/me')

// POST request with body
const { data } = await api.post<{ content: Content }>('/content', {
  title, description, tier
})
```

### 4.4 Toast Notifications

```typescript
import { toast } from '@/store/toastStore'

// Success
toast.success('NFT purchased!', 'Transaction confirmed')

// Error
toast.error('Transaction failed. Please try again.', 'Error')

// Info
toast.info('Processing your mint...')
```

### 4.5 Wallet Address Display

```typescript
// Always truncate addresses in the UI
function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

// Usage
<span className="wallet-address">{truncateAddress(user.walletAddress)}</span>
```

---

## 5. Content Access Control Flow

This is the most security-critical flow in the platform.

```typescript
// content-service/src/routes/content.ts

async function getContent(request, reply) {
  const content = await db.content.findUnique({ where: { id } })

  // 1. Never serve non-published content
  if (content.status !== 'published') return reply.status(404).send(...)

  // 2. Freemium: serve without access check, CDN public URL
  if (content.tier === 'freemium') {
    return reply.send({ content, mediaUrl: CDN_PUBLIC_URL })
  }

  // 3. Premium: always re-validate on the server
  const user = request.user  // JWT verified
  const wallet = await getUserWallet(user.sub)

  // 4. Check access mode against blockchain state
  const hasAccess = await verifyContentAccess({ wallet, content })
  if (!hasAccess) return reply.status(403).send({ error: 'Access denied' })

  // 5. Issue signed, expiring URL — never a permanent public URL
  const signedUrl = await getSignedUrl(s3, new GetObjectCommand({
    Bucket: R2_BUCKET,
    Key: content.storageKey,
  }), { expiresIn: 900 })  // 15 minutes

  return reply.send({ content, mediaUrl: signedUrl })
}
```

---

## 6. Event-Driven Architecture

Services communicate via events on the message bus (Kafka / SQS). This decouples services and allows retry on failure.

```
Event: content.published
  Producer: content-service (after moderation passes)
  Consumers:
    - nft-service  → triggers metadata build + IPFS pin + mint
    - search-service → indexes content for search

Event: nft.minted
  Producer: nft-service (after tx confirmed)
  Consumers:
    - reward-service → award XP for creator, check badges
    - analytics-service → record mint event

Event: trade.settled
  Producer: marketplace-service (after Marketplace.Sale event on-chain)
  Consumers:
    - reward-service → award XP for buyer/seller
    - notification-service → notify creator of royalty received
    - analytics-service → record trade volume

Event: quest.completed
  Producer: reward-service (when UserQuest.progress reaches total)
  Consumers:
    - notification-service → notify user
    - reward-service → queue on-chain token claim
```

---

## 7. Adding a New Service

1. Create `services/my-service/` with `package.json`, `src/index.ts`
2. Follow the Fastify bootstrap template (section 3.1)
3. Add to `docker-compose.yml` with `depends_on: postgres, redis`
4. Add health check endpoint at `GET /health`
5. Add to `turbo.json` pipeline
6. Add Docker build step to `ci.yml`
7. Add Kubernetes deployment manifest in `infrastructure/kubernetes/`

---

## 8. Adding a New Smart Contract

1. Create file in appropriate `contracts/contracts/` subdirectory
2. Follow the contract pattern (section 2.1)
3. Add to `contracts/scripts/deploy.ts`
4. Write tests in `contracts/test/` with 100% branch coverage target
5. Run `npx hardhat coverage` — must show 100% for new contract
6. Run `slither contracts/contracts/new-contract.sol` — zero high/critical findings
7. Add contract address to `.env.example` and deployment docs

---

## 9. Environment Variable Reference

| Variable | Service | Required | Description |
|---|---|---|---|
| `DATABASE_URL` | auth, content, reward | P0 | PostgreSQL connection string |
| `REDIS_HOST` | auth, content, reward | P0 | Redis hostname |
| `REDIS_PASSWORD` | auth, content, reward | P0 | Redis auth password |
| `JWT_PRIVATE_KEY` | auth-service | P0 | RS256 private key for signing JWTs |
| `JWT_PUBLIC_KEY` | all services | P0 | RS256 public key for verifying JWTs |
| `COOKIE_SECRET` | auth-service | P0 | Secret for signing cookie values |
| `RPC_URL` | content, reward | P0 | Polygon RPC endpoint |
| `CHAIN_ID` | content, reward | P0 | `137` (mainnet) or `80002` (Amoy) |
| `R2_ENDPOINT` | content-service | P0 | Cloudflare R2 S3-compatible endpoint |
| `R2_ACCESS_KEY_ID` | content-service | P0 | R2 access key |
| `R2_SECRET_ACCESS_KEY` | content-service | P0 | R2 secret key |
| `R2_BUCKET` | content-service | P0 | R2 bucket name |
| `MINTER_PRIVATE_KEY` | reward-service | P0 | Service wallet for badge minting |
| `BADGE_NFT_CONTRACT` | reward-service | P0 | Deployed BadgeNFT address |
| `REWARD_DISTRIBUTOR_CONTRACT` | reward-service | P0 | Deployed RewardDistributor address |
| `CREATOR_PASS_CONTRACT` | content-service | P0 | Deployed CreatorPass address |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | frontend | P0 | WalletConnect cloud project ID |
| `PINATA_API_KEY` | nft-service | P1 | For IPFS pinning |
| `STRIPE_SECRET_KEY` | payment-service | P1 | Stripe fiat on-ramp |
