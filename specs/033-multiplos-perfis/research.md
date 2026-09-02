# Research: Multiplos Perfis por Usuario

## Alternativas consideradas

### A) Campo array `usuarios.perfis[]` + uniao de permissoes (escolhida)

- **Como funciona**: usuario tem um array de perfis; a sessao agrega a uniao
  das permissoes ativas de todos os perfis; `perfil` vira so o primario
  (`perfis[0]`).
- **Prós**: simples, uma coluna, sem tabela intermediaria; abrange o caso
  comum (ex.: alguem e ORGANIZACAO e RECEPCAO). Mantem `equipes_crd` global.
- **Contras**: nao diferencia escopo por perfil (quem criou/qual perfil vale
  para cada acao) — aceito porque a guard usa so permissao, nao origem.

### B) Tabela associativa `usuarios_perfis (usuario_id, perfil_sigla)`

- **Prós**: modelo relacional "canonico"; permite carimbar origem por linha.
- **Contras**: mais complexo (join em toda leitura de sessao), sem ganho para
  o requisito atual. Rejeitado por violar o principio de simplicidade (I).

### C) Manter perfil unico, duplicar usuarios iguais

- **Prós**: zero mudanca de schema.
- **Contras**: cria usuarios duplicados (email/pessoa) com login/senha a
  definir; UX ruim. Rejeitado.

## Decisoes

- **A** escolhida. `equipes_crd` continua global ao usuario (a especificacao
  nao pede CRD por perfil). Convites e simulacao permanecem mono-perfil.
- O campo `perfil` e mantido na serializacao como primario (compat) para nao
  quebrar clientes e telas legadas.

## Analogias internas

- Uniao de permissoes lembra o agregado de `perfis.permissoes` do catalogo
  (014-PBAC): reusa `permissoes.ativo` como filtro.
- Convite mono-perfil espelha a regra ja existente de `convites.perfil` (imutavel apos aceite).
