# Contrato Publico: Cantina (formulario de satisfacao) — v2

**Feature**: [spec.md](../spec.md) | **Data**: 2026-08-28

Substitui o contrato de [020-cantina-pesquisa](../020-cantina-pesquisa/contracts/cantina-publico.md)
para o fluxo publico atual. Rotas anonimas, sem Firebase Auth, montadas em
`api/src/rotas/cantinaPublico.ts` sob `/api/publico/cantina`, chamadas via
`apiPublica` (`src/lib/api.ts`).

## Removido nesta versao

- **`GET /api/publico/cantina/dias-festa`** — removido. Nao existe mais
  consumidor publico para a agenda de dias de festa (o select "Dia da ida"
  saiu do formulario). A tabela `dias_festa` continua existindo para os demais
  fluxos (presenca/formacoes).

## Enviar pesquisa de satisfacao

**`POST /api/publico/cantina/pesquisas`**

Request:
```json
{
  "nome": "string (obrigatorio, trim nao vazio)",
  "email": "string | null (obrigatorio com formato valido se desejaInformacoes = true)",
  "telefone": "string | null",
  "desejaInformacoes": false,
  "notas": {
    "atendimento": 5,
    "alimentacao": 4,
    "organizacao": 5,
    "ambiente": 4,
    "voluntarios": 5
  },
  "recomendaria": "Sim",
  "melhorias": "string | null (maximo 4000 caracteres)"
}
```

Regras de validacao (zod, no servidor — espelham a UI):
- `nome`: obrigatorio.
- `email`: obrigatorio e formato valido **somente** quando `desejaInformacoes = true`; caso contrario opcional/`null`.
- `notas`: as 5 chaves presentes, inteiros entre 1 e 5.
- `recomendaria`: `"Sim" | "Nao" | "Talvez"` (obrigatorio).
- `melhorias`: opcional, maximo 4000 caracteres.
- Sem `diaIda` e sem `convite`. Chaves desconhecidas enviadas por clientes
  antigos em cache sao ignoradas (schema nao estrito) e nao rejeitam o envio.

Response 201:
```json
{ "ok": true }
```

Erros:
- `400`: payload invalido — `{ "erro": "<mensagem PT-BR indicando o campo>" }`
- `500`: erro inesperado.

Comportamento: grava uma nova linha em `pesquisas_cantina` com `criado_em =
now()` e com `dia_ida`/`convite` nulos (colunas preservadas para o historico).
Cada envio cria um registro novo (sem deduplicacao). Registra evento de
auditoria com autor `publico/cantina`. Nao retorna dados de terceiros.

## Contrato de UI da pagina publica (`/cantina/pesquisa`)

- Sem Layout/login; formulario unico em pagina mobile-first (guia visual do projeto).
- Secao de identificacao ("Sobre voce"): Nome completo*, E-mail* (condicional
  ao opt-in), Telefone e pergunta opt-in "Deseja receber informacoes sobre a
  Festa de Nossa Senhora Achiropita?" (Sim/Nao). **Sem** "Dia da ida" e **sem**
  "Numero do convite".
- Secao de avaliacao: 5 criterios nota 1-5*, recomendacao Sim/Nao/Talvez* e
  campo aberto "O que poderiamos melhorar..." com contador de caracteres.
- O carregamento da pagina nao faz nenhuma requisicao previa de agenda; o
  formulario abre direto, sem selecao de dia pre-preenchida.
- Envio bloqueado com mensagens por campo quando obrigatorio pendente; sucesso
  exibe tela de agradecimento (sem reenvio automatico em recarga).