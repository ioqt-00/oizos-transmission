FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build


# ============================================================
# Étape 2 : image de production
# ============================================================

FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

# Dépendances de production
COPY package*.json ./

RUN npm ci --omit=dev

# Serveur Express
COPY server ./server

# Frontend React compilé
COPY --from=build /app/client/dist ./client/dist

# Répertoires de données
RUN mkdir -p \
    /app/server/data \
    /app/server/uploads

EXPOSE 3001

CMD ["node", "server/index.js"]
