# Quickstart: Reaproveitar Equipe da Edicao Anterior

Guia de validacao end-to-end da feature 029. Contrato de API em
[contracts/equipe-anterior.md](./contracts/equipe-anterior.md); modelo de dados
em [data-model.md](./data-model.md).

## Pre-requisitos

1. **Setup base** (como no AGENTS.md):
   - `cp .env.example .env.local` (frontend) e variaveis do `api/` (DATABASE_URL, API_SECRET, FIREBASE_PROJECT_ID com ADC local ou `GOOGLE_APPLICATION_CREDENTIALS`).
   - Banco PostgreSQL local aplicado com `schema.sql`. **Nao ha mudanca de schema nem migracao nesta feature.**
   - `npm install` e `npm run dev` (frontend, proxy para a API) + `cd api && npm install && npm run dev`.
   - Um usuario autenticado com perfil com a permissao `edicao.equipeAlocar` (ex.: ADM ou ORG).

2. **Massa de dados** (crie pelo proprio sistema — edicao, organograma, pessoas/participacoes):
   - **Edicao atual** em status `planejamento` (numero N, ex.: 100).
   - **Edicao anterior** concluida (numero N-1, ex.: 99) com a **mesma equipe** por nome normalizado (ex.: "Calabresa Chapa" na 99 e "Calabresa Chapa II" na 100) e com pessoas alocadas.
   - Um conjunto de pessoas na equipe anterior cobrindo os casos do contrato: (a) pessoa livre (pode ser adicionada); (b) pessoa ja alocada NA equipe atual; (c) pessoa alocada EM OUTRA equipe da edicao atual; (d) pessoa bloqueada ou excluida logicamente (nao deve aparecer).

## Cenario 1 - Painel so aparece em planejamento (US1/US3)

1. Abrir o detalhe da equipe da edicao em `planejamento`: **Esperado** botao "Equipe da edicao anterior" visivel.
2. Abrir o painel (botao): **Esperado** drawer lateral direito listando as pessoas da equipe na edicao anterior, com nome e funcao anterior, e marcacao visual para quem ja esta na equipe atual.
3. Mudar/conferir edicao fora de `planejamento` (ativa ou encerrada) e abrir o detalhe da equipe: **Esperado** nenhum botao/painel.

## Cenario 2 - Adicionar pessoa como Equipista ou Coordenador (US2)

1. No painel, pessoa livre, acionar "adicionar como Equipista": **Esperado** a pessoa e alocada como Equipista, aparece listada na equipe atual e no painel passa a "ja na equipe" (botoes desabilitados).
2. No painel, outra pessoa livre, acionar "adicionar como Coordenador": **Esperado** alocada como Coordenador, idem marcacao de ja na equipe.
3. Pessoa com `emOutraEquipe`: **Esperado** botoes de adicao indisponiveis/desabilitados com mensagem de que ja esta em outra equipe (FR-010).
4. Com `vagasCoordenador` preenchidas, tentar "adicionar como Coordenador": **Esperado** botao desabilitado com mensagem de vaga de coordenador indisponivel (FR-011). "adicionar como Equipista" continua disponivel.
5. Sem a permissao `edicao.equipeAlocar`: **Esperado** o painel abre em modo leitura (sem botoes de adicao) (FR-014).

## Cenario 3 - Estados vazios e indisponibilidade (US3 / FR-013)

1. Sem edicao anterior (N-1 nao existe ou esta em `planejamento`): **Esperado** painel exibe mensagem "Nao ha dados de edicao anterior", tela intacta.
2. Edicao anterior existe mas sem equipe correspondente ou sem participacoes: **Esperado** painel exibe "Nenhuma pessoa encontrada para esta equipe na edicao anterior".
3. Pessoa bloqueada ou excluida logicamente na equipe anterior: **Esperado** nao aparece na lista.

## Validacao automatizada (checagens de build)

```bash
npm run lint            # tsc -b --noEmit (frontend)
npm run build           # tsc -b && vite build (frontend)
cd api && npm run build # tsc (backend)
```

Nao ha test runner. A logica de lista (filtros, `jaNaEquipe`, `emOutraEquipe`,
normalizacao por nome) e validada percorrendo os cenarios 2 e 3; a validacao de
alocacao (pessoa ja em outra equipe → 409) ja existe em `POST /api/participacoes`
e e coberta pelo cenario 2.3 quando as acoes fossem aceitas.