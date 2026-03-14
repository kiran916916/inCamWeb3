FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install production dependencies
FROM base AS deps
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

# Build stage — install all deps (including devDependencies for tsc)
FROM base AS build
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
COPY . .
# Generate Prisma client if schema exists
RUN if [ -d prisma ]; then npx prisma generate; fi
RUN npm run build

# Production image — minimal attack surface
FROM base AS runner
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 serviceuser

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./

# Copy Prisma schema + generated client if present
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma

USER serviceuser

ENV NODE_ENV=production
ARG PORT=3000
EXPOSE ${PORT}

CMD ["node", "dist/index.js"]
