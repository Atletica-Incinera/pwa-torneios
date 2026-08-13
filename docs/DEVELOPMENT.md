# Guia de desenvolvimento — PWA Torneios

Este documento define o fluxo inicial de desenvolvimento do MVP.

## Branch principal

A branch principal do repositório é:

```txt
main
```

Ela deve receber apenas código revisado e aprovado via Pull Request.

## Branch inicial criada

Para a primeira tarefa do backlog, foi criada a branch:

```txt
feature/s1-01-estrutura-inicial
```

Issue relacionada:

```txt
S1-01 — Configurar estrutura inicial da PWA
```

## Padrão de branches

Use o padrão:

```txt
feature/s1-01-estrutura-inicial
feature/s1-02-login
feature/s1-03-authguard
feature/s2-01-gestao-staff
```

Formato:

```txt
feature/<codigo-da-issue>-<resumo-curto>
```

## Padrão de commits

Use commits simples e descritivos:

```txt
chore: configure project structure
docs: add stack documentation
feat: add auth guard
feat: add login screen
fix: correct route protection
```

Sugestão de prefixos:

- `feat:` nova funcionalidade;
- `fix:` correção;
- `docs:` documentação;
- `chore:` configuração/manutenção;
- `refactor:` refatoração;
- `test:` testes;
- `infra:` infraestrutura.

## Fluxo recomendado por tarefa

1. Escolher uma Issue.
2. Criar uma branch a partir da `main`.
3. Implementar a tarefa.
4. Validar localmente.
5. Abrir Pull Request.
6. Revisar checklist da Issue.
7. Fazer merge na `main`.
8. Fechar a Issue.

## Checklist mínimo de Pull Request

Antes de abrir PR:

- código roda localmente;
- não há arquivos sensíveis versionados;
- variáveis novas foram adicionadas ao `.env.example`;
- documentação foi atualizada, se necessário;
- critérios de aceite da Issue foram revisados;
- não há quebra óbvia no fluxo mobile.

## Organização local sugerida

```txt
pwa_torneios/
├── pwa-torneios/          # este repositório
│   ├── apps/web/
│   ├── docs/
│   ├── docker-compose.yml
│   ├── .env.example
│   └── README.md
└── intereng-api/          # Atletica-Incinera/intereng-api, clonado AO LADO
```

## Os dois repositórios não moram um dentro do outro

A API é um repositório separado — `Atletica-Incinera/intereng-api` — e o
checkout dela fica **ao lado** deste, nunca dentro. O compose a alcança por
`API_REPO_PATH`, que aponta para `../intereng-api` por padrão.

Não é preferência de organização, é segurança:

- **O repositório da API é conduzido por um loop de agentes que faz `git add -A`
  na árvore inteira e commita.** Está em `ralph-loop.sh`. Qualquer arquivo
  deixado lá — por você, por um editor, por uma ferramenta — vira commit
  assinado como iteração do agente. Em rejeição do QA ele faz
  `git reset --soft HEAD~1`, e a iteração seguinte herda a árvore suja.
- Por isso: **nunca deixe arquivo não commitado na árvore da API**, e nunca
  escreva nela a partir daqui. O que a API precisa construir é entregue como
  texto de task, colado no `tasks.md` dela por uma pessoa.
- Na direção contrária, `intereng-api/` está no `.gitignore` deste repositório,
  para o caso de alguém clonar por engano aqui dentro.

## Serviços locais planejados

O ambiente local deve subir inicialmente:

- API NestJS;
- PostgreSQL;
- Redis;
- Traefik.

## Variáveis de ambiente

As variáveis reais devem ficar em `.env` local, nunca versionadas.

O repositório deve manter apenas:

```txt
.env.example
```

## Primeira meta técnica

A primeira meta é preparar a base para executar a API com banco, Redis e proxy reverso.

Entrega esperada da S1-01:

- estrutura base do projeto;
- documentação inicial;
- docker-compose inicial;
- variáveis de ambiente de exemplo;
- padrão de branches documentado;
- stack oficial registrada.
