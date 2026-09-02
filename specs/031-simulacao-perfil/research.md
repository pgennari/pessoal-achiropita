# Research: Simulacao de Perfil e Associaçoes (ADM)

## Alternativas consideradas

### A. Sessao simulada persistida no servidor (tabela `simulacoes`)
O ADM ativaria a simulacao e o backend armazenaria `{ uid, perfil, equipes }`;
`comAuth` consultaria a tabela a cada request.

- **Pro**: vale em outros dispositivos; encerramento centralizado; facil
  revogar em massa.
- **Contra**: nova tabela + migracao; estado implicito por request (o servidor
  precisa resolver a sessao 2x), mais codigo e mais pontos de falha.

### B. Header stateless (escolhida)
O frontend guarda a config no `localStorage` e envia `X-Simulacao-Perfil` /
`X-Simulacao-Equipes` em cada request; `comAuth` valida e aplica so para ADM.

- **Pro**: stateless (casa com Hono + Postgres sem Cloud Functions), sem
  migracao, sem estado extra no servidor; a validacao "eh ADM?" e feita em
  todos os requests (impossivel escalar sem ser ADM).
- **Contra**: simulacao limitada ao navegador onde foi ativada (aceitavel para
  teste manual de permissao); estado corrompido no `localStorage` e tratado
  como `400` — o frontend valida antes de salvar.

### C. Impersonacao total (trocar o `uid` da sessao)
Substituir o executor pela persona simulada.

- **Contra**: confunde auditoria (quem fez?) e as regras de `pessoas.proprio`;
  contraria a decisao de usuario de manter a auditoria creditada ao ADM real.
  Descartada.

## Decisao

Header stateless (B), restrito a ADM, com auditoria creditada ao ADM real e
marca `[simulacao perfil X]` nos detalhes. Impersonacao total e a de tabela no
servidor ficam para evolucoes se surgir necessidade real.