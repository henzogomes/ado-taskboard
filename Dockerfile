# syntax=docker/dockerfile:1

# ---- build: compile the Vite production bundle ----
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# No ADO config is baked in: org/project/team/me and the PAT all come from the
# active browser connection at runtime. The container just serves the app.
RUN npm run build

# ---- run: serve dist/ + proxy /api/ado (pure relay of the connection's org/PAT) ----
FROM node:20-alpine AS run
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
# --ignore-scripts: the runtime image installs prod deps only, so the `prepare`
# lifecycle script (husky, a devDep omitted here) must not run — it isn't
# present, and this stage has no git hooks to set up anyway. Without this,
# `npm ci --omit=dev` fails with `husky: not found` (exit 127).
RUN npm ci --omit=dev --ignore-scripts

COPY server ./server
COPY --from=build /app/dist ./dist

EXPOSE 5280
CMD ["node", "server/index.mjs"]
