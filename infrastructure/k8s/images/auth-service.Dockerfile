FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY services/auth-service/package*.json ./
RUN npm ci
COPY services/auth-service/ ./
RUN npm run build

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production PORT=7101
COPY services/auth-service/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build --chown=node:node /app/dist ./dist
USER node
EXPOSE 7101
CMD ["node", "dist/main.js"]
