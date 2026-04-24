FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-slim
RUN useradd -u 1001 -m appuser
WORKDIR /app
COPY --from=build /app/build ./build
COPY --from=build /app/package.json /app/package-lock.json ./
# --ignore-scripts: the production image has no git history and no devDeps, so
# the `prepare` script (svelte-kit sync + simple-git-hooks) would fail here.
# But that flag also skips better-sqlite3's `install` hook that downloads its
# native binding — `npm rebuild better-sqlite3` runs it explicitly so the
# SQLite cache actually works instead of silently falling back to in-memory.
# /app/data is the default DB location; creating it before chown ensures the
# named volume mounts inherit appuser ownership instead of root root.
RUN npm ci --omit=dev --ignore-scripts \
    && npm rebuild better-sqlite3 \
    && mkdir -p /app/data \
    && chown -R appuser:appuser /app
USER appuser
EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "build"]
