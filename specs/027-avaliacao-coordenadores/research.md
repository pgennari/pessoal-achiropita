# Research: Avaliacao de Coordenadores

Pesquisa de Phase 0 — resolve os desconhecidos do Technical Context e documenta decisoes usando o padrao da feature 019 (avaliacao de equipistas) ja implementada.

## 1. Compatibilidade da arquitetura alvo

**Decision**: Backend = Hono + PostgreSQL (`api/`), nao Firestore.
**Rationale**: O repositorio evoliu de Firestore para API REST Hono (Cloud Run) + PostgreSQL. O frontend (`src/lib/firebase.ts`) usa apenas Authentication e todo o dado passa por `src/lib/api.ts`. AGENTS.md ainda descreve Firestore, mas o codigo real (rotas `api/src/rotas/avaliacao.ts`, `avaliacaoPublico.ts`, `links.ts`, sessao `sessaoAvaliacao.ts`, tabelas `links_avaliacao` e `avaliacoes` em `schema.sql`) e a fonte de verdade.
**Alternatives considered**: (a) Reusar Firestore/Security Rules — descartado, nao existe mais no backend real; (b) Cloud Functions — descartado (plano Spark).

## 2. Referencia do link publico

**Decision**: O path `/avaliacao/coordenadores/{referencia}` usa `referencia = edicoes.ano` em texto (ex.: "2026").
**Rationale**: A spec fixa o formato `avaliacao/coordenadores/2026` e define "2026 e a referencia da edicao". `Edicao` (`src/lib/tipos.ts:264-270`) tem `numero` (ex.: 100) e `ano` (ex.: 2026); a festa acontece uma vez ao ano, entao `ano` e a referencia humana estavel pedida. O token do link (`links_avaliacao_coordenador.id`) = referencia.
**Alternatives considered**: (a) Token hexadecimal aleatorio (como `links_avaliacao.id` da 019) — nao atende ao formato exigido; (b) `numero` da edicao — a spec usa "2026", que e o ano. Ao gerar, o backend valida unicidade por `ano`; se existir mais de uma edicao no mesmo ano, exige apoio manual (caso inexistente hoje).

## 3. Sessao do coordenador (anonimo) — multiplas equipes elegiveis

**Decision**: `SessaoCoordenador` (JWT HS256 1h) carrega `equipeIds: string[]` (todas as equipes coordenadas que atendem APOIO + filhas), nao uma unica `equipeId`. Middleware `comSessaoCoordenador` revalida o link ativo a cada chamada (410 se revogado).
**Rationale**: Assumption da spec: um coordenador pode coordenar mais de uma equipe e a regra e avaliada por equipe. Usar array evita escolher arbitrariamente uma equipe e cobre o caso de varias qualificadas. `SessaoPresenca` (`api/src/tipos.ts:61-68`) ja usa `equipeIds: string[]` — precedente no proprio codigo.
**Alternatives considered**: (a) Reusar `SessaoAvaliacao` com `equipeId` unico — perde alvos de outras equipes qualificadas; (b) exigir exatamente uma equipe qualificada — fere a assumption da spec.

## 4. Regras de elegibilidade e listagem de alvos

**Decision**: Identificacao valida, em ordem, (1) cracha existe, `ativo=true` e `excluida=false`; (2) participacao `funcao='Coordenador'` na edicao do link; (3) ao menos uma das equipes coordenadas tem `UPPER(nome) LIKE '%APOIO%'` e pelo menos uma equipe filha (`equipes` com `equipe_pai_id` = equipe e `excluida=false` na mesma edicao). Falha em qualquer etapa → mesma resposta `200 { erro: "Acesso negado" }`. Alvos = coordenadores (`funcao='Coordenador'`, pessoa ativa) das equipes filhas, agrupados por equipe filha quando > 1, excluindo o proprio avaliador e equipes sem coordenador. Acesso valido se ao menos uma equipe qualificar.
**Rationale**: Espelha o fluxo de `avaliacaoPublico.ts` (validacao em camadas com erro generico `:121-147`) e usa o organograma existente (`equipe_pai_id`, `raiz`, `excluida` em `schema.sql:124-140`). A regra "APOIO no nome" aplica-se a equipe coordenada pelo avaliador, nao as filhas (assumption da spec). Comparacao sem case para robustez (nomes como "APOIO DOM ORIONE" no CSV real).
**Alternatives considered**: (a) `IN` em vez de `LIKE %APOIO%` — a spec pede subtexto explicitamente; (b) alvo unico por pessoa (nao por pessoa+equipe) — a spec define alvo ligado a equipe filha e unicidade por (edicao, avaliador, alvo, equipe filha), e o agrupamento por equipe exige o vinculo.

## 5. Questionario em colunas tipadas (nao JSONB)

**Decision**: `avaliacoes_coordenador` tera colunas tipadas: `permanencia` (enum viver do zod: Sim | Sim, com algumas ressalvas | Nao tenho certeza | Nao), `lideranca` (Excelente | Bom | Regular | Pouco | Nao possui) e 4 colunas text (min 20, max 4000). Status TEXT `rascunho`/`finalizada`.
**Rationale**: Questionario e fixo (FR-016) e pequeno; colunas tipadas dao seguranca de tipos (Constituicao III) e simplicidade (Constituicao I), sem parser JSON. Limite maximo 4000 alinhado para campos textuais existentes (`comentarios` na 019); minimo 20 exigido pela clarificacao, validado no backend apenas na finalizacao (rascunho pode salvar parcial). `avaliacoes` da 019 usa `criterios JSONB` porque o questionario era variavel — vs. aqui e fixo.
**Alternatives considered**: (a) JSONB `respostas` — indirecao desnecessaria para questionario fixo; (b) tabela `avaliacao_coordenador_respostas` — over-engineering.

## 6. Unicidade por alvo/avaliador/edicao

**Decision**: `UNIQUE(edicao_id, avaliador_pessoa_id, pessoa_id, equipe_filha_id)` em `avaliacoes_coordenador`.
**Rationale**: FR-022 limita a uma avaliacao por alvo por edicao feita pelo coordenador da equipe-pai. Como alvo = (pessoa, equipe filha) e pode haver mais de um avaliador legitimo (cada coordenador de equipe APOIO avalia as proprias filhas), a chave inclui o avaliador.
**Alternatives considered**: (a) `UNIQUE(pessoa_id, edicao_id)` como na 019 — nao cabe pois aqui ha N avaliadores por alvo.

## 7. Permissao de acesso interna

**Decision**: Reutilizar a permissao existente `avaliacao.gerenciar` para as rotas internas (gerar/revogar link, listar/ver avaliacoes de coordenadores).
**Rationale**: Mesmo publico (ADM/ORG) e mesma finalidade (gestao de avaliacoes da edicao); zero churn em `permissoes`/`perfis` (catalogo em `schema.sql:589`, ORG em `:643`, ADM superuser via `pode()` em `api/src/pbac.ts:63-67`).
**Alternatives considered**: Nova permissao `avaliacaoCoordenador.gerenciar` — adiciona catalogo+migracao de perfis sem ganho funcional.

## 8. Contratos e auditoria

**Decision**: Contrato de integracao manual em `contracts/` (espelho do `contracts/avaliacao-integracao.md` da 019; responses documentadas com `z.any()` como no codigo existente). Eventos de auditoria: `avaliacaoCoordenadorLink.gerou`, `avaliacaoCoordenadorLink.revogou` (via `registrarEvento`), e `avaliacaoCoordenador.identificou` (autor fake `publico:...`).
**Rationale**: Segue o padrao da 019 e da auditoria central em `api/src/auditoria.ts`.
**Alternatives considered**: Rotas novas sem auditoria — fora do padrao.

## 9. UX publica e integracao na tela da edicao

**Decision**: Nova pagina anonima `AvaliacaoCoordenadorPublico` na rota `/avaliacao/coordenadores/:referencia` (sem Layout), com maquina de etapas e autosave debounce 2s espelhando `src/pages/AvaliacaoPublico.tsx` (identificacao → alvos → formulario → finalizacao com modal de confirmacao; finalizada imutavel). Gestao (link + listagem + detalhe) como 3a aba "Avaliacao de Coordenadores" no `EdicaoDetalhe` (estado `abaAtiva` hoje `"equipes" | "dias"`, `src/pages/EdicaoDetalhe.tsx:77`), restrita a `pode(sessao, "avaliacao.gerenciar")`, com link copiavel/ativar/revogar (padrao de `src/pages/Avaliacao.tsx`) e filtros por equipe/avaliador/status (padrao de `RelatorioAvaliacoes`).
**Rationale**: Spec exige a secao na tela de detalhes da edicao (nao pagina separada); reuso dos componentes CSS e padroes de interacao ja existentes (Convencoes IV).
**Alternatives considered**: Pagina interna separada `/avaliacao-coordenadores` — a spec fixa a localizacao na edicao.