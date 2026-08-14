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
RUN npm ci --omit=dev

COPY server ./server
COPY --from=build /app/dist ./dist

EXPOSE 5280
CMD ["node", "server/index.mjs"]
