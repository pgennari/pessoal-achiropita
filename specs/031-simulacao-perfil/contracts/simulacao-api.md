# Contrato: Simulacao de Perfil (API)

## Mecanismo — headers de simulacao

Todo request autenticado (rotas com `comAuth`, `Authorization: Bearer <idToken>`)
pode carregar a simulacao:

| Header | Tipo | Descricao |
|--------|------|-----------|
| `X-Simulacao-Perfil` | string | Sigla do perfil simulado (deve existir em `perfis`) |
| `X-Simulacao-Equipes` | string (JSON) | Array de strings com ids de equipes simuladas (opcional) |

O middleware `comAuth`:

1. Carrega a sessao real do usuario (`usuarios` + permissoes ativas do perfil).
2. Se o perfil **real** nao for `ADM`, os headers sao **ignorados** (nunca se
   revela a simulacao).
3. Se o perfil real for `ADM` e houver `X-Simulacao-Perfil`:
   - perfil simulado deve existir em `perfis`; caso contrario `400`.
   - a sessao simulada e montada com: `perfil = sigla`, `permissoes` = somente
     as ativas do perfil simulado, `equipesCRD = equipes simuladas`
     (se header ausente → vazio), `pessoaId = undefined`, `simulando = true`.
   - `X-Simulacao-Equipes` malformado (JSON ou array de strings) → `400`.

Exemplo:

```
POST /api/pessoas HTTP/1.1
Authorization: Bearer <idToken ADM>
X-Simulacao-Perfil: CRD
X-Simulacao-Equipes: ["eq-1","eq-2"]

{ ... }
```

## Endpoints de trilha de auditoria

Servem apenas para registrar inicio/fim da simulacao (o efeito e pelo header).
Usam `comAuthReal` (a simulacao nunca se aplica a estas rotas).

### `POST /api/simulacao/ativar`

Requer perfil real `ADM`.

Request:

```json
{
  "perfil": "CRD",
  "equipesCRD": ["eq-1", "eq-2"]
}
```

`equipesCRD` opcional (array de strings).

- `200 {"ok": true}` — evento `simulacao.ativou` registrado com perfil e nº de
  equipes.
- `403 {"erro": "..."}` — perfil real diferente de ADM.
- `400 {"erro": "Perfil inexistente."}` — sigla fora do catalogo
  `perfis`; `400` tambem para corpo invalido.

### `DELETE /api/simulacao`

Requer perfil real `ADM`.

- `200 {"ok": true}` — evento `simulacao.encerrou` registrado.
- `403 {"erro": "..."}` — perfil real diferente de ADM.

## Auditoria sob simulacao

`registrarEvento` anexa `[simulacao perfil X]` aos `detalhes` de todo evento
registrado enquanto `sessao.simulando === true`. O autor (`uid`/`autorNome`)
continua sendo o ADM real.

## `/api/usuarios/me` sob simulacao

Retorna a sessao corrente: `perfil`, `pessoaId`, `equipesCRD`, `permissoes` e
`simulando` refletem a simulacao quando ativa; sem simulacao, sao os valores
reais (comportamento atual). Campo extra:

```json
{ "simulando": true }
```

## Seguranca

- Simulacao jamais concede acesso que o ADM real nao tenha (ADM e superuser em
  `pode()`; a sessao simulada so herda permissoes ativas do perfil escolhido).
- Nao-ADM ignora headers de simulacao silenciosamente.
- O mecanismo nao possui rota que "ative" estado no servidor; nada e persistido
  no banco.