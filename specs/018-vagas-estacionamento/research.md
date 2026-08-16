# Research: Vagas de Estacionamento

## Status: Pesquisa concluida sem clarificacoes pendentes

Nao ha `NEEDS CLARIFICATION` no Technical Context. Todas as decisoes foram resolvidas com base na arquitetura existente (API Hono + PostgreSQL em `api/`, SPA React + Vite + TanStack Query em `src/`), nas clarificacoes da spec (Session 2026-08-15) e na leitura direta das rotas de `estacionamentos.ts`, `veiculos.ts`, `checkin.ts`, `pessoas.ts` e `dashboard.ts`, alem do `schema.sql` e do catalogo granular de permissoes.

## Contexto atual (mapeado no repositorio)

- **`veiculos.estacionamento_id`** (FK → `estacionamentos.id`, `ON DELETE SET NULL`) e usado por:
  - `GET /api/estacionamentos/:id/veiculos` (`WHERE v.estacionamento_id = ${id}`) — aba Veiculos do detalhe
  - `GET /api/publico/checkin/{token}/buscar` (busca por placa) — localiza o veiculo dentro do estacionamento e detecta "placa de outro estacionamento"
  - `POST /api/publico/checkin/{token}` — valida `veiculo.estacionamento_id === est.id`
  - `POST /api/estacionamentos/:id/veiculos` (associar/transferir) e `DELETE /api/estacionamentos/:id/veiculos/:veiculoId`
  - `POST /api/estacionamentos/:id/veiculos/:veiculoId/checkins-manuais` — valida `veiculo.estacionamento_id === id`
- **`pessoas.estacionamento_id`** (FK → `estacionamentos.id`, `ON DELETE SET NULL`) e usado por:
  - `GET /api/estacionamentos/:id/pessoas`, `POST /api/estacionamentos/:id/pessoas`, `DELETE /api/estacionamentos/:id/pessoas/:pessoaId`
  - `GET /api/pessoas` e `GET /api/pessoas/:id` (join `LEFT JOIN estacionamentos e ON e.id = p.estacionamento_id` → `estacionamentoNome`)
- **`veiculo_estacionamento_historico`** (append-only) alimenta `GET /api/veiculos/:id/historico-estacionamentos` e a tela `VeiculoDetalhe.tsx`. Na feature nova a tabela **permanece como legado oculto** (sem novas escritas) e seus dados sao **migrados por backfill** para `vaga_estacionamento_historico` (FR-024/SC-008); o veiculo nao exibe mais historico (FR-012).
- **`estacionamentos.vagas_distribuidas`** e coluna manual (`DEFAULT 0`), gravada no POST/PUT do estacionamento (form com `vagasDistribuidas`). Nao e usada em nenhuma derivacao hoje; o dashboard calcula lotacao por check-ins.
- **Catalogo de permissoes granular** (seed em `schema.sql`): `estacionamento.lista/detalhe/incluir/editar/excluir/associar/checkinManual/dashboard/relatorio`, `veiculos.lista/detalhe/incluir/editar/excluir/associar/vincular/equipe/proprio`. ORG possui os de gestao; CRD/OPC possuem `estacionamento.lista/detalhe/dashboard` (+ `checkinManual` para OPC); ADM e superuser via `pode()`.
- **Frontend**: `Veiculo` com `estacionamentoId?`; `Pessoa` com `estacionamentoId?/estacionamentoNome?`; `Estacionamento` com `vagasDistribuidas`; `HistoricoEstacionamentoVeiculo` + `OperacaoHistoricoEstacionamento`; componentes `EstacionamentoPessoa.tsx`, `ListaVeiculosEstacionamento.tsx`, `CardOcupacao.tsx`; pagina `EstacionamentoDetalhe.tsx`.

## Decisoes

| Decisao | Escolha | Racional | Alternativas Consideradas |
|---------|---------|----------|---------------------------|
| Entidade Vaga | Tabela `vagas` + juncao `pessoa_vaga` | Modelo relacional natural para "uma vaga, varias pessoas" e "pessoa em uma vaga"; espelha o padrao `pessoa_veiculo` ja existente | Colunas em `pessoas`/`estacionamentos` e array JSONB: rejeitado por nao expressar as regras de unicidade nem permitir a listagem de vagas de um estacionamento com consulta simples |
| Pessoas por vaga | `pessoa_vaga` com PK em `pessoa_id` (uma pessoa = no maximo uma linha) + indice em `vaga_id` | A PK `(pessoa_id)` garante FR-006 no nivel do banco; `vaga_id` indexado garante FR-002 (varias pessoas por vaga) e a listagem por estacionamento | PK composta `(pessoa_id, vaga_id)` com CHECK de unicidade por pessoa: rejeitado por redundante; a PK composta permitiria pessoa em varias vagas, exigindo constraint extra |
| Estacionamento da vaga | Coluna `vagas.estacionamento_id` (FK, `ON DELETE SET NULL`) | FR-003 (0..1) e natural em coluna unica; FR-020 (exclusao do estacionamento mantem a vaga sem estacionamento) via `SET NULL` | Tabela de associacao vaga↔estacionamento: rejeitado por desnecessaria para cardinalidade 0..1 |
| Contagem de vagas distribuídas | Derivada: `COUNT(vagas WHERE estacionamento_id = X)` nas rotas de estacionamento/dashboard | FR-016 (sempre calculada, sem entrada manual); elimina a coluna manual `vagas_distribuidas` que hoje e gravada no form e nunca deriva nada | Trigger de manutencao da coluna: rejeitado por desnecessario e mais complexo que COUNT em lista pequena |
| Remocao dos vinculos diretos | `DROP COLUMN veiculos.estacionamento_id`, `DROP COLUMN pessoas.estacionamento_id`; a tabela `veiculo_estacionamento_historico` e **mantida** como legado oculto, sem novas escritas | FR-011/FR-007 exigem a remocao das colunas; FR-012 tira a exibicao do historico, mas os dados legados sao migrados por backfill e os registros sem vaga correspondente permanecem na tabela (confirmado em clarificacao) | `DROP TABLE veiculo_estacionamento_historico`: rejeitado porque perderia dados; a migracao por backfill nao tem mapeamento 1:1 garantido (um veiculo pode ter varias pessoas com vagas distintas) |
| Historico recriado (vaga↔estacionamento) | Tabela `vaga_estacionamento_historico` (append-only, mesmo padrao da legada) + rota `GET /api/vagas/:id/historico` + secao no detalhe da vaga | FR-012: historico mantido e recriado para a associacao vaga↔estacionamento, registrando associar/transferir/desassociar (incluindo a associacao inicial na criacao da vaga) e exibido no detalhe da vaga | Exibir historico no veiculo: rejeitado porque FR-012 determina que o veiculo nao exibe mais historico |
| Migracao do historico legado | Script SQL idempotente `scripts/backfill-vaga-estacionamento-historico.sql` (padrao de `scripts/backfill-historico-alocacao.sql`): `INSERT ... SELECT` das pessoas ativas do veiculo → vaga, deduplicado (`WHERE NOT EXISTS`); registros sem vaga correspondente permanecem na tabela legada | FR-024/SC-008: nenhum dado e perdido e nao ha duplicacao; roda apos a adocao das vagas (a migracao de schema nao pode copiar dados para vagas que ainda nao existem); sem runtime novo | Migracao automatica na DDL: rejeitado porque as vagas nao existem no momento da migracao de schema; exigiria criar vagas automaticamente. Script Node (.mjs): rejeitado porque nao ha padrao equivalente no repositorio (o citado seed-fixture.mjs nao existe) |
| Estacionamento derivado de pessoa/veiculo | Joins `pessoa_veiculo → pessoas(ativo=true) → pessoa_vaga → vagas → estacionamentos` nas rotas de `veiculos`, `pessoas`, `estacionamentos` e `checkin` | FR-008/FR-010/FR-017; o mesmo caminho de derivacao em todas as telas evita duplicacao de logica de negocio | Funcao SQL dedicada ou trigger de materializacao: rejeitado por introduzir camada desnecessaria para um join simples |
| Pessoa inativada | Joins filtram `pessoas.ativo = true` | FR-021 (inativacao desfaz a associacao com o estacionamento); o vínculo na `pessoa_vaga` permanece mas nao deriva estacionamento | Remover a linha de `pessoa_vaga` ao inativar: rejeitado porque a spec exige que a vaga permaneça vinculada a pessoa |
| Check-in por placa | Busca o veiculo por estacionamentos das vagas das pessoas ativas; se nao achar, busca vaga em outro estacionamento; sem pessoas/sem vaga → orienta procurar Gestao de Estacionamento | FR-017/FR-018/FR-022; manteve o formato de resposta atual (resultados com pessoas + jaPossuiCheckin) para nao quebrar a tela | Manter vinculo direto so para check-in: rejeitado por contradizer FR-011 |
| Check-in manual | Valida a derivacao por vaga em vez de `veiculo.estacionamento_id` | FR-023 (adaptar dependencias do vinculo direto) | Remover check-in manual: rejeitado por nao constar na spec |
| Remocao das rotas de associacao direta | Excluir `POST/DELETE /api/estacionamentos/:id/pessoas`, `POST/DELETE /api/estacionamentos/:id/veiculos`, `GET /api/veiculos/:id/historico-estacionamentos` | Conceitos removidos pela feature; manter rotas mortas aumenta superficie de API e confunde o operador | Manter como legado oculto: rejeitado por manter capacidade que a spec manda remover (SC-004) |
| Permissoes de vaga | Novos codigos `vaga.lista/detalhe/incluir/editar` no catalogo (seed idempotente); desativar `estacionamento.associar` e `veiculos.associar` | Padrao granular vigente no catalogo; `estacionamento.associar`/`veiculos.associar` descrevem justamente o que foi removido. ORG recebe `vaga.*`; CRD/OPC recebem `vaga.lista/detalhe` (visualizacao) | Reusar `estacionamento.associar` para vagas: rejeitado por nome enganoso (associa veiculo, conceito removido) |
| Vaga sem delecao | Sem rota DELETE de vaga | A spec nao pede excluir vaga; `editar` cobre mudar estacionamento e pessoas. Excluir vaga e facil de adicionar depois se pedido | Implementar DELETE de vaga: rejeitado por escopo fora do MVP estrito |
| Formulario do estacionamento | Remove o campo manual `vagasDistribuidas` do form e do payload | FR-016; o valor passa a ser calculado | Manter campo somente leitura no form: rejeitado por incentivar valor divergente |
| Detalhe da pessoa | Exibe vaga (identificacao) + estacionamento derivado, sem controle de associacao | FR-008; remove `EstacionamentoPessoa.tsx` | Manter associacao direta oculta: rejeitado por FR-007/SC-004 |

## Dependencias

Nenhuma nova dependencia.

Infraestrutura existente reutilizada:
- `comAuth`/`temPermissao`/`pode()` em `api/src/auth.ts` — autorizacao das rotas de vaga
- `registrarEvento` em `api/src/auditoria.ts` — auditoria de criacao/edicao de vaga
- Padrao CRUD de `api/src/rotas/estacionamentos.ts` e `veiculos.ts` — rotas de `vagas`
- `useEstacionamentos`/`api.get`/`api.post`/`api.put` em `src/lib/` — hooks e cliente HTTP
- Padrao de tela de `EstacionamentoDetalhe.tsx`/`Veiculos.tsx` — telas de vaga
- Derivação de estacionamento ja usada em `checkin.ts` (join `pessoa_veiculo`) estendida para `pessoa_vaga`/`vagas`

## Observacoes de seguranca

- Rotas de vaga exigem `vaga.lista/detalhe/incluir/editar`; na pratica ADM (superuser) e ORG gerem, CRD/OPC visualizam.
- Check-in publico (rotas `/{token}`) permanece anonimo (via token), como hoje; a mudanca e apenas na logica de derivacao do veiculo.
- `vaga.editar` permite mover a vaga entre estacionamentos e desfazer a associacao (`estacionamentoId: null`), que sao os fluxos de FR-004/FR-019.
- A restricao "pessoa em no maximo uma vaga" e garantida no banco (PK `pessoa_id` em `pessoa_vaga`), nao apenas na validacao da API.
- `vaga_estacionamento_historico` e append-only (sem UPDATE/DELETE via API), mesmo padrao da tabela legada; a leitura exige `vaga.detalhe`.

## Notas sobre o estado do repositorio

- `estacionamentos.vagas_distribuidas` e gravada manualmente hoje (`POST/PUT /api/estacionamentos` recebem o campo e `DadosEstacionamentoForm` o valida como obrigatorio). A feature remove o campo do form/payload e passa a calcular.
- `pessoas.estacionamento_id` foi criada na spec 005 e `veiculo_estacionamento_historico` na 008/012; as colunas diretas sao removidas e a tabela legada de historico permanece oculta, com os dados migrados por backfill para `vaga_estacionamento_historico` (registros sem vaga correspondente ficam na legada).
- O catalogo granular de permissoes (seed em `schema.sql`) ja desativou os codigos antigos agregados (`estacionamentos.operar`, `administracao`, etc.); a nova migracao desativa `estacionamento.associar`/`veiculos.associar` e insere `vaga.*`.
- Nenhum script de seed em massa (`.mjs`) existe no repositorio; backfills seguem o padrao SQL em `scripts/` (ex.: `backfill-historico-alocacao.sql`). O novo backfill do historico segue esse padrao. Revisar apenas se algum script existente gravar `estacionamento_id` em pessoas/veiculos.
- Nenhuma tela grava `estacionamentos.vagas_distribuidas` alem de `EstacionamentoNovo.tsx`/edicao; ajuste pontual.
