# Quickstart: Relatorio de Avaliacoes de Equipistas

**Feature**: `021-relatorio-avaliacoes` | Guia de validacao manual ponta a ponta

## Prerequisitos

1. API e SPA configurados (ver `CLAUDE.md`, secao Bootstrap).
2. Schema aplicado (tabela `avaliacoes` e `links_avaliacao`, feature 019). Nenhuma migracao nova nesta feature.
3. Uma **edicao ativa** cadastrada com equipes e equipistas alocados.
4. Massa de dados: avaliacoes registradas via o link publico da edicao
   (`/edicoes/:id` > copiar link > informar cracha de coordenador), cobrindo:
   - avaliacoes finalizadas com combinacoes variadas de Otimo/Bom/Regular/Ruim e notas 1..5 de "convidar novamente"
   - pelo menos um rascunho com criterios parcialmente preenchidos
5. Usuarios de teste: um ADM ou ORG (com `avaliacao.gerenciar`) e um perfil sem a permissao (ex.: EQP) para checar acesso negado.
6. Build/typecheck passando:
   - `npm run build` e `npm run lint` na raiz
   - `npm run build` em `api/`

## Cenarios de validacao

### 1. Acesso e visao geral (US-1, cenario 1)

| Passo | Esperado |
|-------|----------|
| Logar com ADM/ORG | Secao "Relatorios" exibe item "Avaliacoes" |
| Abrir `/avaliacoes/relatorio` | Listagem completa das avaliacoes da edicao ativa, mais recente primeiro, sem nenhum filtro marcado |
| Conferir registros | Cada linha mostra pessoa avaliada, equipe, avaliador, status, criterios, nota de retorno e atualizacao |
| Logar com perfil EQP | Item nao aparece no menu; abrir a URL diretamente mostra bloco "Sem permissao"; `GET /api/avaliacoes` responde 403 |

### 2. Filtro por valores de um criterio (US-1, cenarios 2-3)

| Passo | Esperado |
|-------|----------|
| Marcar "Ruim" em Pontualidade | Somente avaliacoes com pontualidade Ruim permanecem; contador bate com a massa |
| Acrescentar "Regular" no mesmo campo | Listagem passa a incluir Ruim **ou** Regular (OR dentro do campo) |
| Desmarcar todos os valores do campo | Retorna a listagem integral, sem recarregar |

### 3. Combinacao entre campos (US-1, cenario 4)

| Passo | Esperado |
|-------|----------|
| Com Pontualidade = Ruim/Regular, marcar notas 1 e 2 em "Chances de convidar novamente" | Somente registros que satisfazem as duas condicoes simultaneamente (AND entre campos) |
| Repetir consulta conferindo contra a massa | Zero falsos positivos/negativos (SC-003) |

### 4. Resumo e contador (US-2)

| Passo | Esperado |
|-------|----------|
| Visualizar resumo sem filtros | Total geral da edicao + distribuicao por valor de cada campo; somas batem com a massa (SC-005) |
| Aplicar filtro em Uniforme | Contagens dos demais campos recalculam sobre o universo filtrado; contagem do proprio Uniforme permanece legivel por valor |
| Aplicar filtros que zeram o resultado | Totais em zero coerentes com a listagem vazia |

### 5. Estados vazios e limpeza (FR-013, FR-016)

| Passo | Esperado |
|-------|----------|
| Acionar "Limpar filtros" com filtros ativos | Todos os chips desmarcam; listagem volta ao integral |
| Filtrar por combinacao sem resultados | Mensagem "nenhuma avaliacao corresponde aos filtros" + acao de limpar filtros |
| Edicao sem nenhuma avaliacao (testar em outra base se necessario) | Estado vazio orienta que avaliacoes sao feitas pelo link publico da edicao |

### 6. Rascunhos incompletos (edge cases)

| Passo | Esperado |
|-------|----------|
| Sem filtros, localizar rascunho parcial | Aparece com badge de rascunho; criterios vazios indicados como sem resposta |
| Ativar qualquer filtro no criterio que esta vazio nele | Registro sai do resultado |
| Expandir o detalhe do rascunho | Campos preenchidos visiveis; aptidao/comentarios/datas corretos |

### 7. Detalhe completo (US-3)

| Passo | Esperado |
|------|----------|
| Selecionar uma avaliacao finalizada | Detalhe expande inline: pessoa, equipe, avaliador, status, 6 criterios, nota de retorno, aptidao, comentarios e datas (criacao/atualizacao/finalizacao) |
| Selecionar outro registro | Detalhe anterior recolhe/alterna sem duplicacao |

### 8. Responsividade e performance (SC-002)

| Passo | Esperado |
|-------|----------|
| Repetir cenarios 2-4 em largura de celular | Layout utilizavel, chips navegaveis, sem corte de conteudo essencial |
| Com algumas centenas de avaliacoes | Cada alteracao de filtro reflete em < 2 s |

## Checagem final

- `npm run lint` (typecheck) sem erros
- `npm run build` na raiz e em `api/` sem erros
- Nenhum endpoint novo chamado pela pagina (apenas `GET /api/avaliacoes`)
