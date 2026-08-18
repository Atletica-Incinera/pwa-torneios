FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
ARG NEXT_PUBLIC_DATA_SOURCE=http
ARG NEXT_PUBLIC_API_URL=http://api.localhost/api/v1
ENV NEXT_PUBLIC_DATA_SOURCE=$NEXT_PUBLIC_DATA_SOURCE
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME=0.0.0.0
COPY --from=builder /app/public ./public
# O runtime standalone traz o próprio server.js com a configuração já embutida
# (basePath incluído), então o next.config.ts que o `next start` exigia deixa de
# ser copiado — ver a verificação registrada no merge.
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 3001
CMD ["node", "server.js"]
