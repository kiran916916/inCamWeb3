# Development Setup Guide

## Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| Node.js | >= 20.x | Runtime for all services and tooling |
| npm | >= 10.x | Package manager (workspaces) |
| Docker | >= 24.x | PostgreSQL, Redis, Hardhat node |
| Docker Compose | >= 2.x | Multi-container local orchestration |
| Git | >= 2.40 | Version control |
| MetaMask | Latest | Local wallet for testing |

---

## Step 1 — Clone and Install

```bash
git clone https://github.com/kiran916916/inCamWeb3.git
cd inCamWeb3

# Install all workspace dependencies in one pass
npm install
```

---

## Step 2 — Generate RSA Keys for JWT

The auth service uses RS256 asymmetric JWT. You need a key pair locally.

```bash
# Generate 4096-bit private key
openssl genrsa -out private.pem 4096

# Extract the public key
openssl rsa -in private.pem -pubout -out public.pem

# Copy keys to environment (replace newlines with \n for .env)
echo "JWT_PRIVATE_KEY=$(cat private.pem | awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}')"
echo "JWT_PUBLIC_KEY=$(cat public.pem | awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}')"

# Remove key files — never commit these
rm private.pem public.pem
```

---

## Step 3 — Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and fill in at minimum:

```env
# Required for local development
POSTGRES_PASSWORD=local-dev-password
DATABASE_URL=postgresql://incam:local-dev-password@localhost:5432/incam_platform
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=local-dev-password

JWT_PRIVATE_KEY=<from step 2>
JWT_PUBLIC_KEY=<from step 2>
COOKIE_SECRET=any-32-char-string-for-local-dev

# Use Amoy testnet (free faucet available)
RPC_URL=https://rpc-amoy.polygon.technology
CHAIN_ID=80002
NEXT_PUBLIC_CHAIN_ID=80002

# WalletConnect project ID (get free at cloud.walletconnect.com)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your-project-id
```

For local blockchain development, also set:
```env
DEPLOYER_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
# ^ This is Hardhat's default account #0 — safe for local dev only
```

---

## Step 4 — Start Infrastructure

```bash
# Start PostgreSQL and Redis
docker-compose up postgres redis -d

# Verify they are healthy
docker-compose ps
```

Expected output:
```
NAME             STATUS
incam_postgres   running (healthy)
incam_redis      running (healthy)
```

---

## Step 5 — Run Database Migrations

```bash
cd services/auth-service

# Generate Prisma client
npx prisma generate

# Run migrations (creates all tables)
npx prisma migrate dev --name init

cd ../..
```

---

## Step 6 — Compile and Deploy Contracts (Local)

```bash
# Start local Hardhat blockchain node (leave running in a separate terminal)
docker-compose --profile dev up hardhat-node -d

# Compile contracts
cd contracts
npm install
npx hardhat compile

# Deploy to local Hardhat node
npx hardhat run scripts/deploy.ts --network localhost
```

The deployment script prints contract addresses and saves them to `contracts/deployments/31337.json`.

Copy the addresses into your `.env`:
```env
PLATFORM_TOKEN_CONTRACT=0x...
CONTENT_NFT_CONTRACT=0x...
BADGE_NFT_CONTRACT=0x...
MARKETPLACE_CONTRACT=0x...
REWARD_DISTRIBUTOR_CONTRACT=0x...
CREATOR_PASS_CONTRACT=0x...
```

---

## Step 7 — Start All Services

**Option A — All at once (Turbo)**
```bash
npm run dev
```

**Option B — Individual services (easier to read logs)**
```bash
# Terminal 1 — Auth service
cd services/auth-service && npm run dev

# Terminal 2 — Content service
cd services/content-service && npm run dev

# Terminal 3 — Reward service
cd services/reward-service && npm run dev

# Terminal 4 — Frontend
cd frontend && npm run dev
```

---

## Service URLs

| Service | URL | Purpose |
|---|---|---|
| Frontend | http://localhost:3000 | Next.js app |
| Auth Service | http://localhost:3001 | SIWE auth, JWT |
| Content Service | http://localhost:3002 | Upload, access control |
| Reward Service | http://localhost:3004 | XP, quests, leaderboard |
| Health Checks | http://localhost:3001/health | DB + Redis status |

---

## Step 8 — Configure MetaMask for Local Dev

1. Open MetaMask → Settings → Networks → Add Network
2. Fill in:
   - Network Name: `Hardhat Local`
   - RPC URL: `http://127.0.0.1:8545`
   - Chain ID: `31337`
   - Currency Symbol: `ETH`
3. Import a test account:
   - Private key: `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`
   - This account has 10,000 test ETH pre-funded by Hardhat

---

## Step 9 — Seed Test Data (Optional)

```bash
cd contracts
npx hardhat run scripts/seed.ts --network localhost
```

This mints sample NFTs, creates test creator passes, and seeds some trade history.

---

## Running Tests

```bash
# Smart contract tests
cd contracts && npm test

# Smart contract coverage
npx hardhat coverage

# Auth service tests
cd services/auth-service && npm test

# Reward service tests
cd services/reward-service && npm test

# Frontend type check
cd frontend && npm run typecheck

# E2E tests (requires services running)
cd frontend && npx playwright test

# E2E test UI mode
npx playwright test --ui
```

---

## Common Issues

### Port already in use
```bash
# Find what's using port 5432
lsof -i :5432
# Kill it or change the port in docker-compose.yml
```

### Prisma schema out of sync
```bash
cd services/auth-service
npx prisma migrate reset   # drops and recreates all tables
npx prisma migrate dev
```

### Hardhat node connection refused
```bash
# Check it's running
docker-compose ps hardhat-node
# Restart it
docker-compose --profile dev restart hardhat-node
```

### MetaMask stuck on wrong network
Go to MetaMask → Settings → Advanced → Reset Account. This clears the local nonce cache.

---

## Testnet Deployment (Polygon Amoy)

```bash
# Get free MATIC from faucet
# https://faucet.polygon.technology

# Deploy contracts to Amoy
cd contracts
npx hardhat run scripts/deploy.ts --network polygon_amoy

# Verify on Polygonscan
npx hardhat verify --network polygon_amoy <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>
```

Update `.env` with the Amoy contract addresses and set `CHAIN_ID=80002`.
