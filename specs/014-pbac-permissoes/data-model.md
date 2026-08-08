# Data Model: PBAC - Catalogo de Permissoes e Validacao Unica de Acesso

## Entidades Novas

### Permissao

Tabela: `permissoes` (nova em `schema.sql`) | Tipo TS: `Permissao` (estendido em `src/lib/tipos.ts`)

Item do catalogo de controle de acesso. E a fonte unica da verdade do que cada codigo significa. O codigo e a chave imutavel; uma permissao nunca e excluida fisicamente — somente desativada.

| Campo | Tipo | Origem | Descricao |
|-------|------|--------|-----------|
| `codigo` | `TEXT PK` | rota (POST) | Identificador unico, imutavel, lowercase `[a-z0-9.]+` (max 40 chars) |
| `rotulo` | `TEXT NOT NULL` | rota | Nome de exibicao (editavel) |
| `descricao` | `TEXT NOT NULL DEFAULT ''` | rota | Descricao do que a permissao concede (editavel) |
| `ativo` | `BOOLEAN NOT NULL DEFAULT TRUE` | rota (PUT) | `true` = concede acesso; `false` = desativada (nunca concede) |
| `criadoEm` (`criado_em`) | `TIMESTAMPTZ NOT NULL DEFAULT now()` | banco | Data de criacao |
| `atualizadoEm` (`atualizado_em`) | `TIMESTAMPTZ NOT NULL DEFAULT now()` | banco | Data da ultima alteracao |

**Regras**:
- Seed inicial (10 codigos ativos): `administracao`, `pessoas.ver`, `pessoas.editar`, `crachas.entregar`, `fotos.pendencias`, `formacao.operar`, `estacionamentos.operar`, `zeramento.executar`, `perfis.gerenciar`, `presenca.gerenciar`
- `codigo` imutavel apos a criacao (FR-005); duplicado rejeitado (FR-003)
- `perfis.gerenciar` nunca pode ser desativada (FR-015)
- Sem exclusao fisica; toda remocao de acesso ocorre por `ativo = false` (FR-006)
- Ao criar uma permissao, o codigo e adicionado ao perfil ADM automaticamente (FR-016)

## Entidades Existentes Alteradas

### Perfil

Tabela: `perfis` | Tipo TS: `PerfilInfo`

Sem mudanca de schema; muda apenas o seed/migracao para preservar o acesso atual (FR-014):

| Ajuste | Detalhe |
|--------|---------|
| ADM recebe todas as permissoes ativas | `UPDATE perfis SET permissoes = <todos os codigos ativos> WHERE sigla='ADM'` (idempotente) |
| CRD recebe `pessoas.editar` | Guard legada `podeEditarPessoa` concedia edicao ao CRD pela letra; sem o seed, o CRD perderia esse acesso |
| ORG mantem `administracao` | Seed atual ja possui; a migracao so adiciona se ausente |

Regras existentes que continuam valendo: ADM e `fixo` (PUT/DELETE bloqueados); perfis nao excluiveis em uso; `permissoes` armazenada como array de codigos.

### Usuario

Tabela: `usuarios` | Tipo TS: `Usuario`/`Sessao`

Sem mudanca de schema. O acesso efetivo do usuario = permissoes ativas do perfil dele. A sessao carrega apenas codigos ativos (filtro em `comAuth` e em `/api/usuarios/me`), entao um codigo desativado que ainda consta no perfil nunca concede acesso.

## Relacionamentos

```
Permissao N ── M Perfil   (perfis.permissoes[] referencia permissoes.codigo)
Perfil     1 ── N Usuario (usuarios.perfil → perfis.sigla)
```

Concessao e sempre via perfil (sem concessao direta ao usuario nesta fase). A validacao resolve:
`Usuario.perfil → Perfil.permissoes[] → intersect com Permissao.ativo → sessao.permissoes`.

## Estados

### Permissao

| Estado | `ativo` | Descricao |
|--------|---------|-----------|
| Ativa | `true` | Concede acesso quando presente no perfil; aparece como opcao de associacao |
| Desativada | `false` | Nao concede acesso (mesmo se o codigo ainda constar em perfis); nao aparece como opcao de associacao; sem volta automatica (reativavel explicitamente via PUT) |

### Fluxo de Transicao de Estados

```
[Permissao] criar → ativa → desativar → desativada → reativar → ativa
```

- Transicao `ativo: true → false` bloqueada para `perfis.gerenciar`
- Criacao insere sempre `ativo = true` e associa ao ADM

## Validacoes (resumo, detalhes em contracts/)

- `codigo`: unico, imutavel, `[a-z0-9.]{1,40}`, obrigatorio; duplicado → 409
- `rotulo`: obrigatorio, nao vazio (trim)
- `descricao`: opcional
- Associacao em perfis: aceita somente codigos validos e ativos; inexistente/desativado → descartado na validacao da rota de perfil
- Desativacao de `perfis.gerenciar` → 400
- Acesso as rotas de catalogo: `pode(sessao, "perfis.gerenciar")` (403 caso contrario)

## Entidade Nova Conceitual (validacao)

### Decisao de Acesso

Nao persistida; calculada a cada chamada pela funcao unica `pode(sessao, codigo)`:

```
sem sessao             → false
perfil == "ADM"        → true
senao                  → codigo ∈ sessao.permissoes (apenas ativas)
```
