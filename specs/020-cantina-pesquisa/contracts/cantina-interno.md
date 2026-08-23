# Contrato Interno: Cantina (area logada)

Autenticacao: Firebase ID Token (`comAuth`) + permissao `cantina.gerenciar`
(`temPermissao`; ADM tem acesso implicito). Montado em `api/src/rotas/cantina.ts`.

## Listar pesquisas (lotes de 20)

**`GET /api/cantina/pesquisas?offset=0&limit=20`**

Query params:
- `offset` (opcional, padrao `0`)
- `limit` (opcional, padrao `20`, maximo `20`)

Response 200:
```json
{
  "itens": [
    {
      "id": "string",
      "nome": "string",
      "email": "string | null",
      "telefone": "string | null",
      "diaIda": "YYYY-MM-DD | null",
      "convite": "string | null",
      "desejaInformacoes": true,
      "notas": {
        "atendimento": 5,
        "alimentacao": 4,
        "organizacao": 5,
        "ambiente": 4,
        "voluntarios": 5
      },
      "recomendaria": "Sim",
      "melhorias": "string | null",
      "criadoEm": "ISO timestamp"
    }
  ],
  "total": 45,
  "temMais": true
}
```

Comportamento: ordenacao por `criado_em DESC`; `total` = contagem completa;
`temMais` indica se existe lote seguinte (`offset + limit < total`). O registro
ja carrega todos os campos — o detalhe (FR-011/FR-021) e renderizado no cliente
a partir do item selecionado, sem segunda chamada.

Erros: `403` acesso negado (sem `cantina.gerenciar`).

## Contrato de UI da pagina logada (`/cantina/pesquisas`)

- Secao do link publico: endereco por extenso `${origin}/cantina/pesquisa` +
  acoes Copiar (clipboard + Toast de confirmacao), Abrir (`_blank`) e QR Code
  (SVG inline via lib `qrcode`, padrao `QrEstacionamento.tsx`).
- Listagem abaixo do bloco do link: lote inicial de 20, proximos sob demanda
  (`useInfiniteQuery`), indicador de fim ("Nao ha mais pesquisas") e estado vazio.
- Item selecionado abre o detalhe completo (todos os campos do contrato acima).
- Acesso no menu: nova secao "Cantina", item "Pesquisa", visivel somente com
  `cantina.gerenciar`.
