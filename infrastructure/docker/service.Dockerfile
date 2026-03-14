FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies only when needed
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci --only=production

FROM base AS build
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

# Production image — minimal attack surface
FROM base AS runner
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 serviceuser

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./

# Copy Prisma schema for migrations
COPY prisma ./prisma
RUN npx prisma generate

USER serviceuser

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "dist/index.js"]
