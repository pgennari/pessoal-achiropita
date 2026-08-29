# Data Model: Montagem de Equipes

**Date**: 2026-08-25

## Overview

A feature nao cria novas tabelas. Utiliza tabelas existentes (pessoas, equipes, participacoes, participacoes_historicas, avaliacoes, presencas, edicoes) e adiciona uma nova permissao ao catalogo.

## Entidades Existentes Utilizadas

### Pessoa (read-only na montagem)
- `id`, `nome`, `nascimento`, `foto_url`, `ativo`
- Idade calculada a partir de `nascimento` via `calcularIdade()`

### Equipe (read-only na montagem)
- `id`, `edicao_id`, `nome`, `setor`, `vagas_coordenador`, `vagas_equipista`
- Filtro por `edicao_id` = edicao ativa

### Participacao (leitura + criacao)
- `edicao_id`, `equipe_id`, `pessoa_id`, `funcao`
- Leitura: pessoas ja alocadas na equipe selecionada + pessoas alocadas em outras equipes (para excluir da listagem)
- Criacao: via `POST /api/participacoes` existente

### ParticipacaoHistorica (read-only)
- `pessoa_id`, `edicao_numero`, `equipe_nome`, `funcao`
- Usada para calcular componente "historico" do match
- Comparacao de equipe por nome normalizado (sem sufixos numericos)

### Avaliacao (read-only)
- `edicao_id`, `equipe_id`, `pessoa_id`, `criterios` (JSONB), `status`, `comentarios`, `apto_coordenar`
- Filtro: `status = 'finalizada'` + edicao anterior
- `criterios.convidarNovamente` (1-5) para componente do match

### Presenca (read-only)
- `edicao_id`, `pessoa_id`, `dia_festa_id`
- Contagem distinta de dias por pessoa na edicao anterior

### Edicao (read-only)
- `id`, `numero`, `ano`, `status`
- Necessaria para determinar edicao ativa, anterior (N-1) e retrasada (N-2)

## Permissao Nova

### edicao.montagem
- **Tabela**: `permissoes` (INSERT no seed)
- **Codigo**: `edicao.montagem`
- **Rotulo**: Edicao: montagem
- **Descricao**: Montar equipes com pontuacao de match
- **Perfil atribuido**: ORG (via `perfis.permissoes` array)

## Match Score — Composicao (0-100 pontos)

### Componente 1: Historico na equipe (0 ou 50 pontos)
- **Fonte**: `participacoes_historicas` + `participacoes` (edicoes anteriores)
- **Regra**: 50 pontos se a pessoa participou da equipe (ou equivalente) em qualquer edicao anterior
- **Normalizacao**: `regexp_replace(equipe_nome, '\s*(I{1,3}|IV|V|VI{0,3}|IX|X|10|[1-9])\s*$', '', 'i')` para comparar nomes sem numeracao

### Componente 2: Criterios da avaliacao (0-30 pontos)
- **Fonte**: `avaliacoes.criterios` (JSONB) da edicao anterior
- **Regra**: 6 criterios x max 5 pontos cada
  - pontualidade: Otimo=5, Bom=3, Regular=1, Ruim=0
  - dedicacao: Otimo=5, Bom=3, Regular=1, Ruim=0
  - companheirismo: Otimo=5, Bom=3, Regular=1, Ruim=0
  - espiritualidade: Otimo=5, Bom=3, Regular=1, Ruim=0
  - comprometimento: Otimo=5, Bom=3, Regular=1, Ruim=0
  - uniforme: Otimo=5, Bom=3, Regular=1, Ruim=0

### Componente 3: Convidar novamente (0-10 pontos)
- **Fonte**: `avaliacoes.criterios.convidarNovamente` (1-5) da edicao anterior
- **Regra**: `convidarNovamente * 2` (max 10)

### Componente 4: Presencas (0-10 pontos)
- **Fonte**: `presencas` da edicao anterior
- **Regra**: COUNT DISTINCT `dia_festa_id` por pessoa, limitado a 10

## Endpoint API

### GET /api/montagem/candidatos

**Query params**: `edicaoId` (obrigatorio), `equipeId` (obrigatorio), `offset` (opcional, default 0), `limit` (opcional, default 20, max 20)

**Logica SQL** (pseudocode):
1. Determinar edicao anterior (N-1) a partir da edicao ativa
2. Buscar pessoas ativas NAO alocadas na edicao corrente
3. Para cada pessoa, calcular os 4 componentes do match
4. Ordenar por match DESC
5. Aplicar LIMIT/OFFSET
6. Retornar `{ itens, total, temMais }`

**Permissao**: `edicao.montagem`

### GET /api/montagem/match/:pessoaId

**Query params**: `edicaoId` (obrigatorio — equipe da edicao ativa), `edicaoHistorico` (opcional — edicao para detalhe, default N-2)

**Logica**:
1. Para a pessoa + equipe, buscar avaliacoes e presencas de todas as edicoes anteriores
2. Calcular match detalhado para cada edicao
3. Retornar array de edicoes com match detalhado

**Permissao**: `edicao.montagem`
