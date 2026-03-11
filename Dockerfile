# syntax=docker/dockerfile:1

FROM node:20.19-alpine AS frontend-builder
WORKDIR /app/frontend

ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

FROM node:20.19-alpine AS production
ENV NODE_ENV=production
ENV PORT=7860

WORKDIR /app/backend

COPY backend/package*.json ./
RUN npm ci --omit=dev --no-audit && npm cache clean --force

COPY backend/ ./
COPY --from=frontend-builder /app/frontend/dist ./public/app

EXPOSE 7860

CMD ["npm", "run", "start:prod"]
