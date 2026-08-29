# API Contract: Exclusao logica de pessoas

**Date**: 2026-08-29

## Base URL

`/api`

## Autenticacao

Todos os endpoints (menos os de validacao publica) requerem Bearer token no header `Authorization`.

## Contratos alterados

### GET /api/pessoas/:id/exclusao-previa — contagem de vinculos (NOVO)

**Permissao**: `pessoas.excluir`

Retorna as contagens que o dialogo de confirmacao exibe antes do confirm (FR-003):

**Response 200**:

```json
{
  "vinculos": { "equipes": 2, "veiculos": 1, "vagas": 1, "parentes": 3 },
  "totalVinculos": 7,
  "veiculosSemVinculos": 1
}
```

- `vinculos.equipes` = participacoes em edicoes nao encerradas (R5).
- `vinculos.veiculos` = linhas em `pessoa_veiculo` da pessoa.
- `vinculos.vagas` = vinculo de vaga (`pessoa_vaga`).
- `vinculos.parentes` = lacos de parentesco (nos dois sentidos).
- `veiculosSemVinculos` = veiculos que, apos remover os vinculos desta pessoa, ficarao sem nenhuma outra pessoa (serao excluidos logicamente).

**Response 404** (pessoa inexistente ou ja excluida):

```json
{ "erro": "Pessoa não encontrada." }
```

**Response 403**:

```json
{ "erro": "Acesso negado. Requer permissao pessoas.excluir." }
```

---

### DELETE /api/pessoas/:id — de exclusao fisica para exclusao logica

**Permissao**: `pessoas.excluir`

**Comportamento (transacao)**:

1. Pessoa inexistente **ou** excluida → `404 { "erro": "Pessoa não encontrada." }` (concorrencia inclusa — segunda exclusao simultanea tambem 404).
2. Desaloca as participacoes da pessoa em edicoes nao encerradas, registrando cada desalocacao em `pessoa_equipe_historico` (origem = equipe, destino = NULL, autor = sessao).
3. Desvincula os veiculos da pessoa; cada veiculo que fica sem nenhuma outra pessoa vinculada e marcado `excluida = TRUE`; os compartilhados permanecem ativos e inalterados.
4. Libera a vaga de estacionamento (`pessoa_vaga`).
5. Remove os lacos de parentesco nos dois sentidos (`parentes`), sem apagar cadastros.
6. Marca `pessoa.excluida = TRUE`.
7. Nenhum cadastro de equipe, veiculo, vaga, estacionamento ou parente e apagado; a foto nao e removida.
8. Registra evento `pessoa.excluiu` na auditoria (autor, quando, contagens).

**Response 200** (novos campos `vinculosDesfeitos` / `veiculosExcluidos`):

```json
{
  "ok": true,
  "vinculosDesfeitos": 7,
  "veiculosExcluidos": 1
}
```

> `excluirPessoa` (`src/lib/pessoas.ts:206`) aguarda o `DELETE` e invalida os caches; nao le o corpo. A contagem detalhada vai para o evento `pessoa.excluiu`.

**Response 403**:

```json
{ "erro": "Acesso negado. Requer permissao pessoas.excluir." }
```

**Response 404**:

```json
{ "erro": "Pessoa não encontrada." }
```

---

### GET /api/pessoas — lista apenas pessoas nao excluidas

**Permissao**: `pessoas.listar` (nas tres variantes de escopo — geral, equipe e proprio)

Todas as variantes adicionam `excluida = FALSE`. Pessoas excluidas nao aparecem em nenhuma resposta (FR-004).

---

### GET /api/pessoas/:id — detalhe

**Permissao**: `pessoas.listar` (mantida)

Pessoa inexistente **ou** excluida → `404 { "erro": "Pessoa não encontrada." }`. Response **200 inalterada** no formato, com `excluida` presente (FR-006).

---

### Mutacoes da pessoa — guarda contra excluida

**Permissoes**: mantidas (`pessoas.editar`, `pessoas.ativar`, `pessoas.associar`, `pessoas.excluir`)

Todos os endpoints abaixo passam a responder `404 { "erro": "Pessoa não encontrada." }` quando a pessoa alvo estiver excluida:

- `PUT /api/pessoas/:id` (editar)
- `PUT /api/pessoas/:id/ativacao` (inativar/reativar)
- `POST /api/pessoas/:id/foto` e `DELETE /api/pessoas/:id/foto`
- `GET /api/pessoas/:id/veiculos`
- `POST /api/pessoas/:id/veiculos` — tambem passa a rejeitar veiculo excluido: `404 { "erro": "Veiculo nao encontrado." }`
- `DELETE /api/pessoas/:id/veiculos/:veiculoId` — vinculo de pessoa excluida nao e encontrado

O `GET /api/pessoas/proximo-cracha` fica **inalterado**: como o cracha de excluidas permanece na tabela, o `MAX(cracha)` mantem a reserva automaticamente (FR-010).

---

### GET /api/pessoas/busca e links de parente — buscar

**Permissao**: `pessoas.listar` (mantida)

Consultas de busca global e de resolucao de parentes adicionam `excluida = FALSE`; pessoa excluida nunca e retornada nem pode virar parente de cadastro ativo.

---

## Endpoints que leem pessoas fora de /api/pessoas — filtro `excluida = FALSE`

- `GET /api/sincronizacao/:edicaoId` — contexto de pessoas da edicao ignora excluidas (`sincronizacao.ts:248`).
- `POST /api/participacoes` (alocar) — pessoa excluida e rejeitada na validacao (`participacoes.ts:27`).
- `GET /api/veiculos` e `GET /api/veiculos/:id` — veiculos excluidos nao aparecem (FR-014); vinculos/validacoes de pessoa em `veiculos.ts:354,392,431` ignoram excluidas.
- `GET /api/vagas/...` (ocupantes e validacao, `vagas.ts:145,153`) — pessoas excluidas nao aparecem como ocupantes nem sao aceitas.
- `GET /api/montagem/...` (`montagem.ts:106,219,268`) — pessoas excluidas nao aparecem como candidatas nem validam.
- `GET /api/bloqueios/...` (`bloqueios.ts:173,275`) — pessoas excluidas nao aparecem na atribuicao de bloqueio nem validam.
- `POST /api/validacao/identificar` (`publico.ts:185`) — `WHERE cracha = {n} AND ativo = true AND excluida = FALSE` → pessoa excluida cai na mensagem generica (`FR-005`).
- `presencaPublico.ts:137,203` e `avaliacaoPublico.ts:131` — fluxos publicos ignoram pessoas excluidas.
- Cantina publica: formulario anonimo (`pesquisas_cantina` nao referencia pessoa) — sem mudanca; pessoa excluida nao chega la porque nao valida (FR-005).

## Inalterados (leituras historicas do nome)

- `GET /api/presenca/:diaId` e `GET /api/presenca/pessoa` — joins que resolvem o nome gravado nas presencas da pessoa continuam sem filtro (US3/FR-007).
- `GET /api/avaliacoes/...` — joins de nome sobre avaliacoes antigas continuam sem filtro (US3/FR-007).
- `GET /api/estacionamento/...` e check-ins — joins de nome da pessoa preservados (a linha nao e apagada, o nome resolve normalmente).

## Campos adicionados

- Interface `Pessoa` em `src/lib/tipos.ts` ganha `excluida: boolean`.
- Interface `Veiculo` em `src/lib/tipos.ts` ganha `excluida: boolean`.
- `pessoaDeSnap` (`src/lib/pessoas.ts`) e `veiculoDeSnap` (`src/lib/veiculos.ts`) mapeiam `excluida: (data.excluida as boolean) ?? false` — snapshots antigos sem o campo nao quebram. Nenhuma tela filtra no front — a API ja retorna listas limpas.

## Fora de escopo

- Restauracao de pessoa ou veiculo excluido (sem endpoint).
- Remocao fisica / limpeza de registros excluidos (sem endpoint).
- Regra de veiculo orfao fora da exclusao de pessoa (o desvincular manual nao exclui veiculo).
- Revogacao de sessoes publicas JWT ja emitidas.
- Mudanca nas permissoes: `pessoas.excluir` continua governando a exclusao.