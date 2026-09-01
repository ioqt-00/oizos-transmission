FROM node:22-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

# Build du frontend React
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3001

RUN mkdir -p \
    /app/server/data \
    /app/server/uploads

EXPOSE 3001

CMD ["npx", "tsx", "server/index.ts"]
