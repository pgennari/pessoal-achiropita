# Data Model: Pesquisa de Satisfacao da Cantina

**Feature**: `020-cantina-pesquisa` | **Data**: 2026-08-22

## Entidade: PesquisaCantina

Resposta individual do formulario publico de satisfacao da cantina.
Tabela `pesquisas_cantina` (nova, em `schema.sql`).

### DDL (adicionar a schema.sql)

```sql
-- pesquisas_cantina: resposta do formulario publico de satisfacao (020).
-- Rota publica fixa /cantina/pesquisa, sem token; sem deduplicacao por e-mail.
CREATE TABLE IF NOT EXISTS pesquisas_cantina (
  id                 TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  nome               TEXT NOT NULL,
  email              TEXT,
  telefone           TEXT,
  dia_ida            DATE,
  convite            TEXT,
  deseja_informacoes BOOLEAN NOT NULL DEFAULT FALSE,
  notas              JSONB NOT NULL DEFAULT '{}',
  recomendaria       TEXT NOT NULL,
  melhorias          TEXT,
  criado_em          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pesquisas_cantina_criado_em
  ON pesquisas_cantina(criado_em DESC);
```

### Campos e regras de validacao

| Campo | Coluna | Tipo TS | Obrigatorio | Regras |
|-------|--------|---------|-------------|--------|
| id | id | string | sim (gerado) | UUID texto gerado pelo banco |
| nome | nome | string | sim | trim; nao vazio |
| email | email | string \| null | condicional | obrigatorio com formato valido SOMENTE quando `desejaInformacoes = true`; caso contrario pode ser null |
| telefone | telefone | string \| null | nao | informativo; qualquer formato aceito |
| diaIda | dia_ida | string (`YYYY-MM-DD`) \| null | nao | quando informado, deve constar nos dias de festa da edicao ativa |
| convite | convite | string \| null | nao | texto curto livre (numero/identificacao do convite) |
| desejaInformacoes | deseja_informacoes | boolean | sim (padrao false) | opt-in "Deseja receber informacoes sobre a Festa de Nossa Senhora Achiropita?"; sem resposta grava false |
| notas | notas | objeto | sim (5 chaves) | JSONB `{ atendimento, alimentacao, organizacao, ambiente, voluntarios }`, inteiros 1–5, todos presentes no envio |
| recomendaria | recomendaria | `"Sim" \| "Nao" \| "Talvez"` | sim | enum fechado validado por zod |
| melhorias | melhorias | string \| null | nao | maximo 4000 caracteres |
| criadoEm | criado_em | string (ISO timestamp) | sim (gerado) | base da ordenacao da listagem (`DESC`) |

Sem `atualizado_em`: respostas sao imutaveis apos o envio (nao ha edicao nesta versao).

## Relacionamentos

- `dia_ida` **sem FK** para `dias_festa` — data solta ISO (decisao D4 do research.md): a resposta historica sobrevive a remocao/recadastro do dia.
- Contexto de exibicao do formulario vem de `edicoes` (edicao ativa) e `dias_festa` via endpoint publico (somente `{ id, data }`).

## Entidades existentes reutilizadas (sem alteracao de estrutura)

- **DiaFesta** (`dias_festa`): alimenta as opcoes do campo "Dia da ida a cantina" da edicao ativa.
- **Edicao** (`edicoes`): contexto corrente (`status = 'ativa'`).
- **Permissao/Perfil** (`permissoes`, `perfis`): novo codigo no catalogo.

## Seeds (schema.sql)

```sql
INSERT INTO permissoes (codigo, rotulo, descricao) VALUES
  ('cantina.gerenciar', 'Cantina: gerenciar pesquisas', 'Ver o link publico, listar e visualizar pesquisas de satisfacao da cantina.')
ON CONFLICT (codigo) DO NOTHING;
```

Adicionar `cantina.gerenciar` ao array `permissoes` do perfil `ORG` no seed de `perfis`
(mesmo bloco de `avaliacao.gerenciar`). ADM tem acesso implicito via `pode()`.

## Estados e ciclo de vida

- Unico estado: gravada no envio (`criado_em`) e imutavel.
- Sem transicoes de status, sem rascunho, sem exclusao nesta versao.

## Volumetria

- Milhares de registros por edicao (fluxo publico aberto). Listagem sempre em lotes
  de 20 via indice `idx_pesquisas_cantina_criado_em DESC`; nenhum relatorio agregado nesta versao.
