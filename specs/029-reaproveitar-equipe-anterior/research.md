# Pesquisa — Reaproveitar Equipe da Edicao Anterior (029)

Fase 0 do `/speckit.plan`. Resolve as decisoes de design da feature com base
no codigo existente (API Hono + PostgreSQL, frontend Vite/React) e nas
convencoes do projeto.

## D1. Definicao de "edicao anterior"

- **Decision**: A edicao anterior (N-1) e a edicao com `numero = (numero da edicao atual) - 1` e `status IN ('ativa', 'encerrada')`, e o painel so e considerado quando a edicao atual esta em `planejamento`.
- **Rationale**: Reaproveita a regra ja implementada em `GET /api/montagem/candidatos` (`montagem.ts` linhas 83-91), evitando duas regras concorrentes para "edicao anterior". Restringir a `'ativa'/'encerrada'` evita listar uma edicao anterior ainda em planejamento (sem participacoes reais). O painel so aparece em edicao atual `planejamento` (FR-001), mesma janela em que a montagem de equipes faz sentido.
- **Alternatives considered**:
  - "Maior `numero` menor que o atual, sem restricao de status": divergiria da montagem e poderia apontar uma edicao vazia em planejamento.
  - "Qualquer edicao anterior com participacoes (N-2, N-3)": fora do escopo ("edicao anterior" = imediatamente anterior) e nao bate com a spec (FR-004).

## D2. Correspondencia da equipe entre edicoes

- **Decision**: Por nome, normalizando com a mesma regex da montagem: remover sufixos romanos/arabicos finais (`/\s*(I{1,3}|IV|V|VI{0,3}|IX|X|10|[1-9])\s*$/i`) e comparacao case-insensitive. Como o nome de equipe e unico por edicao (validado em `equipes.ts`/`equipeDeSnap`), a correspondencia retorna no maximo uma equipe na edicao anterior.
- **Rationale**: A spec (FR-003) pede correspondencia por nome desconsiderando numeracao; a regra ja existe (e e testada em producao) no match de montagem (`montagem.ts` linhas 96-99, 125-132, 347-361). Reusar evita duplicar logica de dominio.
- **Alternatives considered**: compara por `equipe_pai`/setor — incorreto e desnecessario; equipe anterior excluida logicamente (`excluida = TRUE`) e ignorada.

## D3. Fonte de dados das pessoas da equipe anterior

- **Decision**: Tabela `participacoes` da edicao anterior (join com `equipes` para filtrar por equipe correspondente e com `pessoas` para nome/cracha/status). **NAO** e usada `participacoes_historicas`.
- **Rationale**: `participacoes_historicas` esta reservada para EP-13 (importacao da planilha legada, ainda nao implementada — `schema.sql` linha 287-288, TODO(US-13-01)). Hoje a unica fonte confiavel de quem "esteve na equipe" e a tabela `participacoes`. Incluir a tabela historica agora seria codigo morto.
- **Alternatives considered**: consultar `participacoes_historicas` como fallback — descartado por ser EP-13 (MVP estrito, principio II); documentado como TODOs se a necessidade surgir.

## D4. Filtro de pessoas listadas

- **Decision**: Listar apenas pessoas **alocaveis** na edicao atual: `pessoas.ativo = TRUE`, `pessoas.bloqueada = FALSE`, `pessoas.excluida = FALSE` — mesmo filtro da montagem (`montagem.ts` linhas 106-109).
- **Rationale**: A lista existe para reaproveitar pessoas; esconder bloqueadas/excluidas e exigencia do spec (FR-012) e `excluida`/`bloqueada` nao podem ser alocadas (bloqueadas sao barradas no `POST /api/participacoes`, excluidas barradas na validacao). Incluir `ativo = TRUE` mantem consistencia com o filtro de candidatos da montagem.
- **Alternatives considered**: mostrar bloqueadas/inativas cinza sem acao — insumiria a spec (FR-012 diz para ocultar) e adicionaria estados visuais sem valor.

## D5. Autorizacao

- **Decision**: GET de leitura do painel: `comAuth` (qualquer perfil autenticado), sem `temPermissao` — igual a visibilidade da tela de detalhe da equipe. Adicao: **reusa** `POST /api/participacoes`, que ja exige `edicao.equipeAlocar`, valida equipe/pessoa e registra auditoria (`participacao.alocou`) + historico (`pessoa_equipe_historico`).
- **Rationale**: Escopo minimo. A acao de adicionar da tela atual usa o mesmo POST; nao criar um endpoint de mutacao paralelo (FR-014, FR-015). Uma pessoa sem `edicao.equipeAlocar` ve o painel em modo leitura (satisfaz FR-014 no frontend escondendo os botoes).
- **Alternatives considered**: criar permissao nova (`equipe.equipeAnterior`) — desnecessaria; a pagina inteira ja e visivel a qualquer perfil.

## D6. Vaga de coordenador (FR-011)

- **Decision**: Validacao na UI do painel: quando `contagem de Coordenadores na equipe atual >= equipe.vagasCoordenador`, o botao "adicionar como Coordenador" e desabilitado com mensagem informativa. Sem mudanca no backend.
- **Rationale**: O backend de alocacao (`participacoes.ts`) ja nao valida vagas hoje (valida apenas unicidade por pessoa/edicao via UNIQUE e bloqueios); impor vaga na API agora mudaria o comportamento de todos os fluxos de alocacao (fora do escopo). O campo `vagasCoordenador` e um numero de controle exibido no formulario de equipe/formulario. A UI do painel aplica a mesma protecao de bom senso, sem depender do backend.
- **Alternatives considered**: adicionar validacao de vaga no `POST /api/participacoes` — mudanca comportamental transversal, fora do MVP da feature; gerenciar em tasks.md como TODO se desejado.

## D7. Comportamento de abertura do painel

- **Decision**: Um botao "Equipe da edicao anterior" no cabecalho da tela de detalhe da equipe (visivel apenas quando `edicao.status === 'planejamento'`) abre o drawer lateral direito (fixed `inset-y-0 right-0`, overlay `bg-carbone/40`), fechavel por X/Esc/clique no overlay.
- **Rationale**: Auto-abrir todo detalhe de equipe em planejamento e intrusivo; botao explicito entrega "ate 2 cliques" (SC-001) e cabe no padrao visual dos dialogs existentes (`AlocarPessoaDialog`, `BuscaGlobal`), mas ancorado a direita como pede a spec ("sidesheet no lado direito").
- **Alternatives considered**: aberto por padrao — intrusivo em telas com muito conteudo de equipe.

## D8. Formato do contrato de leitura

- **Decision**: Novo endpoint `GET /api/participacoes/equipe-anterior?edicaoId={id}&equipeId={id}` retornando:

  ```json
  {
    "edicaoAnterior": { "id": "uuid", "numero": 99 } | null,
    "pessoas": [
      {
        "pessoaId": "uuid",
        "pessoaNome": "Nome",
        "cracha": 123,
        "funcaoAnterior": "Equipista" | "Coordenador",
        "jaNaEquipe": false,
        "emOutraEquipe": false
      }
    ]
  }
  ```

- **Rationale**: O frontend precisa saber quem pode ser adicionado (nao esta na equipe atual), quem Ja esta na equipe (FR-009, desabilitado) e quem esta em outra equipe (FR-010, bloqueado). `edicaoAnterior: null` expressa "sem dados de edicao anterior" sem confundir com lista vazia, permitindo estado informativo (FR-013). O endpoint nao expoe dados sensiveis alem dos ja visiveis na pagina.
- **Alternatives considered**: fazer a resolucao 100% no frontend (3+ consultas) — desnecessario e lento; endpoint montado em `montagem.ts` — a feature e sobre participacoes, o endpoint vive em `participacoes.ts` (sem conflito de rotas: nao existe `GET /{id}`).

## D9. Dados da edicao anterior em planejamento-concomitante

- **Decision**: Se a edicao N-1 estiver em `planejamento`, NAO e considerada (ver D1). Consequencia: painel mostra `edicaoAnterior: null` + estado informativo.
- **Rationale**: Edicao em planejamento nao tem participacoes consolidadas; exibir "vazio" seria enganoso. Regra idem montagem.
- **Alternatives considered**: aceitar qualquer status — divergiria da montagem e produziria listas vazias confusas.

## D10. Estado vazio vs. sem edicao anterior

- **Decision**: Dois estados distintos no painel: (a) `edicaoAnterior == null` → "Nao ha dados de edicao anterior"; (b) `edicaoAnterior != null && pessoas.length == 0` → "Nenhuma pessoa encontrada para esta equipe na edicao anterior". Ambos sem quebrar a tela (FR-013).
- **Rationale**: Diferentes causas merecem mensagens diferentes; o payload do contrato (D8) e suficiente para distinguir.
- **Alternatives considered**: mensagem unica — menos clara para o usuario (US-3, cenarios 1 e 2).