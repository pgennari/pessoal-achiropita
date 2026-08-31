# Data Model — Reaproveitar Equipe da Edicao Anterior (029)

A feature **nao altera o schema** (`schema.sql`). E apenas uma projecao de
leitura sobre tabelas existentes + reuso do fluxo de alocacao. As entidades
abaixo sao as existentes envolvidas e a projecao que a feature produz.

## Entidades existentes envolvidas

### Edicao (`edicoes`)

- Campos relevantes: `id`, `numero`, `status` (`planejamento` | `ativa` | `encerrada`).
- Regras aplicadas pela feature:
  - A edicao atual deve estar em `planejamento` para o painel existir (FR-001).
  - A edicao anterior e a de `numero = N - 1` com `status IN ('ativa','encerrada')` (D1).
- Restricao existente: so uma edicao `ativa` por vez (`idx_edicoes_so_uma_ativa`).

### Equipe (`equipes`)

- Campos relevantes: `id`, `edicao_id`, `nome`, `excluida`, `vagas_coordenador`.
- Regras aplicadas pela feature:
  - A equipe da edicao anterior e a que corresponde por **nome normalizado** (D2).
  - Equipes `excluida = TRUE` nao sao consideradas (consistente com alocacao/leitura).
  - `vagas_coordenador` guia o guard visual de "vaga de coordenador cheia" (D6).

### Participacao (`participacoes`)

- Campos relevantes: `id`, `edicao_id`, `equipe_id`, `pessoa_id`, `funcao` (`Coordenador` | `Equipista`).
- Fonte das pessoas da equipe anterior e base para saber quem ja esta na equipe
  atual (`jaNaEquipe`) e quem esta em outra equipe na edicao atual (`emOutraEquipe`).
- Restricao existente: `UNIQUE(edicao_id, pessoa_id)` = uma equipe por pessoa por edicao
  (barra a adicao de pessoa ja alocada, FR-010, com erro 409 amigavel).

### Pessoa (`pessoas`)

- Campos relevantes: `id`, `nome`, `cracha`, `ativo`, `bloqueada`, `excluida`.
- Regras aplicadas pela feature: so entram na lista pessoas `ativo = TRUE`,
  `bloqueada = FALSE` e `excluida = FALSE` (D4 / FR-012).

## Projecao de leitura (sem tabela nova)

### MembroEquipeAnterior (view)

Linha do painel: uma pessoa que participou da equipe equivalente na edicao
anterior, com o contexto dela na edicao atual.

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `pessoaId` | string | id da pessoa (chave de `pessoas`) |
| `pessoaNome` | string | nome atual da pessoa |
| `cracha` | number \| null | numero do cracha (null se ausente na fonte) |
| `funcaoAnterior` | `"Coordenador" \| "Equipista"` | funcao que a pessoa teve na equipe na edicao anterior |
| `jaNaEquipe` | boolean | ja ha participacao da pessoa NA equipe atual na edicao atual |
| `emOutraEquipe` | boolean | ha participacao da pessoa em OUTRA equipe da edicao atual |

### RespostaEquipeAnterior

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `edicaoAnterior` | `{ id: string; numero: number } \| null` | edicao N-1 usada; `null` quando nao existe edicao anterior elegivel |
| `pessoas` | `MembroEquipeAnterior[]` | lista (vazia quando nao ha equipe correspondente ou participacoes) |

## Regras de negocio (resumo das decisoes de research.md)

1. Painel so no status `planejamento` da **edicao atual** (FR-001).
2. Edicao anterior: `numero = N - 1` com status `ativa`/`encerrada` (D1).
3. Equipe anterior: nome normalizado (regex de sufixos romanos/arabicos), unica por edicao (D2).
4. Fonte: tabela `participacoes` da edicao anterior; `participacoes_historicas` fora de escopo (EP-13) (D3).
5. Filtro de pessoas: `ativo`, nao bloqueada, nao excluida logicamente (D4).
6. Nenhum novo endpoint de mutacao: adicionar = `POST /api/participacoes` (permissao `edicao.equipeAlocar` + auditoria + historico) (D5).
7. Vaga de coordenador cheia: guard apenas na UI (D6).
8. Estados vazios distintos: sem edicao anterior vs. sem equipe/pessoas encontradas (D10).

## Transicoes de estado

- Nao ha novos estados nem transicoes. A criacao de participacao continua unica
  (`POST /api/participacoes`), imutavel de ponto de vista de unicidade, e o
  painel apenas reflete o estado corrente das participacoes (reativo via
  invalidacao de query TanStack).