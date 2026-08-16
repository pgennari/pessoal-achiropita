# Quickstart: Vagas de Estacionamento

## Contexto

Hoje o estacionamento se relaciona a pessoas e veiculos por vinculos diretos (`pessoas.estacionamento_id`, `veiculos.estacionamento_id`, tabela `veiculo_estacionamento_historico`) e `estacionamentos.vagas_distribuidas` e um campo digitado. Esta feature introduz a entidade **Vaga** (com varias pessoas por vaga e uma pessoa em no maximo uma vaga), deriva o estacionamento de pessoa/veiculo a partir das vagas das pessoas vinculadas, adapta o check-in (publico e manual) ao novo modelo e recria o historico de associacao como vaga↔estacionamento (exibido no detalhe da vaga), migrando os dados do historico legado por backfill.

## Pre-requisitos

- `npm install` concluido (raiz e `api/`)
- Banco de dados (Neon ou local) com `schema.sql` aplicado
- Ambiente `.env.local`/`.env` da API configurado
- Nenhuma dependencia nova

## Passos

### 1. Banco de dados

Aplicar `migration.sql` (idempotente; em producao, executar no Neon antes do deploy):

- Cria `vagas` e `pessoa_vaga` (com PK `pessoa_id`, indices)
- Cria `vaga_estacionamento_historico` (historico append-only vaga↔estacionamento)
- Remove `veiculos.estacionamento_id`, `pessoas.estacionamento_id` e `estacionamentos.vagas_distribuidas`
- **Mantem** a tabela `veiculo_estacionamento_historico` (legado oculto, sem novas escritas; dados migrados por backfill depois)
- Insere `vaga.lista/detalhe/incluir/editar` no catalogo e desativa `estacionamento.associar`/`veiculos.associar`
- Atualiza o seed dos perfis (ORG recebe `vaga.*`, CRD/OPC recebem `vaga.lista/detalhe`)

Atualizar `schema.sql` com o mesmo DDL/seed para manter o schema canonalo consistente.

### 2. API (`api/`)

- `api/src/tipos.ts`: + `Vaga`, `PessoaVaga`; `Veiculo.estacionamentoId?` → `estacionamentos?: { id; nome }[]`; `Pessoa` + `vagaId`/`vagaIdentificacao`; `Estacionamento.vagasDistribuidas` continua (agora calculada); remover `HistoricoEstacionamentoVeiculo`/`OperacaoHistoricoEstacionamento`.
- `api/src/rotas/vagas.ts` (novo): `GET /api/vagas`, `POST /api/vagas`, `GET /api/vagas/:id`, `PUT /api/vagas/:id`, `GET /api/vagas/:id/historico` — padrao openapi + `comAuth` + `temPermissao(vaga.*)` + `registrarEvento`. Validacao de FR-005 (duplicados) e FR-006 (pessoa ja em outra vaga → 409 com a vaga). Insercao de vaga + `pessoa_vaga` em transacao; `POST/PUT` gravam o evento no historico (associar/transferir/desassociar — FR-012).
- `api/src/rotas/estacionamentos.ts`: `vagasDistribuidas` calculada nas listas/detalhe; POST/PUT deixam de aceitar o campo; `GET /:id/veiculos` por derivacao via vaga; `POST/DELETE /:id/veiculos` e `GET/POST/DELETE /:id/pessoas` removidos; `checkins-manuais` validado por vaga.
- `api/src/rotas/veiculos.ts`: lista/detalhe com `estacionamentos[]` derivado; remover `GET /:id/historico-estacionamentos`; remover `veiculos.associar` das guards se citado.
- `api/src/rotas/pessoas.ts`: `vagaId`/`vagaIdentificacao`/`estacionamentoId`/`estacionamentoNome` derivados da vaga.
- `api/src/rotas/checkin.ts`: `buscar` e `registrar` usam a derivacao por vaga (pessoas ativas com vaga no estacionamento; placa de outro estacionamento informa o nome; sem vaga orienta Gestao de Estacionamento).
- `api/src/rotas/dashboard.ts`: + `vagasDistribuidas` (COUNT) em cada estacionamento.
- `api/src/index.ts`: + `app.route("/api/vagas", vagas)`.

Validar: `npm run build` na raiz `api/`.

### 3. Backfill do historico legado

Depois de criar as vagas e vincular as pessoas, rodar `scripts/backfill-vaga-estacionamento-historico.sql` (SQL idempotente, padrao de `scripts/backfill-historico-alocacao.sql`):

- Para cada registro de `veiculo_estacionamento_historico`, acha as pessoas ativas do veiculo e a vaga delas (`pessoa_vaga`) e cria o registro correspondente em `vaga_estacionamento_historico` (mesmo nome/operacao/autor/data), deduplicado (`WHERE NOT EXISTS`).
- Registros sem pessoa ativa ou sem vaga correspondente permanecem na tabela legada (nada e apagado — FR-024/SC-008).
- Ao final um `SELECT` de contagem (total legado / migrados / mantidos) valida SC-008.

### 4. Frontend (`src/`)

- `src/lib/tipos.ts`: mesmos tipos da API.
- `src/lib/vagas.ts` (novo): `criarVaga`, `atualizarVaga` (com invalidacao de queries de vagas e estacionamentos).
- `src/lib/hooks.ts`: + `useVagas`, `useVaga`, `useVagasEstacionamento`, `useHistoricoVaga`; ajustar `useVeiculosEstacionamento` e `useVeiculos` para o novo shape (`estacionamentos[]`).
- `src/lib/estacionamentos.ts`: `DadosEstacionamentoForm` sem `vagasDistribuidas`; remover `associarPessoaEstacionamento`/`desassociarPessoaEstacionamento`.
- `src/lib/veiculos.ts`: remover `associarVeiculoEstacionamento`/`desassociarVeiculoEstacionamento`; adaptar `registrarCheckinsManuais` (continuar usando a rota, agora validada por vaga).
- `src/pages/Vagas.tsx` (nova): listagem (`/vagas`) com estacionamento e pessoas por vaga.
- `src/pages/VagaNova.tsx` (nova): criacao com identificacao + seletor multisselecao de pessoas (bloqueando ja vinculadas) + estacionamento opcional com aviso de capacidade (FR-019).
- `src/pages/VagaDetalhe.tsx` (nova): detalhe/edicao — mover estacionamento, vincular/desvincular pessoas, ver pessoas (inativas marcadas); secao "Historico de estacionamento" listando associar/transferir/desassociar com data e autor.
- `src/pages/EstacionamentoDetalhe.tsx`: aba "Vagas" (useVagasEstacionamento) com pessoas por vaga; remove a associacao direta de pessoas/veiculos.
- `src/pages/EstacionamentoNovo.tsx`: remove campo de vagas distribuidas.
- `src/pages/Veiculos.tsx` + `VeiculoDetalhe.tsx`: coluna/detalhe de estacionamento passa a exibir `estacionamentos[]` derivados (badges); remove controle de associar/desassociar e historico.
- `src/pages/PessoaDetalhe.tsx`: remove `EstacionamentoPessoa`; exibe vaga + estacionamento derivado (somente leitura).
- `src/components/EstacionamentoPessoa.tsx`: REMOVER.
- `src/components/ListaVeiculosEstacionamento.tsx`: ajusta ao novo shape.
- `src/components/CardOcupacao.tsx` + dashboard: exibe porcentagem de vagas distribuídas.
- `src/components/Sidebar.tsx`: item "Vagas" na secao Gestão de Estacionamento (`pode(sessao, "vaga.lista")`).
- `src/App.tsx`: rotas `/vagas`, `/vagas/nova`, `/vagas/:id` (Layout).

Validar: `npm run lint` e `npm run build`.

## Commits

Em PT-BR, no imperativo, na branch de feature (nunca em `main`). Sugestoes:

1. `adiciona tabelas de vagas e remove vinculos diretos de estacionamento` (schema/migracao)
2. `adiciona rotas de vagas com vinculo de pessoas e estacionamento` (api)
3. `deriva estacionamento de veiculos e pessoas pelas vagas` (api)
4. `adapta check-in publico e manual ao modelo de vagas` (api)
5. `adiciona telas de vagas e ajusta detalhes de estacionamento, veiculo e pessoa` (frontend)
6. `migra historico legado de associacao para o historico da vaga` (scripts — backfill SQL)

## Validacao manual

1. Logar com ADM/ORG → Sidebar mostra "Vagas"; criar vaga com 2 pessoas e estacionamento → aparece na listagem, na aba Vagas do estacionamento e a porcentagem de vagas distribuídas no dashboard/check-in reflete a associacao.
2. Criar vaga sem estacionamento → fica sem estacionamento; mover para um estacionamento e depois desassociar → contagem dos estacionamentos atualiza sozinha.
3. Tentar vincular uma pessoa ja vinculada a outra vaga → mensagem informa a vaga atual (409); duplicar a mesma pessoa na mesma vaga → erro (400).
4. Associar vaga a estacionamento com todas as vagas contratadas distribuidas → associa e exibe aviso.
5. Detalhe da pessoa mostra a vaga e o estacionamento derivado; veiculo (lista/detalhe) mostra estacionamentos derivados das pessoas, inclusive multiplos.
6. Veiculo sem pessoas nao aparece no check-in; busca por placa de veiculo com vaga em outro estacionamento informa o nome do estacionamento; sem vaga orienta procurar Gestao de Estacionamento.
7. Inativar pessoa vinculada a vaga → vaga permanece na pessoa, mas deixa de derivar estacionamento (veiculo/check-in nao a localizam mais nesse estacionamento).
8. Excluir estacionamento com vagas → vagas permanecem sem estacionamento.
9. Detalhe da vaga mostra o historico de estacionamento (associar na criacao, transferir ao mover, desassociar ao limpar, com data e autor); nenhuma tela permite associar veiculo a estacionamento/vaga e o veiculo nao exibe mais historico de associacao.
10. OPC: check-in manual funciona para veiculo com vaga no estacionamento; CRD/OPC veem lista/detalhe de vagas mas nao criam/editao.
11. Backfill: rodar o script apos criar vagas/vincular pessoas e conferir a contagem (total legado = migrados + mantidos) e o historico migrado no detalhe da vaga; rodar de novo nao duplica (SC-008).

## Deploy

CI/CD existente (GitHub Actions, push em `main` ou `claude/restart`) roda `firebase deploy`. A feature toca API Node + schema SQL. Rodar `migration.sql` no Neon antes do deploy da API (a API nova ja nao referencia as colunas removidas; o schema antigo nao e compativel com o novo codigo). Apos as vagas serem adotadas, rodar o backfill do historico legado (`scripts/backfill-vaga-estacionamento-historico.sql`).
