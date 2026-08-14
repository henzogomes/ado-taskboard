# syntax=docker/dockerfile:1

# ---- build: compile the Vite production bundle ----
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Non-secret ADO_* config is baked into the client bundle at build time
# (see vite.config.ts: define + loadEnv(mode, cwd, 'ADO_')). loadEnv reads
# these from process.env when no matching .env file is present, so setting
# them as build-time env vars here is enough — no .env file is written.
# ADO_PAT is intentionally NOT accepted here: it must never reach the bundle.
ARG ADO_ORG
ARG ADO_PROJECT
ARG ADO_TEAM
ARG ADO_ME
ENV ADO_ORG=$ADO_ORG \
    ADO_PROJECT=$ADO_PROJECT \
    ADO_TEAM=$ADO_TEAM \
    ADO_ME=$ADO_ME

RUN npm run build

# ---- run: serve dist/ + proxy /api/ado with the PAT read at runtime ----
FROM node:20-alpine AS run
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server ./server
COPY --from=build /app/dist ./dist

EXPOSE 5280
CMD ["node", "server/index.mjs"]
