# Contrato de Integracao: Presenca de Equipistas

## Visao Geral

Contrato HTTP da feature de presenca, cobrindo os endpoints novos da API Hono (`api/src/rotas/presenca.ts` e `api/src/rotas/presencaPublico.ts`). Os endpoints internos exigem autenticacao (Firebase JWT + perfil ADM/ORG); os endpoints publicos sao anonimos, protegidos por JWT curto de sessao de presenca (HS256, `sessaoPresenca.ts`, mesmo mecanismo de `sessaoPublica.ts`).

Convencoes:
- Todas as respostas de erro: `{ "erro": "<mensagem PT-BR>" }` com HTTP status adequado
- Datas: `YYYY-MM-DD` para dia, ISO 8601 (`YYYY-MM-DDTHH:mm:ssZ`) para timestamps
- A rota publica nunca retorna dados de pessoas alem de `nome`/`cracha` do proprio coordenador identificado ou do equipista consultado

## Endpoints Internos (ADM/ORG)

### GET `/api/presenca/links?edicaoId={edicaoId}`

Lista links de presenca de uma edicao.

- **Auth**: `comAuth` (Bearer Firebase ID token). Perfil ADM/ORG.
- **Resposta 200**:
```json
[
  {
    "id": "3f8c...32hex",
    "diaFestaId": "uuid",
    "edicaoId": "uuid",
    "status": "ativo",
    "criadoPorUid": "uid",
    "criadoPorNome": "Nome do ADM",
    "criadoEm": "2026-08-04T12:00:00Z"
  }
]
```
- **Erros**: 401 sem token; 403 perfil sem acesso.

### POST `/api/presenca/links`

Gera o link ativo de presenca de um dia. Se o dia ja possui um link ativo, revoga-o e cria um novo (historico mantido).

- **Auth**: `comAuth` + ADM/ORG.
- **Corpo**:
```json
{ "diaFestaId": "uuid", "edicaoId": "uuid", "token": "3f8c...32hex" }
```
  - `token` gerado no cliente (`gerarToken()` em `src/lib/links.ts`), mesmo padrao de `links_validacao`.
- **Resposta 201**: `LinkPresenca` (mesmo shape do GET).
- **Erros**: 400 dados invalidos / dia nao encontrado; 403 acesso negado.

### PUT `/api/presenca/links/{token}/revogar`

Revoga o link ativo de presenca de um dia (historico mantido). Se o token nao existir ou ja estiver inativo, retorna 404.

- **Auth**: `comAuth` + ADM/ORG.
- **Resposta 200**: `{ "ok": true }`.
- **Erros**: 403 acesso negado; 404 `{ "erro": "Link não encontrado ou já inativo." }`.

## Endpoints Publicos (anonimos)

### GET `/api/publico/presenca/{token}`

Valida o link e retorna o dia correspondente (somente dados do dia, sem equipes/pessoas).

- **Auth**: nenhuma.
- **Resposta 200**:
```json
{
  "status": "ativo",
  "dia": { "id": "uuid", "edicaoId": "uuid", "data": "2026-08-15" }
}
```
  - `status` possiveis: `ativo`, `revogado`, `naoEncontrado`.
- **Erros**: nenhum — sempre 200 com `status` (padrao `publico.ts` GET `/link/:token`).

### POST `/api/publico/presenca/coordenador`

Identifica o coordenador pelo proprio cracha e inicia a sessao de presenca.

- **Auth**: nenhuma.
- **Corpo**: `{ "token": "<token do link>", "cracha": 123 }`
- **Regras**:
  - Link deve existir e estar `ativo`
  - Pessoa deve existir, estar `ativo = true` e ter participacao `funcao = 'Coordenador'` na edicao do dia
  - Cracha inexistente e nao-coordenador retornam a **mesma** mensagem generica (nao confirmar existencia de cracha)
- **Resposta 200**:
```json
{
  "sessaoJwt": "<jwt hs256 1h>",
  "nome": "Fulano Coordenador",
  "cracha": 123
}
```
  - Payload do JWT (`SessaoPresenca`): `pessoaId`, `cracha`, `diaFestaId`, `edicaoId`, `equipeIds: string[]`, `linkToken`.
- **Erros**:
  - 404 `{ "erro": "Link nao encontrado." }`
  - 410 `{ "erro": "Link inativo." }`
  - 403 `{ "erro": "Acesso negado." }` (cracha inexistente ou nao-coordenador)

### POST `/api/publico/presenca/equipista`

Valida o cracha de um equipista da mesma equipe do coordenador.

- **Auth**: `Bearer {sessaoJwt}` (comSessaoPresenca). Link revalidado ativo no banco.
- **Corpo**: `{ "cracha": 456 }`
- **Regras**:
  - Pessoa deve existir e estar ativa
  - Pessoa deve ter participacao em uma das `equipeIds` do coordenador, com funcao `Equipista` ou `Apoio`, na mesma edicao
  - Pessoa nao pode ser o proprio coordenador
  - Se ja existir `presencas` para (dia, pessoa), retorna `jaRegistrado`
- **Resposta 200**:
```json
{
  "status": "ok",
  "pessoa": { "pessoaId": "uuid", "nome": "Equipista Fulana", "cracha": 456 }
}
```
  - `status` possiveis: `ok`, `naoEncontrado`, `naoEquipe`, `jaRegistrado`, `proprioCracha`
  - Nos casos `naoEncontrado`/`naoEquipe`, o campo `pessoa` vem `null` (nao vazar dados)
- **Erros**: 401 sessao invalida/expirada; 410 link inativo.

### POST `/api/publico/presenca/confirmar`

Registra a presenca dos equipistas da lista para o dia.

- **Auth**: `Bearer {sessaoJwt}` (comSessaoPresenca). Link revalidado ativo no banco.
- **Corpo**:
```json
{ "equipistas": [ { "pessoaId": "uuid", "nome": "Equipista Fulana", "cracha": 456 } ] }
```
- **Regras**:
  - Revalida cada item no servidor (participacao na mesma equipe, funcao Equipista/Apoio, nao ja registrado, nao e o coordenador) — a lista do cliente nao e confiavel
  - Insere em transacao: `INSERT INTO presencas ... ON CONFLICT (id) DO NOTHING`
  - Grava para cada registro: dia, edicao, equipe, pessoa (nome/cracha snapshot), coordenador (cracha/nome)
- **Resposta 200**:
```json
{ "registrados": 3, "jaRegistrados": 1, "naoValidados": 0 }
```
- **Erros**: 401 sessao invalida/expirada; 410 link inativo; 400 lista vazia.

## Sessao de Presenca

Mecanismo novo `api/src/sessaoPresenca.ts` que reusa `SignJWT`/`jwtVerify` de `jose` (mesmo segredo `API_SECRET` de `sessaoPublica.ts`):

```
SessaoPresenca {
  pessoaId: string;      // coordenador
  cracha: number;        // cracha do coordenador
  diaFestaId: string;
  edicaoId: string;
  equipeIds: string[];   // equipes do coordenador na edicao
  linkToken: string;
}
```

- TTL: 1h (mesmo de `criarSessaoJwt`)
- Middleware `comSessaoPresenca` valida assinatura, expiracao e revalida o link `ativo` no banco

## Fluxo de Autorizacao

```
Interna (links por dia):   comAuth  → perfil ADM ou ORG  → podeAdministrar()
Publica (fluxo completo):  anonimo  → POST coordenador (JWT) → equipista/confirmar (Bearer JWT + link ativo)
```
