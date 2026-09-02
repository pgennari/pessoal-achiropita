# Data Model: Multiplos Perfis por Usuario

## Mudanca de schema

A coluna `usuarios.perfil` (unico) e substituida por `usuarios.perfis`
(`TEXT[]`). O tipo enum `perfil_usuario` e **abolido**: o banco aceita
**qualquer sigla** de perfil (o catalogo de perfis e dinamico, na tabela
`perfis`; o enum fixo nao e mais a fonte da verdade).

```sql
-- antes
perfil perfil_usuario NOT NULL

-- depois
perfis TEXT[] NOT NULL DEFAULT ARRAY['EQP']
```

`perfil` deixa de existir como coluna. A API continua expondo `perfil` como o
**perfil primario** (`perfis[0]`) para compat de leitura/display, mas a fonte
da verdade e `perfis`.

`equipes_crd` permanece **global ao usuario** (inalterado).

`convites.perfil` tambem vira `TEXT` (mono-perfil, mas aceita qualquer sigla:
um convite concede exatamente um perfil).

## Permissoes

A autorizacao usa a **uniao das permissoes ativas de todos os perfis** do
usuario. No backend, ao carregar a sessao real, os permissoes ativas sao
agregadas por:

```sql
SELECT ... pm.codigo
FROM permissoes pm
JOIN perfis p ON p.sigla = ANY(u.perfis)
WHERE ... AND p.sigla = ANY(u.perfis)
```

Nao ha nova tabela. A tabela `perfis` (catalogo, `sigla` + `permissoes[]`)
permanece a fonte das permissoes.

## Tipos TypeScript

- `Sessao` (backend `api/src/tipos.ts` e frontend `src/lib/sessao.ts`) ganham
  `perfis: string[]`; `perfil` permanece como primario.
- `Usuario` (frontend `src/lib/tipos.ts`): `perfis: Perfil[]` + `perfil`
  (primario, compat).
- `DadosUsuarioForm` (frontend `src/lib/usuarios.ts`): `perfis: Perfil[]`.

## Compatibilidade

Backend e frontend tratam uma sessao **sem** `perfis` como
`[perfil]` (fallback), preservando clientes legados.

## Auditoria

Nenhuma acao nova; o PUT de usuario reutiliza `usuario.atualizou` com
detalhes `nome (A, B, C)`.
