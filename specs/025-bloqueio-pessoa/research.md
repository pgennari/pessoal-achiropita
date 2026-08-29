# Pesquisa de Design — Bloqueio de Pessoas (025)

**Fase**: Phase 0 (/speckit.plan) | **Data**: 2026-08-29 | **Plan**: [plan.md](plan.md)

Este arquivo consolida as decisoes tomadas apos inspecao do codigo existente (API Hono + Postgres + SPA React). Nenhuma pesquisa web foi necessaria — todas as "NEEDS CLARIFICATION" do Technical Context foram resolvidas mapeando os padroes ja usados no repo, conforme a constituicao (decisoes locais, boring, espelhadas no codigo existente).

## R-001: Modelo de dados do bloqueio

**Contexto**: A spec pede "salvar a pessoa em uma tabela de bloqueio, com a justificativa e a aprovacao dos usuarios", um estado corrente consultavel (banner, badges, veto de selecao) e um historico append-only de bloqueios/desbloqueios.

**Decision**: Uma tabela append-only `bloqueios` (cada solicitacao = uma linha) + coluna booleana `pessoas.bloqueada` com a derivacao atomica do estado corrente no ato da aprovacao final.

**Rationale**: 
- A tabela `bloqueios` e o rastro oficial (tipo, motivo, 1o/2o aprovador, autor, datas), nos mesmos moldes de append-only de `pessoa_equipe_historico` e `auditoria` — tudo registrado, nada apagado.
- A coluna `pessoas.bloqueada` torna o estado corrente barato e obvio para os consumidores (listagens, montagem, alocacao, banner) e espelha o padrao `ativo`/`excluida` ja usado no dominio (constituicao §I).
- A aprovacao que conclui (2a aprovacao) atualiza a coluna dentro de `sql.begin` com `FOR UPDATE`, eliminando corrida entre duas aprovacoes concorrentes e entre criacao/aprovacao.

**Alternatives considered**:
- (a) *Somente tabela de solicitacoes, sem coluna derivada* — estado corrente via `NOT EXISTS` em query sobre `bloqueios`. Descartada: cada ponto consumidor precisaria repetir a derivacao; a leitura fica mais cara e mais facil de divergir entre telas.
- (b) *Tabela `pessoa_bloqueada` isolada com a linha "ativa"* — mais uma entidade para a mesma funcao de uma coluna; descartada por complexidade sem ganho.

## R-002: Permissoes e quem pode agir

**Contexto**: A spec assume usuarios "da equipe de Pessoal". O codigo hoje referencia `exclusivoPessoal` no `PessoaDetalhe` (gating do box "Exclusivo Pessoal"), mas essa permissao **nao esta semeada no catalogo** (`schema.sql`) — na pratica so o ADM (superuser) enxerga o box.

**Decision**: 
1. Criar a permissao catalogada **`pessoas.bloqueio`** ("Pessoas: bloquear/desbloquear") para toda a area do recurso: ver a tela Bloqueios, criar solicitacoes, aprovar e ver historico. Concedida ao perfil `ORG` (bloco no estilo de `pessoas.parentes`/`cantina.gerenciar`); ADM ja e superuser.
2. Semear **`exclusivoPessoal`** no catalogo e conceder ao `ORG`, formalizando o que hoje so existe em codigo (necessario para a aba de historico no box ficar visivel a quem de fato usa a area).

**Rationale**: Uma unica permissao para todo o fluxo preserva a simplicidade (constituicao §I) e mantem o gating do box atual (`exclusivoPessoal`) intacto. A separacao entre "ver/agir em bloqueio" (`pessoas.bloqueio`) e "box exclusivo" (`exclusivoPessoal`) permite atribuir combinacoes distintas no catalogo if editavel (Controle de Perfis/Permissao) sem mexer no codigo.

**Alternatives considered**:
- *Duas permissoes (`pessoas.bloquear` + `bloqueio.aprovar`)* — mais granular, porem trabalhosa para o time voluntario e sem pedido na spec; a 2a aprovacao e qualquer("compensadora"), nao uma funcao separada. Descartada.
- *Reutilizar apenas `exclusivoPessoal`* — amarraria o recurso a um nome que nao descreve bloqueio e deixaria a tela Bloqueios dependente do box. Descartada.

## R-003: Onde o bloqueio "impede" (FR-018 / opcao C da spec)

**Contexto**: Escopo resolvido na spec como opcao C: pessoa bloqueada nao pode ser chamada/convidada/alocada e ganha destaque visual em toda a navegacao.

**Decision**: Restricao autoritativa no backend + espelhamento no front:
- **Backend (autoritativo)**:
  - `POST /api/participacoes` (nova alocacao) e `PUT /api/participacoes/:id` (mover/trocar funcao): recusados com 409 quando `pessoa.bloqueada = TRUE`, retornando a justificativa do bloqueio.
  - `GET /api/montagem/candidatos`: candidatos excluem `pessoas.bloqueada = TRUE` (nao sao "chamaaveis").
  - `DELETE /api/participacoes/:id` (desalocar): **mantido permitido** — remover alguem da equipe continua valido e nao e uma "nova chamada".
- **Frontend (experiencia)**: `AlocarPessoaDialog` nao oferece bloqueadas (badge + erro com motivo); `MontagemCandidato` desabilita botoes "Coordenador/Equipista" de candidatos bloqueados com badge e motivo; `EquipeDetalhe` mostra badge na linha da pessoa ja alocada e veta Mover/Trocar funcao (mantendo a pessoa no roster, FR-019); `Pessoas` e `BuscaGlobal` exibem badge "bloqueado".

**Rationale**: O backend e a fonte da verdade (qualquer chamada via API e barrada); o front so melhora a experiencia. A regra de "nao desalocar automaticamente" (FR-019) e preservada porque a aprovacao do bloqueio apenas liga `pessoas.bloqueada`, sem tocar em `participacoes`.

**Alternatives considered**:
- *Somar o veto tambem em `POST /api/convites` e na identificacao publica* — convites de usuario do sistema nao sao "chamada para a festa" (sao acesso ao app) e a identificacao publica (check-in/validacao) nao seleciona pessoas; ambos fora de escopo. Descartados.
- *Desalocar automaticamente no bloqueio* — contrariaria FR-019/scope boundaries da spec. Descartado.

## R-004: Formato da API de bloqueios

**Contexto**: As telas precisam de (1) listas com pessoa e aprovadores para a tela Bloqueios, (2) historico por pessoa para a aba e (3) estado corrente + motivos para banner e as paginas de criar/desfazer bloqueio.

**Decision**:
- `GET /api/bloqueios` — lista todas as solicitacoes (pendentes e aprovadas) com dados da pessoa (nome, cracha), filtros opcionais `?pessoaId=` (historico da aba) e `?status=pendente|aprovado` (abas da tela). Permissao `pessoas.bloqueio`.
- `POST /api/bloqueios` — cria solicitacao `{ pessoaId, tipo: "bloqueio"|"desbloqueio", motivo }`; o 1o aprovador e a sessao atual. Requer `pessoas.bloqueio`; valida motivo >= 100 caracteres (conteudo real). Pendente de cara.
- `POST /api/bloqueios/:id/aprovar` — 2a aprovacao pela sessao (distinta do 1o aprovador via `UPDATE ... WHERE aprovador1_uid <> $me`); conclui a solicitacao e liga/desliga `pessoas.bloqueada` em transacao. Requer `pessoas.bloqueio`.
- `GET /api/pessoas` e `GET /api/pessoas/:id` enriquecidos com `bloqueada: boolean` e, no detalhe, `bloqueioAtivo` (motivo/aplicadores do bloqueio ativo) e `bloqueioPendente` (solicitacao pendente, se houver) — alimenta banner, as paginas de bloqueio/desbloqueio, o card de pendencia no detalhe e as listagens sem chamadas extras.

**Rationale**: Um unico recurso REST coerente; o estado corrente entra na resposta existente de pessoas para nao duplicar latencia nem criar N chamadas. Filtros por query string cobrem tela e aba sem endpoints redundantes.

**Alternatives considered**:
- *Endpoints separados por tela (`/api/bloqueios/pendentes`, `/api/bloqueios/pessoa/:id`, `/api/pessoas/:id/bloqueio`)* — mais verboso, mesma funcao; descartado por duplicidade.
- *Estado corrente sempre derivado por query no GET* — depende do R-001 (coluna derivada); a coluna resolve o caso de forma mais barata.

## R-005: Concorrencia e integridade da dupla aprovacao

**Contexto**: Duas pessoas podem aprovar o mesmo pedido ao mesmo tempo; a criacoo de pedido pode correr ao lado da aprovacao de outro. A regra "2 aprovadores distintos" nao pode vazar.

**Decision**:
- **Maximo 1 pendente por pessoa**: `CREATE UNIQUE INDEX ... ON bloqueios(pessoa_id) WHERE status='pendente'`. A criacao de pedido novo para pessoa com pendente gera violacao de unicidade → 409 (padrao `isErroDuplicado` do repo).
- **Aprovacao unica/atomo**: `UPDATE bloqueios SET status='aprovado', aprovador2_uid=$me, ... WHERE id=$1 AND status='pendente' AND aprovador1_uid <> $me RETURNING *` dentro de `sql.begin`. Se 0 linhas retornadas → "ja aprovado" ou "voce e o 1o aprovador" (409/400). A cadelinha do `pessoas.bloqueada` usa o lock da linha da pessoa (`SELECT ... FOR UPDATE` no mesmo `sql.begin`), serializando com a criacao de novo pedido (que tambem da `FOR UPDATE` na pessoa).
- **Estado corrente**: criacao de `bloqueio` exige `pessoa.bloqueada = FALSE`; criacao de `desbloqueio` exige `pessoa.bloqueada = TRUE` (validacao sob o mesmo lock).

**Rationale**: postgres.js em read committed resolve o cenario com os condicionais acima sem precisar de serializable; e o mesmo tipo de UPDATE condicional que o repo ja usa para invariantes (ex.: ativacao de edicao).

**Alternatives considered**:
- *Isolamento `serializable`* — sobrescreve sem necessidade todo o trafego da transacao; descartado.
- *Tabela de votos separada + contagem* — complexidade extra para o mesmo efeito de duas colunas de aprovador; descartado (constituicao §I).

## R-006: Auditoria

**Decision**: Registrar via `registrarEvento` (append-only) em cada transicao relevante, com alvo em `pessoas/{id}` ou `bloqueios/{id}`:
- criacao de pedido → `bloqueio.solicitou` (alvo `bloqueios/{id}`, detalhe com tipo + pessoa);
- aprovacao que conclui bloqueio → `bloqueio.aprovou` + `pessoa.bloqueou`;
- aprovacao que conclui desbloqueio → `bloqueio.aprovou` + `pessoa.desbloqueou`.

**Rationale**: Mesmo padrao de `participacoes` (`participacao.alocou`) e equipes (`equipe.removeu`); a tela de Auditoria existente passa a exibir os eventos sem mudanca.

## R-007: Confianca no frontend e invalidacao

**Decision**: Seguir o padrao React Query: `src/lib/bloqueio.ts` com `listarBloqueios`, `criarSolicitacaoBloqueio`, `aprovarSolicitacaoBloqueio` e invalidacoes de `["bloqueios"]`, `["pessoas"]`, `["pessoas", id]`, `["participacoes"]`, `["equipes"]`, `["montagem-candidatos"]`. Hooks `useBloqueios()` e `useBloqueiosDaPessoa(pessoaId)` em `hooks.ts`. O estado do banner vem do proprio `usePessoa(id)` enriquecido.

**Rationale**: Repete o contrato e a mecanica de `participacoes.ts`/`pessoas.ts`; invalidacao ampla mantem badges e listas consistentes apos qualquer mutacao.

## Decisoes em aberto ao final da Phase 0

**Nenhuma**. Todas as incognitas do Technical Context foram resolvidas acima (R-001 a R-007). O design seguiu para a Phase 1 (data-model.md, contracts/, quickstart.md).