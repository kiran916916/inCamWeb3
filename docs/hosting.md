# InCam Web3 — Production Hosting & Deployment Guide

## Table of Contents

1. [Infrastructure Overview](#infrastructure-overview)
2. [Cloud Provider Options](#cloud-provider-options)
3. [Recommended Architecture (AWS)](#recommended-architecture-aws)
4. [Alternative: GCP Architecture](#alternative-gcp-architecture)
5. [Alternative: Budget-Friendly Stack](#alternative-budget-friendly-stack)
6. [Domain & DNS Setup](#domain--dns-setup)
7. [Database (PostgreSQL)](#database-postgresql)
8. [Cache & Queue (Redis)](#cache--queue-redis)
9. [Object Storage (Cloudflare R2)](#object-storage-cloudflare-r2)
10. [Container Registry & CI/CD](#container-registry--cicd)
11. [Kubernetes Deployment](#kubernetes-deployment)
12. [Smart Contract Deployment](#smart-contract-deployment)
13. [SSL/TLS & Security](#ssltls--security)
14. [Monitoring & Observability](#monitoring--observability)
15. [Cost Estimates](#cost-estimates)
16. [Step-by-Step Production Checklist](#step-by-step-production-checklist)

---

## Infrastructure Overview

```
                         ┌─────────────────┐
                         │   Cloudflare    │
                         │   CDN + WAF     │
                         └────────┬────────┘
                                  │
                         ┌────────▼────────┐
                         │  Load Balancer  │
                         │  (ALB / Nginx)  │
                         └────────┬────────┘
                                  │
            ┌─────────────────────┼─────────────────────┐
            │                     │                     │
   ┌────────▼──────┐    ┌────────▼──────┐    ┌────────▼──────┐
   │   Frontend    │    │  API Gateway  │    │   WebSocket   │
   │  (Next.js)    │    │   (Nginx)     │    │   (future)    │
   │  Port 3000    │    │   Port 80     │    │   Port 3005   │
   └───────────────┘    └───────┬───────┘    └───────────────┘
                                │
              ┌─────────────────┼─────────────────┐
              │                 │                 │
     ┌────────▼──────┐ ┌───────▼───────┐ ┌───────▼───────┐
     │ Auth Service  │ │Content Service│ │Reward Service │
     │  Port 3001    │ │  Port 3002    │ │  Port 3004    │
     └───────┬───────┘ └───────┬───────┘ └───────┬───────┘
             │                 │                 │
     ┌───────▼─────────────────▼─────────────────▼───────┐
     │                Shared Infrastructure               │
     │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
     │  │PostgreSQL│  │  Redis   │  │  Cloudflare R2   │ │
     │  │  (RDS)   │  │(ElastiC.)│  │  (Object Store)  │ │
     │  └──────────┘  └──────────┘  └──────────────────┘ │
     └───────────────────────────────────────────────────┘
                          │
                 ┌────────▼────────┐
                 │ Polygon Network │
                 │  (Smart Contr.) │
                 └─────────────────┘
```

---

## Cloud Provider Options

### Option A: AWS (Recommended for Scale)

| Component | AWS Service | Why |
|-----------|-------------|-----|
| Containers | EKS (Kubernetes) or ECS Fargate | Managed orchestration, auto-scaling |
| Database | RDS PostgreSQL 16 | Automated backups, Multi-AZ failover |
| Cache | ElastiCache Redis 7 | Managed Redis with replication |
| CDN | CloudFront + Cloudflare (dual) | Global edge, DDoS protection |
| Secrets | AWS Secrets Manager | Rotatable secrets, IAM-based access |
| Monitoring | CloudWatch + Grafana | Logs, metrics, alerting |
| CI/CD | GitHub Actions → ECR → EKS | Already configured in repo |

### Option B: GCP

| Component | GCP Service |
|-----------|-------------|
| Containers | GKE Autopilot |
| Database | Cloud SQL PostgreSQL |
| Cache | Memorystore Redis |
| CDN | Cloud CDN |
| Secrets | Secret Manager |

### Option C: Budget-Friendly (< $100/month for MVP)

| Component | Service | Monthly Cost |
|-----------|---------|-------------|
| Containers | Railway / Render / Fly.io | $20-40 |
| Database | Supabase / Neon (managed Postgres) | $0-25 |
| Cache | Upstash Redis (serverless) | $0-10 |
| Frontend | Vercel (Next.js) | $0-20 |
| Storage | Cloudflare R2 | $0-5 |
| **Total** | | **$20-100** |

---

## Recommended Architecture (AWS)

### 1. VPC Setup

```
Region: us-east-1 (or closest to your user base)

VPC: 10.0.0.0/16
├── Public Subnets (2 AZs):
│   ├── 10.0.1.0/24 (us-east-1a) — ALB, NAT Gateway
│   └── 10.0.2.0/24 (us-east-1b) — ALB, NAT Gateway
├── Private Subnets (2 AZs):
│   ├── 10.0.10.0/24 (us-east-1a) — EKS worker nodes
│   └── 10.0.20.0/24 (us-east-1b) — EKS worker nodes
└── Database Subnets (2 AZs):
    ├── 10.0.100.0/24 (us-east-1a) — RDS primary
    └── 10.0.200.0/24 (us-east-1b) — RDS standby
```

### 2. EKS Cluster

```yaml
# eks-cluster.yaml (eksctl config)
apiVersion: eksctl.io/v1alpha5
kind: ClusterConfig

metadata:
  name: incam-production
  region: us-east-1
  version: "1.29"

managedNodeGroups:
  - name: app-nodes
    instanceType: t3.medium    # 2 vCPU, 4 GB — sufficient for 3 services
    desiredCapacity: 3
    minSize: 2
    maxSize: 6
    volumeSize: 50
    labels:
      role: application
    privateNetworking: true

  - name: worker-nodes
    instanceType: t3.small     # For BullMQ badge minting workers
    desiredCapacity: 1
    minSize: 1
    maxSize: 3
    labels:
      role: worker
```

### 3. RDS PostgreSQL

```
Engine: PostgreSQL 16
Instance: db.t3.medium (2 vCPU, 4 GB RAM)
Storage: 100 GB gp3 SSD (auto-scaling to 500 GB)
Multi-AZ: Yes (automatic failover)
Backups: 7-day retention, daily snapshots
Encryption: AES-256 at rest (KMS)
```

### 4. ElastiCache Redis

```
Engine: Redis 7
Node Type: cache.t3.small (1.5 GB)
Cluster Mode: Disabled (single-shard — sufficient for leaderboards + rate limiting)
Multi-AZ: Yes (automatic failover)
Encryption: In-transit (TLS) + at-rest
```

---

## Alternative: GCP Architecture

```bash
# Create GKE Autopilot cluster
gcloud container clusters create-auto incam-production \
  --region=us-central1 \
  --release-channel=regular

# Create Cloud SQL PostgreSQL
gcloud sql instances create incam-db \
  --database-version=POSTGRES_16 \
  --tier=db-custom-2-4096 \
  --region=us-central1 \
  --availability-type=REGIONAL \
  --storage-auto-increase

# Create Memorystore Redis
gcloud redis instances create incam-cache \
  --size=1 \
  --region=us-central1 \
  --redis-version=redis_7_0 \
  --tier=standard
```

---

## Alternative: Budget-Friendly Stack

Best for MVP launch and validation. Can migrate to AWS/GCP later.

### Vercel (Frontend)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy from frontend directory
cd frontend
vercel --prod

# Environment variables (set in Vercel dashboard):
# NEXT_PUBLIC_API_URL=https://api.incam.io
# NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=<your-id>
# NEXT_PUBLIC_CHAIN_ID=137
```

### Railway (Backend Services)

```bash
# Install Railway CLI
npm i -g @railway/cli

# Deploy each service
cd services/auth-service
railway init
railway up

cd ../content-service
railway init
railway up

cd ../reward-service
railway init
railway up
```

Railway provides managed PostgreSQL and Redis add-ons directly in the dashboard.

### Fly.io (Alternative Backend)

```toml
# fly.toml (per service)
app = "incam-auth-service"
primary_region = "iad"

[build]
  dockerfile = "../../infrastructure/docker/service.Dockerfile"

[env]
  NODE_ENV = "production"
  PORT = "3001"

[http_service]
  internal_port = 3001
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 1

[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory_mb = 512
```

---

## Domain & DNS Setup

### Domain Registration

Register your domain (e.g., `incam.io`) via Cloudflare Registrar, Namecheap, or Google Domains.

### DNS Records (Cloudflare DNS)

```
Type  Name              Value                          Proxy
A     incam.io          <load-balancer-ip>             Yes (orange cloud)
A     api.incam.io      <api-load-balancer-ip>         Yes
CNAME www.incam.io      incam.io                       Yes
CNAME app.incam.io      <vercel-cname>.vercel-dns.com  Yes (if using Vercel)
```

### Cloudflare Settings

```
SSL/TLS:        Full (Strict)
Always HTTPS:   On
Min TLS:        1.2
HSTS:           On (max-age 31536000, includeSubDomains)
WAF:            On (OWASP Core Ruleset)
Rate Limiting:  100 req/10s per IP on /api/*
Bot Management: On (Challenge suspected bots)
```

---

## Database (PostgreSQL)

### Production Configuration

```sql
-- Connection pooling (use PgBouncer or RDS Proxy)
-- Target: 100 connections per service, max 300 total

-- Essential extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";     -- for text search
CREATE EXTENSION IF NOT EXISTS "btree_gist";  -- for range queries
```

### Prisma Migration (run once on first deploy)

```bash
# From auth-service (shares schema with other services)
DATABASE_URL="postgresql://incam:<password>@<rds-endpoint>:5432/incam_platform" \
  npx prisma migrate deploy
```

### Backup Strategy

```
Automated:  RDS daily snapshots, 7-day retention
Point-in-time: RDS continuous backup (5-minute granularity)
Manual:     pg_dump before major migrations
Off-site:   Weekly export to S3 Glacier (90-day retention)
```

---

## Cache & Queue (Redis)

### Production Configuration

```
# redis.conf adjustments for production
maxmemory 1gb
maxmemory-policy allkeys-lru
save ""                        # Disable RDB persistence (ElastiCache handles this)
appendonly no                  # Use ElastiCache replication instead
tcp-keepalive 60
timeout 300
```

### Key Namespacing

```
Leaderboard:  leaderboard:global, leaderboard:weekly:<week>
Rate Limits:  rl:xp:<userId>:<action>:<date>
Nonces:       nonce:<hex>
Sessions:     session:<sessionId>
BullMQ:       bull:reward-queue:*
```

---

## Object Storage (Cloudflare R2)

### Setup

1. Go to Cloudflare Dashboard → R2
2. Create bucket: `incam-media`
3. Create API token with read/write access
4. Configure CORS:

```json
[
  {
    "AllowedOrigins": ["https://incam.io", "https://app.incam.io"],
    "AllowedMethods": ["GET", "PUT"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

### Custom Domain for R2

```
Bucket URL:  https://media.incam.io
CNAME:       media.incam.io → <bucket>.r2.cloudflarestorage.com
```

### Cost Advantage over S3

```
R2 Egress:   $0.00/GB  (zero egress fees)
S3 Egress:   $0.09/GB
At 1TB/month: R2 saves $90/month vs S3
```

---

## Container Registry & CI/CD

### GitHub Container Registry (GHCR)

Already configured in `.github/workflows/ci.yml`. Images are pushed to:

```
ghcr.io/kiran916916/incamweb3/auth-service:<sha>
ghcr.io/kiran916916/incamweb3/content-service:<sha>
ghcr.io/kiran916916/incamweb3/reward-service:<sha>
ghcr.io/kiran916916/incamweb3/frontend:<sha>
```

### CI/CD Pipeline

```
Push to main
  └─→ CI: lint + typecheck + test + build + security scan
       └─→ Build Docker images → push to GHCR
            └─→ Manual trigger: Deploy to staging
                 └─→ Smoke test passes
                      └─→ Manual trigger: Deploy to production
                           └─→ Auto-rollback on failure
```

### GitHub Secrets to Configure

```
KUBECONFIG             — Base64-encoded kubeconfig for kubectl
GHCR_TOKEN             — GitHub PAT for container registry
POSTGRES_PASSWORD      — Production database password
REDIS_PASSWORD         — Production Redis password
JWT_PRIVATE_KEY        — RSA private key (PEM format)
JWT_PUBLIC_KEY         — RSA public key (PEM format)
COOKIE_SECRET          — 32+ character random string
R2_ACCESS_KEY_ID       — Cloudflare R2 access key
R2_SECRET_ACCESS_KEY   — Cloudflare R2 secret key
MINTER_PRIVATE_KEY     — Wallet private key for badge minting
POLYGONSCAN_API_KEY    — For contract verification
```

---

## Kubernetes Deployment

### Namespace Setup

```bash
kubectl create namespace incam-staging
kubectl create namespace incam-production
```

### Service Deployment Manifests

```yaml
# k8s/auth-service.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: auth-service
  namespace: incam-production
spec:
  replicas: 2
  selector:
    matchLabels:
      app: auth-service
  template:
    metadata:
      labels:
        app: auth-service
    spec:
      containers:
        - name: auth-service
          image: ghcr.io/kiran916916/incamweb3/auth-service:latest
          ports:
            - containerPort: 3001
          env:
            - name: NODE_ENV
              value: "production"
            - name: PORT
              value: "3001"
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: incam-secrets
                  key: database-url
            - name: REDIS_HOST
              value: "incam-redis.xxxxx.cache.amazonaws.com"
            - name: JWT_PRIVATE_KEY
              valueFrom:
                secretKeyRef:
                  name: incam-secrets
                  key: jwt-private-key
          resources:
            requests:
              cpu: 250m
              memory: 256Mi
            limits:
              cpu: 500m
              memory: 512Mi
          livenessProbe:
            httpGet:
              path: /health
              port: 3001
            initialDelaySeconds: 15
            periodSeconds: 30
          readinessProbe:
            httpGet:
              path: /health
              port: 3001
            initialDelaySeconds: 5
            periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: auth-service
  namespace: incam-production
spec:
  selector:
    app: auth-service
  ports:
    - port: 3001
      targetPort: 3001
  type: ClusterIP
```

### Ingress (NGINX Ingress Controller)

```yaml
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: incam-ingress
  namespace: incam-production
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/rate-limit: "100"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  tls:
    - hosts:
        - api.incam.io
      secretName: incam-tls
  rules:
    - host: api.incam.io
      http:
        paths:
          - path: /api/auth
            pathType: Prefix
            backend:
              service:
                name: auth-service
                port:
                  number: 3001
          - path: /api/content
            pathType: Prefix
            backend:
              service:
                name: content-service
                port:
                  number: 3002
          - path: /api/rewards
            pathType: Prefix
            backend:
              service:
                name: reward-service
                port:
                  number: 3004
```

### Horizontal Pod Autoscaler

```yaml
# k8s/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: auth-service-hpa
  namespace: incam-production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: auth-service
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

---

## Smart Contract Deployment

### Polygon Mainnet Deployment

```bash
cd contracts

# Set environment variables
export DEPLOYER_PRIVATE_KEY=<multisig-deployer-key>
export RPC_URL=https://polygon-rpc.com
export POLYGONSCAN_API_KEY=<your-api-key>

# Deploy all contracts
npx hardhat run scripts/deploy.ts --network polygon

# Verify on Polygonscan (for each contract)
npx hardhat verify --network polygon <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>
```

### Contract Addresses (save after deployment)

```
PlatformToken:      0x...
ContentNFT:         0x...
EditionNFT:         0x...
BadgeNFT:           0x...
CreatorPass:        0x...
Marketplace:        0x...
Escrow:             0x...
RewardDistributor:  0x...
```

### Multisig Setup (Gnosis Safe)

```
Create a Gnosis Safe multisig on Polygon:
  - Owners: 3 team members
  - Threshold: 2/3 signatures required
  - Transfer DEFAULT_ADMIN_ROLE to the multisig
  - Transfer UPGRADER_ROLE to the multisig
  - Keep DISTRIBUTOR_ROLE on the reward-service wallet
  - Keep MINTER_ROLE on the badge-minting wallet
```

### RPC Providers

```
Primary:    Alchemy (https://polygon-mainnet.g.alchemy.com/v2/<key>)
Fallback:   Infura  (https://polygon-mainnet.infura.io/v3/<key>)
Public:     https://polygon-rpc.com (rate limited, not for production)
```

---

## SSL/TLS & Security

### Certificate Management

```bash
# Option A: Cloudflare (recommended — automatic)
# Cloudflare provides free SSL when proxying (orange cloud on)

# Option B: Let's Encrypt via cert-manager (for Kubernetes)
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.14.0/cert-manager.yaml

# Create ClusterIssuer
cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: security@incam.io
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
      - http01:
          ingress:
            class: nginx
EOF
```

### Security Headers (already in next.config.ts)

```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

### Key Rotation Schedule

```
JWT RSA Keys:         Rotate every 90 days
Cookie Secret:        Rotate every 90 days
R2 API Keys:          Rotate every 180 days
Minter Private Key:   Rotate only if compromised (transfer role to new wallet)
Database Password:    Rotate every 90 days
Redis Password:       Rotate every 90 days
```

---

## Monitoring & Observability

### Application Monitoring

```
Option A: Datadog        ($15/host/month)
Option B: Grafana Cloud   (free tier: 10k metrics, 50 GB logs)
Option C: AWS CloudWatch  (included with AWS)
```

### Key Metrics to Monitor

```
Application:
  - Request latency (p50, p95, p99) per service
  - Error rate (4xx, 5xx) per endpoint
  - Active connections per service
  - BullMQ queue depth and processing time

Infrastructure:
  - CPU/Memory per pod
  - Database connections (active vs idle)
  - Redis memory usage and hit rate
  - Disk I/O on database

Blockchain:
  - Gas price on Polygon
  - Transaction success/failure rate
  - Badge mint queue backlog
  - Contract balance (treasury tokens remaining)

Business:
  - Daily active users (DAU)
  - Content uploads per day
  - NFT trades per day
  - XP awarded per day
```

### Alerting Rules

```yaml
# Example Grafana alert rules
alerts:
  - name: High Error Rate
    condition: rate(http_errors_total[5m]) > 0.05
    severity: critical
    notify: pagerduty

  - name: Database Connection Pool Exhausted
    condition: pg_active_connections > 80
    severity: warning
    notify: slack

  - name: Badge Mint Queue Backlog
    condition: bullmq_waiting_count{queue="reward-queue"} > 100
    severity: warning
    notify: slack

  - name: Treasury Balance Low
    condition: contract_token_balance < 10000
    severity: critical
    notify: pagerduty
```

### Logging

```bash
# Structured JSON logging (already in Fastify)
# Ship logs via:

# Option A: Fluentd/Fluent Bit → Elasticsearch/Loki
# Option B: CloudWatch Logs (if on AWS)
# Option C: Datadog Agent
```

---

## Cost Estimates

### Small Scale (MVP Launch, < 1K users)

| Service | Monthly Cost |
|---------|-------------|
| Vercel (Frontend) | $0 (free tier) |
| Railway (3 services) | $15 |
| Supabase (PostgreSQL) | $0 (free tier) |
| Upstash (Redis) | $0 (free tier) |
| Cloudflare R2 (10 GB) | $0.15 |
| Cloudflare DNS + CDN | $0 |
| Domain | $1 |
| **Total** | **~$16/month** |

### Medium Scale (1K-50K users)

| Service | Monthly Cost |
|---------|-------------|
| AWS EKS (3 t3.medium) | $200 |
| RDS PostgreSQL (db.t3.medium) | $70 |
| ElastiCache Redis (cache.t3.small) | $25 |
| Cloudflare R2 (1 TB) | $15 |
| ALB | $25 |
| CloudWatch | $20 |
| Domain + SSL | $1 |
| **Total** | **~$360/month** |

### Large Scale (50K+ users)

| Service | Monthly Cost |
|---------|-------------|
| AWS EKS (6-10 nodes, auto-scaled) | $500-1000 |
| RDS PostgreSQL (db.r6g.large, Multi-AZ) | $350 |
| ElastiCache Redis (cache.r6g.large) | $200 |
| Cloudflare R2 (10 TB) | $150 |
| ALB + WAF | $100 |
| Datadog / Grafana Cloud | $200 |
| **Total** | **~$1,500-2,000/month** |

### Blockchain Costs (Polygon)

```
Avg gas per transaction:  ~$0.001-0.01
Badge mint:               ~$0.005
NFT listing:              ~$0.003
NFT purchase:             ~$0.008
Reward claim:             ~$0.005
Batch reward (50 users):  ~$0.05

Monthly estimate (10K transactions): ~$50-100
```

---

## Step-by-Step Production Checklist

### Phase 1: Infrastructure Setup (Day 1-2)

- [ ] Register domain (incam.io or similar)
- [ ] Set up Cloudflare account, add domain
- [ ] Choose hosting provider (AWS / Railway / Vercel)
- [ ] Provision PostgreSQL database
- [ ] Provision Redis instance
- [ ] Create Cloudflare R2 bucket with CORS policy
- [ ] Generate RSA key pair for JWT signing:
  ```bash
  openssl genrsa -out private.pem 4096
  openssl rsa -in private.pem -pubout -out public.pem
  ```

### Phase 2: Secret Management (Day 2)

- [ ] Store all secrets in GitHub Secrets (or AWS Secrets Manager)
- [ ] Generate strong passwords for PostgreSQL and Redis
- [ ] Generate 64-character random COOKIE_SECRET
- [ ] Create Cloudflare R2 API credentials
- [ ] Set up Alchemy/Infura RPC endpoint
- [ ] Create a dedicated wallet for the minter service (fund with MATIC for gas)

### Phase 3: Smart Contract Deployment (Day 3)

- [ ] Deploy contracts to Polygon Amoy testnet first
- [ ] Run full test suite against testnet deployment
- [ ] Set up Gnosis Safe multisig on Polygon mainnet
- [ ] Deploy contracts to Polygon mainnet
- [ ] Verify all contracts on Polygonscan
- [ ] Transfer admin roles to multisig
- [ ] Fund RewardDistributor contract with INCAM tokens
- [ ] Record all contract addresses in environment config

### Phase 4: Backend Deployment (Day 4-5)

- [ ] Build and push Docker images to GHCR
- [ ] Run database migrations: `npx prisma migrate deploy`
- [ ] Deploy auth-service with health check verification
- [ ] Deploy content-service with R2 connectivity test
- [ ] Deploy reward-service with Redis + blockchain connectivity test
- [ ] Configure API routing (path-based or subdomain)
- [ ] Set `ALLOWED_ORIGINS` to production domain

### Phase 5: Frontend Deployment (Day 5)

- [ ] Set all `NEXT_PUBLIC_*` environment variables
- [ ] Build and deploy frontend
- [ ] Verify wallet connection flow (MetaMask, WalletConnect)
- [ ] Test SIWE authentication end-to-end
- [ ] Verify Cloudflare CDN caching for static assets

### Phase 6: Security Hardening (Day 6)

- [ ] Enable Cloudflare WAF (OWASP ruleset)
- [ ] Configure rate limiting on API endpoints
- [ ] Enable Cloudflare Bot Management
- [ ] Verify all cookies are httpOnly + Secure + SameSite=Strict
- [ ] Verify CORS only allows production origins
- [ ] Run OWASP ZAP scan against API
- [ ] Verify CSP headers block inline scripts (except where needed)
- [ ] Ensure database is not publicly accessible

### Phase 7: Monitoring & Alerts (Day 7)

- [ ] Set up Grafana Cloud / Datadog / CloudWatch
- [ ] Configure alerting for error rate spikes
- [ ] Configure alerting for database connection pool
- [ ] Configure alerting for Redis memory usage
- [ ] Configure alerting for badge mint queue depth
- [ ] Set up uptime monitoring (Cloudflare Health Checks or UptimeRobot)
- [ ] Set up PagerDuty / Slack webhook for critical alerts

### Phase 8: Launch (Day 8)

- [ ] Smoke test all endpoints on production
- [ ] Test wallet connection → sign-in → content access flow
- [ ] Test NFT minting and marketplace listing
- [ ] Test reward XP flow and leaderboard
- [ ] Monitor logs and metrics during first 24 hours
- [ ] Be ready to rollback: `kubectl rollout undo deployment -n incam-production`

---

## Quick Start Commands

### Deploy to Railway (Fastest Path)

```bash
# 1. Install Railway CLI
npm i -g @railway/cli && railway login

# 2. Create project
railway init --name incam

# 3. Add PostgreSQL and Redis
railway add --plugin postgresql
railway add --plugin redis

# 4. Deploy services
cd services/auth-service && railway up
cd ../content-service && railway up
cd ../reward-service && railway up

# 5. Deploy frontend to Vercel
cd ../../frontend && vercel --prod
```

### Deploy to AWS EKS

```bash
# 1. Create cluster
eksctl create cluster -f eks-cluster.yaml

# 2. Install ingress controller
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.10.0/deploy/static/provider/aws/deploy.yaml

# 3. Create secrets
kubectl create secret generic incam-secrets \
  --from-literal=database-url="postgresql://..." \
  --from-literal=jwt-private-key="$(cat private.pem)" \
  --from-literal=cookie-secret="$(openssl rand -hex 32)" \
  -n incam-production

# 4. Deploy services
kubectl apply -f k8s/ -n incam-production

# 5. Verify
kubectl get pods -n incam-production
kubectl get ingress -n incam-production
```
