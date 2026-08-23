# Contrato Publico: Cantina (formulario de satisfacao)

Rotas anonimas, sem Firebase Auth, chamadas via `apiPublica` (`src/lib/api.ts`).
Montado em `api/src/rotas/cantinaPublico.ts` sob `/api/publico/cantina`
(padrao de `checkin`/`presencaPublico`/`avaliacaoPublico`). CORS ja liberado
(`origin: "*"`) no `index.ts`.

## Listar dias de festa da edicao ativa

**`GET /api/publico/cantina/dias-festa`**

Response 200:
```json
{
  "dias": [
    { "id": "string", "data": "YYYY-MM-DD" }
  ]
}
```

Comportamento: retorna apenas `id` e `data` dos dias de festa da edicao com
`status = 'ativa'`, ordenados por data. Exposicao minima (sem nomes ou dados
internos). Lista vazia quando a edicao ativa nao tem dias cadastrados.

## Enviar pesquisa de satisfacao

**`POST /api/publico/cantina/pesquisas`**

Request:
```json
{
  "nome": "string (obrigatorio, trim nao vazio)",
  "email": "string | null (obrigatorio com formato valido se desejaInformacoes = true)",
  "telefone": "string | null",
  "diaIda": "YYYY-MM-DD | null (quando informado, deve ser um dia da edicao ativa)",
  "convite": "string | null",
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
- `diaIda`: ISO date; quando presente deve pertencer aos dias de festa da edicao ativa.

Response 201:
```json
{ "ok": true }
```

Erros:
- `400`: payload invalido — `{ "erro": "<mensagem PT-BR indicando o campo>" }`
- `500`: erro inesperado.

Comportamento: grava um novo registro em `pesquisas_cantina` com `criado_em = now()`
(cada envio cria um registro novo; sem deduplicacao). Registra evento de auditoria
com autor `publico/cantina`. Nao retorna dados de terceiros.

## Contrato de UI da pagina publica (`/cantina/pesquisa`)

- Sem Layout/login; formulario unico em pagina mobile-first (guia visual do projeto).
- Secao de identificacao: Nome completo*, E-mail* (condicional ao opt-in), Telefone,
  Dia da ida a cantina (opcoes do endpoint acima; dia atual pre-selecionado quando
  constar na lista), Numero do convite e pergunta opt-in Sim/Nao.
- Secao de avaliacao: 5 criterios nota 1–5*, recomendacao Sim/Nao/Talvez* e campo
  aberto "O que poderiamos melhorar..." com contador de caracteres.
- Envio bloqueado com mensagens por campo quando obrigatorio pendente; sucesso
  exibe tela de agradecimento (sem reenvio automatico em recarga).
