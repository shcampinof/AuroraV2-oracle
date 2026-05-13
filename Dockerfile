# syntax=docker/dockerfile:1

FROM node:20.19-bookworm-slim AS frontend-builder
WORKDIR /app/frontend

ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

FROM node:20.19-bookworm-slim AS production
ENV NODE_ENV=production
ENV PORT=7860

WORKDIR /app/backend

COPY backend/package*.json ./
RUN npm ci --omit=dev --no-audit && npm cache clean --force

COPY backend/ ./
COPY --from=frontend-builder /app/frontend/dist ./public/app

RUN chown -R node:node /app
USER node

EXPOSE 7860

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 7860) + '/api/health').then((res) => process.exit(res.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["npm", "run", "start:prod"]
