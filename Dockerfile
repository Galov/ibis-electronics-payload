FROM node:20-bookworm-slim AS deps
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
RUN npm install

FROM node:20-bookworm-slim AS builder
WORKDIR /app

ARG NEXT_PUBLIC_SERVER_URL
ARG PAYLOAD_PUBLIC_SERVER_URL

ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_SERVER_URL=$NEXT_PUBLIC_SERVER_URL
ENV PAYLOAD_PUBLIC_SERVER_URL=$PAYLOAD_PUBLIC_SERVER_URL

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app

ARG NEXT_PUBLIC_SERVER_URL
ARG PAYLOAD_PUBLIC_SERVER_URL

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV NEXT_PUBLIC_SERVER_URL=$NEXT_PUBLIC_SERVER_URL
ENV PAYLOAD_PUBLIC_SERVER_URL=$PAYLOAD_PUBLIC_SERVER_URL

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["npm", "run", "start"]
