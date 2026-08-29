# API Contract: Exclusao lógica de equipes

**Date**: 2026-08-29

## Base URL

`/api`

## Autenticacao

Todos os endpoints requerem Bearer token no header `Authorization`.

## Contratos alterados

### DELETE /api/equipes/:id — de exclusao fisica para exclusao logica

**Permissao**: `edicao.equipeExcluir`

**Comportamento (transacao)**:

1. Equipe inexistente **ou** excluida → `404 { "erro": "Equipe não encontrada." }`
2. Remove todas as participacoes da equipe e registra a desalocacao de cada pessoa em `pessoa_equipe_historico` (origem = equipe, destino = NULL, autor = sessao).
3. Desatrela subequipes (`equipe_pai_id = NULL`).
4. Marca `excluida = TRUE`.
5. Registra evento `equipe.removeu` na auditoria.

**Response 200** (inalterada):

```json
{
  "ok": true
}
```

> `removerEquipe` (`src/lib/equipes.ts:112`) apenas aguarda o `DELETE` e invalida os caches (`equipes`, `participacoes`); nao le corpo da resposta. A contagem de desalocados vai para o detalhe do evento de auditoria `equipe.removeu`. Comentario em `removerEquipe` sobre cascade no banco deve ser atualizado (deixa de valer).

**Response 403**:

```json
{ "erro": "Acesso negado. Requer permissao edicao.equipeExcluir." }
```

**Response 404**:

```json
{ "erro": "Equipe não encontrada." }
```

**Response 409** (concorrencia — exclusao simultanea):

```json
{ "erro": "Equipe não encontrada." }
```

---

### GET /api/equipes — lista apenas nao excluidas

**Permissao**: `edicao.equipes` (mantida)

Todas as variantes (com `edicaoId`, escopo CRD sem `edicaoId`, listagem geral) adicionam `AND e.excluida = FALSE`. Equipes excluidas nao aparecem em nenhuma resposta.

---

### GET /api/equipes/:id — detalhe

**Permissao**: `edicao.equipes` (mantida)

Equipe inexistente **ou** excluida → `404 { "erro": "Equipe não encontrada." }`. Respesta **200 inalterada** no formato (`id`, `edicaoId`, `nome`, `sigla`, `equipeIdPai`, `ativo`, `totalPessoas`, `criadoEm`), agora com `excluida` presente.

---

### GET /api/equipes/relatorio-equipistas — relatorio

**Permissao**: `equipes.listar` (mantida)

Filtra `e.excluida = FALSE` no `FROM equipes` do agregado.

---

### POST /api/equipes/copiar — copiar equipes

Adiciona `AND origem.excluida = FALSE` na origem; equipes excluidas nao sao copiadas.

---

### GET /api/presenca/resumo-equipes — grade de presenca

**Permissao**: `presenca.listar` (mantida)

Query `presenca.ts:281-304` adiciona `AND eq.excluida = FALSE`. Equipes excluidas nao aparecem na grade por dia nem no resumo.

---

### GET /api/presenca/:diaId e GET /api/presenca/pessoa — inalterados

Joins que resolvem o nome da equipe nas presencas da **pessoa** continuam sem filtro: sao registros historicos da pessoa (US3/FR-007) e devem seguir exibindo o nome gravado. **Nao** aplicar `excluida = FALSE` aqui.

---

### POST /api/participacoes — alocar pessoa

**Permissao**: `edicao.equipeAlocar` (mantida)

Antes do INSERT, valida que a equipe existe e `excluida = FALSE`:

**Response 404** (novo):

```json
{ "erro": "Equipe não encontrada ou excluída." }
```

---

### GET /api/sincronizacao/:edicaoId — contexto de equipes da edicao

Equipes excluidas nao entram no contexto (`sincronizacao.ts:260`) nem nos diffs de atualizacao.

---

## Campos adicionados

- Interface `Equipe` em `src/lib/tipos.ts` ganha `excluida: boolean`.
- `equipeDeSnap` (`src/lib/equipes.ts`) mapeia `excluida: (data.excluida as boolean) ?? false` (snapshots antigos sem o campo nao quebram). Nenhuma tela filtra no front — a API ja retorna listas limpas.

## Fora de escopo

- Restauracao de equipe excluida (sem endpoint).
- Remocao fisica / limpeza de equipes excluidas.
- Mudanca nas permissoes: `edicao.equipeExcluir` continua governando a exclusao.