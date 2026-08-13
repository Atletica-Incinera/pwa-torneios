FROM node:24-alpine AS dependencies
WORKDIR /app
COPY package*.json ./
RUN npm install

FROM node:24-alpine AS builder
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
# `NEXT_PUBLIC_*` é embutido no bundle durante o build, não lido em runtime:
# cada origem de dados produz uma imagem distinta. Passar a variável para um
# container já de pé não muda nada — é preciso reconstruir.
ARG NEXT_PUBLIC_DATA_SOURCE=local
ARG NEXT_PUBLIC_API_URL=/api/v1
ARG NEXT_PUBLIC_REALTIME=sse
ENV NEXT_PUBLIC_DATA_SOURCE=$NEXT_PUBLIC_DATA_SOURCE
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_REALTIME=$NEXT_PUBLIC_REALTIME
RUN npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public ./public
EXPOSE 3001
CMD ["npm", "run", "start"]
