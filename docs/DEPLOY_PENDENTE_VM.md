# Deploy da Copa Halterada: precisa de alguém com acesso à VM

**Estado em 09/10/2026:** o código já está em `front-end` (pwa-torneios#104), mas **não está no ar**. O site em produção continua sendo o InterEng.

## Por que parou
O deploy (`CD Deploy Frontend Torneios`, run 37878354204) está na fila sem ninguém pegá-lo. O workflow roda em `self-hosted`, no runner da `vm-incinera`, e o último deploy bem-sucedido foi em 06/09. O runner provavelmente está parado.

O Pedro não consegue reiniciar: a chave SSH dele (`incinera_vm`) deixou de ser aceita pela VM e a senha do CIn foi esquecida.

## Quem precisa agir
**Alguém com acesso à `vm-incinera`** (SSH). Duas coisas:

1. **Reiniciar o runner**
   ```bash
   systemctl list-units 'actions.runner*' --no-pager
   sudo systemctl restart actions.runner.<nome-que-aparecer>.service
   ```
   Sem serviço instalado: `./run.sh` em `~/actions-runner`. Em GitHub → Settings → Actions → Runners ele deve aparecer como Idle.
2. **Reautorizar a chave do Pedro** no `~/.ssh/authorized_keys` do usuário `phos2` (a chave pública está em `~/.ssh/incinera_vm.pub` na máquina dele).

## Ordem que NÃO pode ser invertida
1. Deixar o job do #104 rodar até o passo **"Verificar que o site respondeu"** passar.
2. Só então mergear o [incinera-gateway#1](https://github.com/Atletica-Incinera/incinera-gateway/pull/1) (rota `/copahalterada` e redirect de `/intereng`).

Se o gateway entrar antes, `/intereng` passa a redirecionar para uma rota que o site antigo ainda não tem, e o site fica fora do ar até o front subir. O contrário também corta: o front novo só responde em `/copahalterada`, então os dois deploys precisam sair com poucos minutos de diferença.

## Depois que estiver no ar
- Conferir: `/copahalterada/public` responde 200, `/intereng/public` redireciona, a API (`/intereng-api/api/v1/health`) e a landing (`/`) seguem iguais.
- Criar a competição Copa Halterada e cadastrar atléticas e modalidades (o nome "INTERENG" no cabeçalho só some quando a competição for renomeada ou ativada).
