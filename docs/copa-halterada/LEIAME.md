# Copa Halterada — equipes e jogos

Tudo aqui parte da planilha da organização (8 abas, uma por modalidade e naipe).

| Arquivo | O que é |
|---|---|
| `planilha/*.csv` | As 8 abas exportadas, sem alteração. |
| `jogos.json` | A lista única e conferível: 94 jogos, 8 categorias. Gerada por `scripts/planilha-copa.mjs`. |
| `equipes.csv` | As 20 equipes (nome como a planilha escreve, sigla, escudo). |

## Regra: "tudo de acordo com a tabela"

Os nomes das equipes ficam como a planilha escreve (`Halterada`, `Halterada 1`,
`Halterada 2`, `Halterada A`, `Halterada B`...). O que a tabela **não** define é
preenchido por uma regra explícita e listado como **provisório** na simulação:

- **Horário "A SEGUIR"** (52 jogos): horário do jogo anterior da categoria +
  duração do jogo (Handebol 30 min, Futsal 30, Basquete 40, Vôlei 45). A API
  exige um horário para agendar.
- **Vôlei não tem data**: entra em `2026-10-11` (a edição vai de 09 a 12/10).
- **Local**: nenhum jogo tem; entra "A definir".

A gestão deve corrigir esses jogos pela tela (editar partida).

## Problemas da planilha que o conversor trata

- **Vôlei masculino, jogos 6 e 8**: o rótulo de grupo está trocado. O grupo sai
  de quem joga com quem, e o conversor avisa.
- **Futsal masculino**: a semifinal 1 é "Vencedor QF1 × Vencedor QF3". O app
  sempre cruza vaga 1 × vaga 2, então as quartas são reordenadas para o
  cruzamento sair como a planilha manda.
- **Grupo único de 3 equipes** (basquete e futsal feminino): jogos encadeados
  ("Perdedor do Jogo 1 × Compressora") entram como partidas avulsas.

## Como rodar

Na pasta `apps/web`. **Simulação por padrão**: sem `--aplicar` nada é gravado.

```powershell
# 1. A Copa Halterada precisa ser a competição ATIVA (o script recusa se não for).
# 2. Simulação — leia o que aparece:
$env:INTERENG_SENHA = "<senha do admin>"
node scripts/importar-copa.mjs --email <admin@ufpe.br>

# 3. Gravar:
node scripts/importar-copa.mjs --email <admin@ufpe.br> --aplicar
```

- É **idempotente**: os ids são determinísticos; rodar de novo só agenda o que falta.
- `--categoria "Futsal Masculino"` limita a uma categoria (repita para várias).
- `--publicar` cria as categorias como **Publicado**. Sem a flag nascem como
  **Rascunho**: o público só vê depois que a gestão publicar.

### O que ele faz, na ordem

1. Confere que a competição ativa se chama "Copa Halterada".
2. **Equipes**: vincula as que já estão no catálogo global (as do InterEng) e
   cria só as que não existem — nada duplica.
3. Habilita as modalidades (Handebol, Basquete, Futsal, Vôlei).
4. Cria cada categoria com grupos e regra de avanço deduzida da chave
   (melhor 2º colocado no handebol e no basquete masculinos; 2 por grupo no
   futsal masculino e no vôlei).
5. Agenda os jogos da fase de grupos e a chave, com os lados "a definir"
   ("1 GRUPO A", "Vencedor do Jogo 16").

## Depois de gravar

1. Corrigir os jogos **provisórios** (horário e, no vôlei, a data).
2. Preencher o **local** dos jogos.
3. **Publicar** as categorias (se não usou `--publicar`).
4. Os rótulos que a API não resolve sozinha — "Melhor 2º colocado",
   "2º geral", "1º lugar geral", "Melhor classificada" — precisam ser definidos
   à mão quando os grupos acabarem (a tela de partida permite escolher quem
   joga no lado que ainda é rótulo).
