# O contexto deste Dockerfile é a **raiz do repositório**, não `apps/web`.
# O front deixou de ser um pacote solto: o lockfile é único, mora na raiz, e um
# pacote em `packages/` precisa entrar na imagem junto. Construir a partir de
# `apps/web` deixaria os dois de fora.
#
#   docker build -f apps/web/Dockerfile .

FROM node:24-alpine AS dependencies
WORKDIR /app
# Só os manifestos primeiro: enquanto eles não mudarem, esta camada é reusada e
# a instalação não roda de novo a cada alteração de código.
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/package.json
COPY packages/intereng-contract/package.json ./packages/intereng-contract/package.json
# `npm ci` instala exatamente o que o lockfile diz e falha se ele estiver
# dessincronizado — que é o comportamento que se quer numa imagem.
RUN npm ci

FROM node:24-alpine AS builder
WORKDIR /app
# O npm não elevou as dependências para a raiz: elas vivem em
# `apps/web/node_modules`, e a raiz guarda apenas o link do workspace. As duas
# pastas precisam vir, e o link só resolve depois que a árvore for copiada.
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/apps/web/node_modules ./apps/web/node_modules
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
# A árvore da imagem final espelha a do repositório, porque o link do workspace
# na raiz aponta para `apps/web` e quebraria se o app mudasse de lugar.
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/web/package.json ./apps/web/package.json
COPY --from=builder /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=builder /app/apps/web/.next ./apps/web/.next
COPY --from=builder /app/apps/web/public ./apps/web/public
EXPOSE 3001
CMD ["npm", "run", "start"]
