# syntax=docker/dockerfile:1.7

FROM node:24.18.0-alpine AS dependencies
WORKDIR /app
ARG NPM_REGISTRY=https://registry.npmjs.org
COPY package.json package-lock.json ./
RUN --mount=type=cache,id=twilight-leap-npm,target=/root/.npm,sharing=locked \
    npm ci --registry="${NPM_REGISTRY}"

FROM node:24.18.0-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_SITE_URL=http://127.0.0.1:23002
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM nginx:1.28.3-alpine AS runtime
COPY deploy/container-nginx.conf /etc/nginx/nginx.conf
COPY --from=builder /app/out /usr/share/nginx/html
USER 101:101
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O - http://127.0.0.1:8080/healthz | grep -qx ok
CMD ["nginx", "-g", "daemon off;"]
