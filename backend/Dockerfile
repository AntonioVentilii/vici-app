# VICI backend image for Fly.io. Bun runs the TypeScript entrypoint directly,
# so there is no build/transpile step. See fly.toml.
FROM oven/bun:1-alpine

WORKDIR /app

# Install deps first for layer caching. --frozen-lockfile fails if bun.lock is
# stale; --production skips devDependencies (typescript/@types) not needed at run.
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY . .

ENV NODE_ENV=production
EXPOSE 8787

CMD ["bun", "run", "src/index.ts"]
