FROM node:24-bookworm-slim AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:24-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY src ./src
RUN mkdir -p /data && chown -R node:node /data
USER node
EXPOSE 3000
ENV HOST=0.0.0.0
ENV PORT=3000
ENV DATABASE_PATH=/data/app.sqlite
CMD ["npm", "start"]
