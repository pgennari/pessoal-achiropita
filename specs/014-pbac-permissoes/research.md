# Research: PBAC - Catalogo de Permissoes e Validacao Unica de Acesso

## Status: Pesquisa concluida sem clarificacoes pendentes

Nao ha `NEEDS CLARIFICATION` no Technical Context. Todas as decisoes foram resolvidas com base na arquitetura existente (API Hono + PostgreSQL, SPA React + TanStack Query), nas clarificacoes da spec (Session 2026-08-07) e no mapeamento do acesso efetivo atual dos seis perfis padrao.

## Decisoes

| Decisao | Escolha | Racional | Alternativas Consideradas |
|---------|---------|----------|---------------------------|
| Forma do catalogo de permissoes | Tabela `permissoes` no PostgreSQL, seed com os 10 codigos existentes | O catalogo hoje e hardcoded e duplicado (`api/src/perfis.ts` com 9 itens e `src/lib/perfis.ts` com 10, divergentes). Uma tabela unica elimina a duplicacao e permite criar/editar/desativar via API | Manter catalogo em arquivo de config: rejeitado por nao permitir criar permissoes em runtime, que e o objetivo central da feature |
| Codigo de permissao | Imutavel apos criacao, normalizado (lowercase, `[a-z0-9.]+`, max ~40 chars) | Clarificacao da spec: editar o codigo quebraria silenciosamente o acesso dos perfis e das telas que o referenciam | Permitir edicao com quebra de acesso: rejeitado (Opcao B confirmada na clarificacao) |
| Exclusao de permissao | Inexistente; somente desativacao (`ativo = false`) | Telas e funcionalidades referenciam os codigos; exclusao fisica quebraria referencias | Exclusao fisica com bloqueio se em uso: rejeitado por nao ser necessario e arriscar integridade |
| Efeito da desativacao | Permissao desativada nao concede acesso a ninguem (mesmo se o codigo ainda constar em perfis gravados) e nao aparece como opcao de associacao; sem limpeza em massa dos perfis | Clarificacao da spec; `comAuth` filtra a lista de permissoes do usuario apenas aos codigos ativos, entao `pode()` nega sem consulta extra | Remover o codigo de todos os perfis na desativacao: rejeitado por gerar escrita em massa e por desnecessario (a filtragem na validacao ja impede o acesso) |
| Funcao unica de validacao | `pode(sessao, codigo)`: sem sessao → `false`; perfil `ADM` → `true`; caso contrario → `codigo` presente em `sessao.permissoes` (que ja contem apenas codigos ativos) | Um unico ponto de decisao, PBAC puro: acesso decidido por permissoes, sem letras de perfil espalhadas nas guards | Funcao com mapa legado codigo→perfis (ex.: `pessoas.editar` → OPC/CRD): rejeitado por manter perfis especiais hardcoded na logica, contrariando o espirito PBAC |
| Regras legadas de perfil | Removidas das guards e consolidadas em duas regras: (1) ADM e superuser em `pode()`; (2) seed dos perfis padrao reproduz o acesso atual | FR-010/FR-014 exigem consolidar sem perder acesso; com a migracao correta do seed, a lista de permissoes de cada perfil ja reproduz o acesso efetivo de hoje | Manter os checks por letra dentro de `pode()`: rejeitado por perpetuar perfis hardcoded na regra de autorizacao |
| Preservacao do acesso atual (FR-014) | Migracao idempotente: (a) ADM recebe todas as permissoes ativas; (b) CRD recebe `pessoas.editar`; (c) ORG mantem `administracao` | Mapa atual das guards: `podeAdministrar` = ADM/ORG + `administracao` (ORG ja tem no seed); `podeEditarPessoa` = ADM/ORG/OPC/CRD + `pessoas.editar` (CRD NAO tem no seed → unica divergencia); `podeZerar`/`podeGerirPerfis` = ADM + permissao (cobertas pelo ADM superuser); `podeOperarEstacionamentos` = ADM/ORG + `estacionamentos.operar` (ORG ja tem). EQP/REC seguem sem permissoes | Nao migrar o seed e manter letras nas guards: rejeitado por dividir a logica em dois sistemas concorrentes |
| Filtro de permissoes ativas na sessao | `comAuth` (backend) e `/api/usuarios/me` (frontend) retornam somente permissoes ativas (join com `permissoes.ativo`) | Garante que um codigo desativado que ainda consta no perfil nunca conceda acesso, sem consulta extra em cada `pode()` | Consultar o catalogo dentro de `pode()` a cada chamada: rejeitado por ser consulta desnecessaria dado o filtro no carregamento da sessao |
| Associacao automatica ao ADM | Ao criar uma permissao, o sistema adiciona o codigo ao perfil ADM (`UPDATE perfis SET permissoes = permissoes || codigo WHERE sigla='ADM'`); `pode()` ja trata ADM como superuser | Clarificacao da spec (FR-016); garante que o ADM sempre "possua" todas as permissoes, refletindo tambem em telas que leem `perfis` | Confiar apenas no superuser em `pode()` sem gravar no perfil ADM: rejeitado por divergir da clarificacao que pede a associacao automatica |
| Protecao da gerencia | A permissao `perfis.gerenciar` nunca pode ser desativada; ADM e fixo (PUT/DELETE ja bloqueados por `fixo`) | Clarificacao da spec (FR-015); evita lockout de administracao | Regra de "ultimo gestor" generica: rejeitado pela clarificacao, que fixa a protecao na propria `perfis.gerenciar` + ADM |
| Tela de controle de permissoes | Nova pagina `Permissoes.tsx` em `/permissoes`, secao Administracao, visivel para `perfis.gerenciar` | "Poder criar permissoes" exige uma interface; e uma tela nova (nao uma adequacao de tela existente) | Fazer apenas via API/seed: rejeitado por nao atender a capacidade pratica de criar |
| Catalogo na tela de perfis | `Perfis.tsx` lista somente permissoes ativas do catalogo; codigos desativados ainda gravados no perfil aparecem como "inativa" e sao descartados ao salvar | FR-008: associacao aceita somente codigos validos e ativos; preserva o dado gravado sem quebrar a exibicao | Esconder codigos desativados silenciosamente: rejeitado por esconder estado real do perfil |
| Catalogo grande | Sem tratamento especial nesta fase | Clarificacao da spec: crescimento do catalogo fora de escopo | Busca/paginacao no catalogo: rejeitado por escopo fora da fase |

## Dependencias

Nenhuma nova dependencia.

Infraestrutura existente reutilizada:
- `comAuth` em `api/src/auth.ts` — carrega perfil + permissoes (passa a filtrar ativas)
- `registrarEvento` em `api/src/auditoria.ts` — auditoria da criacao/edicao/desativacao de permissoes e das associacoes
- Padrao CRUD de `api/src/rotas/perfis.ts` — rotas de `permissoes`
- `usePerfis`/`api.get`/`api.post`/`api.put` em `src/lib/` — hooks e cliente HTTP
- Padrao de tela de `Perfis.tsx` — `Permissoes.tsx`

## Observacoes de seguranca

- Todas as rotas de catalogo exigem `pode(sessao, "perfis.gerenciar")`; na pratica apenas ADM e perfis com essa permissao conseguem gerir o catalogo.
- `pode()` trata ADM como superuser, mas um codigo **desativado** continua negado para todos (inclusive ADM), porque a sessao so carrega permissoes ativas.
- `perfis.gerenciar` nao pode ser desativada; o ADM e fixo e nao pode perder permissoes (PUT/DELETE de perfil `fixo` ja bloqueados).
- Codigo imutavel elimina a classe de bug de renomeacao de permissao quebrar referencias em telas e guards.

## Notas sobre o estado do repositorio

- Existe divergencia preexistente entre o catalogo hardcoded da API (9 itens em `api/src/perfis.ts`) e o do frontend (10 itens em `src/lib/perfis.ts`, inclui `presenca.gerenciar`). A migracao usa a uniao dos dois como seed base (10 codigos ativos).
- `api/src/rotas/perfis.ts` hoje valida `permissoes` via `apenasPermissoesValidas` (array hardcoded). Passa a validar contra o catalogo ativo no banco.
- `scripts/seed-fixture.mjs` nao insere perfis/permissoes; nenhum ajuste necessario no seed de massa.
