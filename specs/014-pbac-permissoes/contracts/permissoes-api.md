# Contract: Permissoes API

Endpoints do catalogo de permissoes e comportamento da validacao unica de acesso.

## Visao Geral

| Recurso | Metodo | Rota | Descricao |
|---------|--------|------|-----------|
| Permissoes | `GET` | `/api/permissoes` | Lista o catalogo (permissoes ativas; parametro `todos` inclui desativadas) |
| Permissoes | `POST` | `/api/permissoes` | Cria permissao (`ativo = true`, associa ao ADM) |
| Permissoes | `PUT` | `/api/permissoes/:codigo` | Altera rotulo/descricao e `ativo` (codigo imutavel) |
| Sessao | `GET` | `/api/usuarios/me` | Sessao com `permissoes` contendo somente codigos ativos (ja existente, passa a filtrar) |

Todas as rotas de catalogo exigem `pode(sessao, "perfis.gerenciar")`; sem autenticacao → 401; sem a permissao → 403.

## Autenticacao

`Authorization: Bearer <token>` (Firebase ID token), via middleware `comAuth`. Regras globais existentes (401/403) continuam valendo; a novidade e o uso de `pode()` em vez dos checks por letra.

## Endpoints

### GET /api/permissoes

**Query params**

| Nome | Tipo | Obrigatorio | Descricao |
|------|------|-------------|-----------|
| `todos` | `boolean` | nao | `true` → inclui desativadas; padrao `false` |

**Resposta 200**

```json
{
  "permissoes": [
    {
      "codigo": "perfis.gerenciar",
      "rotulo": "Gerenciar perfis",
      "descricao": "Criar e editar perfis de acesso",
      "ativo": true,
      "criadoEm": "2026-08-07T12:00:00Z",
      "atualizadoEm": "2026-08-07T12:00:00Z"
    }
  ]
}
```

**Resposta 401** (sem autenticacao) / **403** (sem `perfis.gerenciar`): `{ "erro": "..." }` (regras globais existentes).

### POST /api/permissoes

**Request body**

```json
{
  "codigo": "relatorios.gerar",
  "rotulo": "Gerar relatorios",
  "descricao": "Emissao de relatorios gerenciais"
}
```

| Campo | Tipo | Obrigatorio | Validacao |
|-------|------|-------------|-----------|
| `codigo` | `string` | sim | `[a-z0-9.]{1,40}`, trim; unico |
| `rotulo` | `string` | sim | nao vazio apos trim, max 80 |
| `descricao` | `string` | nao | max 280; padrao `""` |

**Resposta 201** — `{ "permissao": { ... } }` (com `ativo: true`).

**Erros**: 400 zod (campos invalidos) / 409 codigo duplicado / 403 sem `perfis.gerenciar` / 401 sem autenticacao.

**Efeito colateral**: o codigo criado e adicionado a `perfis.permissoes` do perfil `ADM` (regra FR-016). Falha nessa associacao nao impede a criacao (a permissao ativa ja concede ao ADM via superuser); erro logado e registrado em auditoria.

**Auditoria**: `registrarEvento(tipo: "permissoes.criar")` com `{ codigo, rotulo }`; `permissoes.associar-adm` ao atualizar o perfil ADM.

### PUT /api/permissoes/:codigo

**Request body** (todos opcionais; ao menos um obrigatorio)

```json
{
  "rotulo": "Gerar relatorios executivos",
  "descricao": "Emissao de relatorios para direcao",
  "ativo": false
}
```

| Campo | Tipo | Validacao |
|-------|------|-----------|
| `rotulo` | `string` | nao vazio apos trim, max 80, se presente |
| `descricao` | `string` | max 280, se presente |
| `ativo` | `boolean` | se presente |

**Resposta 200** — `{ "permissao": { ... } }` com `atualizadoEm` atualizado.

**Erros**:
- 400: corpo vazio (nada a atualizar) ou `ativo: false` para `perfis.gerenciar`
- 404: codigo inexistente
- 403 sem `perfis.gerenciar` / 401 sem autenticacao

**Regras**: `codigo` (o parametro da rota) e imutavel — nao pode ser alterado, mesmo que apareca no body (ignorado ou 400). Desativar (`ativo=false`) nao altera perfis; a negacao do acesso ocorre pelo filtro de ativas na sessao.

**Auditoria**: `registrarEvento(tipo: "permissoes.atualizar")` com `{ codigo, campos }`; quando `ativo` mudar, registrar `"permissoes.desativar"`/`"permissoes.reativar"`.

### GET /api/usuarios/me (alteracao)

Sem mudanca de contrato (resposta ja inclui `permissoes`). O array passa a conter somente codigos ativos do perfil. Perfis com codigos desativados gravados mantem o codigo no banco, mas ele nao aparece na sessao.

## Funcao Unica de Validacao

### Backend — `pode(sessao, codigo)`

```ts
export function pode(sessao: Sessao | null | undefined, codigo: string): boolean
```

| Condicao | Retorno |
|----------|---------|
| `sessao` ausente / sem `perfil` | `false` |
| `sessao.perfil === "ADM"` | `true` |
| caso contrario | `sessao.permissoes?.includes(codigo) ?? false` |

Pre-condicao garantida por `comAuth`: `sessao.permissoes` contem somente codigos ativos.

### Guards existentes (nao alteram chamadas; delegam a `pode()`)

- `temPermissao(sessao, codigo)` → `pode(sessao, codigo)`
- `podeAdministrar(sessao)` → `pode(sessao, "administracao")`
- `podeEditarPessoa(sessao)` → `pode(sessao, "pessoas.editar")`
- `podeOperarEstacionamentos(sessao)` → `pode(sessao, "estacionamentos.operar")`
- `podeZerar(sessao)` → `pode(sessao, "zeramento.executar")`
- `podeGerirPerfis(sessao)` → `pode(sessao, "perfis.gerenciar")`

### Frontend — `pode()` em `src/lib/sessao.ts`

Mesmo contrato e mesmas regras sobre `sessao.permissoes`. `CATALOGO_PERMISSOES` e `rotuloPermissao` (em `src/lib/perfis.ts`) deixam de existir; rotulos vem de `usePermissoes()`.

## Regras de Negocio (resumo)

| Regra | Comportamento | Onde |
|-------|---------------|------|
| Codigo imutavel | POST define; PUT nao altera | rota PUT |
| Sem exclusao | remocao de acesso = desativacao | rota PUT |
| `perfis.gerenciar` protegida | nao pode ser desativada | rota PUT + regra em auditoria |
| Criacao associa ao ADM | codigo adicionado a `perfis` do ADM | rota POST |
| ADM superuser | `pode()` retorna `true` para ADM | funcao `pode` |
| Desativada nega acesso | sessao so carrega ativas | `comAuth`/`/api/usuarios/me` |
| Perfis usam catalogo vivo | associacao aceita somente codigos validos e ativos | rota `PUT/POST /api/perfis` |

## Configuracao

Sem variaveis novas. Depende do schema `permissoes` criado (idempotente) e dos seeds atuais de `perfis` preservados/ajustados pela migracao.
