# PWA Torneios — InterEng

PWA responsiva para administrar competições, edições, modalidades, equipes, atletas, torneios, partidas, placar ao vivo, ranking geral e a área pública do InterEng. As visualizações originais foram preservadas; o estado persistente vem da API `intereng-api`.

## Arquitetura integrada

- **Next.js 16 + React 19 + TypeScript** em `apps/web`;
- **API REST NestJS** no repositório irmão `backend`;
- **PostgreSQL** como fonte de verdade;
- **Redis + SSE** para invalidar snapshots em tempo real;
- **MinIO/S3** para logotipos de equipes;
- **Traefik** para expor web e API no ambiente local;
- **Service Worker** com fallback offline somente para dados públicos.

O frontend usa `NEXT_PUBLIC_DATA_SOURCE=http` por padrão. O adaptador `local` permanece disponível apenas quando uma suíte legada o solicita explicitamente; a aplicação integrada não faz fallback silencioso para dados do navegador.

## Requisitos

- Docker Desktop com Docker Compose;
- Node.js 22+ e npm para desenvolvimento fora dos containers;
- os repositórios em diretórios irmãos:

```text
intereng/
├── frontend/
└── backend/
```

## Executar a stack completa

No PowerShell, a partir deste repositório:

```powershell
Copy-Item .env.example .env
docker compose up --build -d
docker compose ps
```

O container da API executa `prisma migrate deploy` antes de iniciar. Os volumes de PostgreSQL, Redis e MinIO são persistentes.

Para carregar a demonstração em um ambiente local vazio, depois que a stack estiver saudável:

```powershell
docker compose run --rm -e NODE_ENV=development -e SEED_DEMO_DATA=true api npm run prisma:seed
```

O seed é idempotente, recusa `NODE_ENV=production` e só roda com `SEED_DEMO_DATA=true`. Ele não deve ser usado para sobrescrever dados reais.

Serviços locais:

| Serviço | Endereço |
| --- | --- |
| PWA | `http://app.localhost` ou `http://localhost:3001` |
| API | `http://api.localhost/api/v1` ou `http://localhost:3000/api/v1` |
| Health check | `http://api.localhost/api/v1/health` |
| MinIO API | `http://localhost:9000` |
| MinIO Console | `http://localhost:9001` |
| Traefik | `http://localhost:8080` |

Para encerrar os containers sem apagar os dados:

```powershell
docker compose down
```

## Credenciais da demonstração

Estas credenciais são criadas apenas pelo seed local e podem ser substituídas pelas variáveis `SEED_*_PASSWORD` do backend.

| Papel | E-mail | Senha | Escopo |
| --- | --- | --- | --- |
| Super administrador | `super@intereng.com` | `super2026` | global |
| Admin da edição | `ana@ufpe.br` | `intereng2026` | InterEng 2026 |
| Gestor de modalidade | `bruno@ufpe.br` | `futsal2026` | Futsal |

Novos membros convidados recebem, no ambiente local, a senha definida em `STAFF_INVITE_PASSWORD` (`intereng2026` no exemplo). Use um valor secreto próprio fora do desenvolvimento.

## Variáveis principais

O arquivo `.env.example` contém toda a configuração do Compose. As variáveis mais relevantes para o frontend são:

```env
NEXT_PUBLIC_DATA_SOURCE=http
NEXT_PUBLIC_API_URL=http://api.localhost/api/v1
API_HOST=api.localhost
WEB_HOST=app.localhost
STAFF_INVITE_PASSWORD=intereng2026
```

`NEXT_PUBLIC_*` é incorporada durante o build. Refaça a imagem do serviço `web` quando alterar esses valores.

O upload usa POST pré-assinado diretamente para o MinIO/S3. `S3_PRESIGN_ENDPOINT` precisa ser acessível pelo navegador, `S3_ENDPOINT` pela API e `MINIO_API_CORS_ALLOW_ORIGIN` deve incluir a origem da PWA.

## Desenvolvimento do frontend

Com a infraestrutura e a API disponíveis, execute:

```powershell
Set-Location apps/web
npm ci
$env:NEXT_PUBLIC_DATA_SOURCE='http'
$env:NEXT_PUBLIC_API_URL='http://api.localhost/api/v1'
npm run dev
```

Comandos de qualidade:

```powershell
npm run typecheck
npm run build
```

O modo local é reservado à compatibilidade das suítes legadas:

```powershell
$env:NEXT_PUBLIC_DATA_SOURCE='local'
```

Não use esse valor para homologar a integração.

## Contrato de dados

- `apps/web/app/lib/frontend-state.ts`: snapshot consumido pelas telas;
- `apps/web/app/lib/repositories/actions.ts`: 32 operações de escrita;
- `apps/web/app/lib/repositories/http-adapter.ts`: snapshots, ações idempotentes e gate monotônico de revisão;
- `apps/web/app/lib/repositories/http-auth-adapter.ts`: login, refresh, logout e restauração da sessão;
- `apps/web/app/lib/repositories/realtime-channel.ts`: canal SSE compartilhado;
- `apps/web/app/lib/repositories/logo-upload.ts`: upload direto e associação do `fileKey`.

Cada ação envia `Idempotency-Key`. O servidor devolve o snapshot confirmado; não há atualização otimista no modo HTTP. Revisões SSE provocam um novo GET e nunca transportam dados privados.

## Comportamento offline

- snapshots públicos usam rede primeiro e o cache somente como fallback;
- snapshots privados, sessão e mutações não são armazenados pelo Service Worker;
- escritas exigem conexão;
- ao recuperar a rede, a aplicação busca a revisão mais recente;
- o canal `/active` acompanha a troca de edição ativa sem precisar recarregar a página.

## Checklist de homologação

1. Entrar com cada um dos três papéis e conferir o respectivo escopo.
2. Criar ou editar competição, edição, modalidade, equipe, atleta e torneio.
3. Gerar partidas, operar placar, pausar/retomar, desfazer evento, encerrar e corrigir resultado.
4. Conferir classificação, chaveamento, ranking geral e auditoria.
5. Enviar um logotipo WebP e confirmar a URL pública do objeto.
6. Abrir duas abas e confirmar atualização em tempo real após uma mutação.
7. Abrir a área pública sem sessão e verificar que ela não expõe staff, auditoria ou documentos.
8. Simular indisponibilidade da rede e confirmar o fallback apenas nas páginas públicas.
9. Verificar console e rede do navegador sem erros inesperados.

## Estrutura do repositório

```text
.
├── apps/
│   └── web/                 # aplicação Next.js
├── docs/                    # decisões e histórico do produto
├── docker-compose.yml       # stack integrada com o backend irmão
├── .env.example             # configuração local de referência
└── README.md
```
