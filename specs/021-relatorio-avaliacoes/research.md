# Research: Relatorio de Avaliacoes de Equipistas

**Feature**: `021-relatorio-avaliacoes` | **Date**: 2026-08-23

## R1. Fonte de dados do relatorio

**Decision**: Consumir o endpoint existente `GET /api/avaliacoes?edicaoId={id}` via o hook `useAvaliacoes(edicaoId)`, sem endpoints novos.

**Rationale**: O endpoint ja retorna todos os registros da edicao com os campos necessarios ao relatorio (criterios parseados, aptoCoordenar, comentarios, status, datas, avaliadorNome/Cracha, equipeNome, pessoaNome, pessoaCracha), ordenado por `atualizado_em DESC`, com gate PBAC `avaliacao.gerenciar`. E o mesmo consumo da listagem da tela de edicao (019 US-1), logo nao ha superficie nova de autorizacao nem codigo novo na API.

**Alternatives considered**:
- Novo endpoint `GET /api/avaliacoes/relatorio` com filtros server-side — rejeitado: duplicaria rota existente, adicionaria manutencao sem ganho no volume esperado (ate alguns milhares de registros por edicao, payload pequeno em JSON).
- Reusar `useAvaliacoesPessoa` ou agregacoes do dashboard — rejeitado: escopos diferentes (por pessoa / KPIs de vaga).

## R2. Onde executar filtragem e agregacao

**Decision**: Filtragem e resumo calculados no cliente com funcoes puras dentro de `RelatorioAvaliacoes.tsx` (`aplicarFiltros` + contagens), memoizadas sobre a lista integral.

**Rationale**: Padrao consolidado dos relatorios do sistema (`RelatorioPresenca.tsx` monta dados no cliente "sem chamada nova na API"). Volume alvo (centenas/milhares) e trivial para filtragem em memoria; atualizacao de UI e instantanea ao marcar/desmarcar valores, atendendo SC-002 sem round-trip.

**Alternatives considered**:
- Query params de filtro no servidor — rejeitado: exigiria alterar contrato existente ou criar variante; latencia de rede a cada clique; complexidade sem necessidade de escala.
- Biblioteca de agregacao/consulta (ex.: tanstack table) — rejeitada: dependencia nova viola principio V; filtro e um `Array.filter` composto.

## R3. Permissao de acesso

**Decision**: Reutilizar a permissao existente `avaliacao.gerenciar` (ADM implicito; ORG ja a possui pelo seed de 019) para item de menu, pagina e chamada de API.

**Rationale**: A spec registra como premissa acompanhar os perfis que ja gerenciam avaliacoes, sem permissao nova dedicada. O gate real fica no backend (ja implementado); menu e pagina espelham a mesma checagem via `temPermissao`, padrao de todas as paginas.

**Alternatives considered**:
- Nova permissao `avaliacao.relatorio` (padrao `presenca.relatorio`) — rejeitada nesta versao: criaria seed/catalogo novo sem demanda explicita; pode ser introduzida depois se surgir necessidade de separar "ver relatorio" de "gerenciar avaliacoes".

## R4. Campos de exibicao no tipo frontend `Avaliacao`

**Decision**: Estender a interface `Avaliacao` em `src/lib/tipos.ts` com campos opcionais `equipeNome?: string`, `pessoaNome?: string`, `pessoaCracha?: string | null`.

**Rationale**: O mapper da rota `GET /api/avaliacoes` ja inclui esses tres campos (JOIN com equipes/pessoas), mas o tipo frontend os omite. Declarar os opcionais documenta o contrato real sem quebrar os outros consumidores (`useAvaliacoesPessoa` retorna payload sem `pessoaNome`). Evita joins no cliente com `useEquipes`/`usePessoas` so para rotular linhas.

**Alternatives considered**:
- Resolver nomes no cliente via `useEquipes(edicaoId)` + `usePessoas()` (estilo `RelatorioPresenca`) — rejeitado: baixa carrega pessoas/equipes inteiras so para exibir nomes que a API ja entrega; mais requisicoes e mais acoplamento.
- Criar tipo novo `AvaliacaoRelatorio` — rejeitado: duplicaria a entidade; extensao opcional mantem uma unica fonte de verdade.

## R5. Interacao de filtros (semantica e UI)

**Decision**: Chips multi-selecao por campo usando as classes existentes `filtro-chip`/`filtro-chip-ativo`; semantica OR dentro do mesmo campo e AND entre campos; estado inicial sem selecao = sem restricao. Comando "Limpar filtros" zera tudo.

**Rationale**: Espelha a interacao de notas do formulario publico (`CantinaPesquisaPublico.tsx` usa `filtro-chip` para valores discretos) e o filtro de setor de `EdicaoDetalhe.tsx`. A semantica OR/AND e a convencao universal de facetas e cobre os cenarios de aceite da spec ("Ruim ou Regular" num criterio; intersecao entre criterios).

**Alternatives considered**:
- Select unico por criterio (valor simples) — rejeitado: impede consultas "Ruim ou Regular", recorrentes em analise de qualidade.
- Painel de filtros avancados com operadores configuraveis — rejeitado: escopo muito alem do pedido (MVP estrito).

## R6. Apresentacao do detalhe do registro

**Decision**: Expansao inline da propria linha (padrao `alternarDetalhe` de `CantinaPesquisa.tsx`): clicar no registro abre, abaixo dele, todos os campos da avaliacao (criterios, nota de retorno, aptidao, comentarios, avaliador, pessoa, equipe, status e datas).

**Rationale**: Mesmo comportamento de detalhe ja consagrado na area logada; evita navegacao extra e rota nova; criterios sem resposta aparecem indicados ("—"), cobrindo rascunhos incompletos.

**Alternatives considered**:
- Link para aba "Historico de Avaliacoes" da pessoa (`/pessoas/:id`) — util como atalho complementar, mas nao substitui o detalhe in-place; fica fora desta versao.
- Modal/dialog dedicado — rejeitado: nenhuma necessidade de isolamento de contexto; mais markup para o mesmo conteudo.

## R7. Ordenacao e estabilidade do resultado

**Decision**: Manter a ordenacao do endpoint (`atualizado_em DESC`) como unica ordenacao da v1; nenhum reordenamento no cliente.

**Rationale**: A spec define ordenacao padrao pela data de atualizacao decrescente (FR-014) e nao pede colunas ordenaveis; ordenar no cliente seria codigo morto nesta versao.
