# Spec: Multiplos Perfis por Usuario

**Feature Branch**: `033-multiplos-perfis` | **Data**: 2026-09-01

**Input**: User description: "Um usuario deve poder ter mais de um perfil de
acesso associado, recebendo a uniao das permissoes de todos os perfis."

## Resumo

Um usuario passa a ter **N perfis associados**. A autorizacao (backend e
frontend) usa a **uniao das permissoes ativas de todos os perfis** do usuario.
O campo `usuarios.perfil` (unico) e substituido por `usuarios.perfis`
(`TEXT[]`); `perfil` vira apenas o **perfil primario** (primeiro elemento)
para compatibilidade de leitura/display. O tipo enum `perfil_usuario` e
**abolido** — o banco aceita **qualquer sigla** de perfil (o catalogo de
perfis e dinamico na tabela `perfis`).

As associacoes de equipes CRD continuam **globais ao usuario** (`equipes_crd`
inalterado). Convites (`convites.perfil`) permanecem **mono-perfil**: um
convite continua concedendo exatamente um perfil; quem aceita um convite tem
um unico `perfis = [convite.perfil]` ate que um ADM edite.

## Decisoes

- **Modelo de autorizacao**: uniao das permissoes ativas de todos os perfis.
- **CRD equipes**: global ao usuario (campo unico `equipes_crd`); a regra
  "precisa de pelo menos 1 equipe" vale se o perfil **CRD** estiver entre os
  `perfis` selecionados.
- **Compatibilidade**: `perfil` continua existindo como primario
  (`perfis[0]`), tanto no banco quanto na serializacao da API, para nao
  quebrar clientes/UI legadas. Backend e frontend aceitam uma sessao
  sem `perfis` (fallback para `[perfil]`).
- **ADM superuser**: trata-se como ADM se **qualquer** perfil for `ADM`
  (helper `ehADM`).
- **Simulacao**: continua mono-perfil (simula um unico perfil).

## Perguntas e respostas

- Q: E se os perfis tiverem permissoes conflitantes? → A: Nao ha conflito de
  "desliga": a uniao apenas concede o que qualquer um dos perfis autoriza.
- Q: Um usuario pode ter ADM + outro perfil? → A: Sim; sera tratado como ADM
  (superuser). A UI de simulacao nao oferece simular se o usuario so tiver ADM.
- Q: Como fica o CRD sem equipes? → A: Se `CRD` estiver marcado, exige-se ao
  menos uma `equipes_crd` (regra de validacao do form e do PUT).
- Q: E um convite concedendo CRD? → A: Convite continua mono-perfil; a
  validacao de CRD+equipe continua valida no convite.

## Roteiro de implementacao

### US-01 — Gerenciar multiplos perfis (P1)

O ADM/ORG, na pagina Usuarios, ve e edita a **lista de perfis** de cada
usuario (badges multiplos; multi-selecao no form). O usuario recebe a uniao
das permissoes de todos os perfis selecionados e o menu/autorizacao refletem
essa uniao em toda a aplicacao.

**Historias (Given/When/Then)**

1. **Given** um usuario com perfis `ORG` e `REC`, **When** ele loga, **Then**
   a uniao das permissoes de `ORG` e `REC` fica ativa em toda a sessao.
2. **Given** um usuario com `ADM` entre os perfis, **When** ele loga, **Then**
   e tratado como superuser (ADM).
3. **Given** a pagina Usuarios, **When** o ADM edita um usuario, **Then** a
   tela mostra a multi-selecao de perfis com checkboxes e salva
   `perfis` como array.
4. **Given** a pagina Usuarios, **When** o ADM marca `CRD` sem escolher
   equipe, **Then** a validacao impede o salvamento exibindo o erro de
   CRD-sem-equipe.
5. **Given** um convite aceito, **When** o usuario e criado, **Then** seu
   `perfis` inicial e `[perfil_do_convite]`.

**Criterios de aceite (FR)**

- FR-001: A sessao carrega a uniao das permissoes ativas de todos os perfis.
- FR-002: `perfil` (primario) e `perfis` (array) sao retornados na
  serializacao de usuario e em `/api/usuarios/me`.
- FR-003: `ehADM` considera true se qualquer perfil for `ADM`.
- FR-004: A validacao do form exige >= 1 perfil valido e exige >= 1 equipe
  quando `CRD` esta selecionado.
- FR-005: Convites permanecem mono-perfil; aceite cria `perfis = [convite.perfil]`.
- FR-006: Simulacao permanece mono-perfil.
- FR-007: A exclusao de um perfil do catalogo e bloqueada se algum usuario o
  utiliza (verificacao por assinatura no array `perfis`).

**Criterios de usabilidade (SC)**

- SC-001: Os perfis de um usuario sao visiveis de uma olhada (badges).
- SC-002: A multi-selecao usa checkboxes com sigla + nome, em ate 2 cliques
  por perfil.

## Fora de escopo

- Perfil CRD com equipes por perfil (mantido global).
- Permissoes "negativas" (desligar uma permissao da uniao).
- Alocar perfis diferentes para escopos diferentes (ex.: quem criou a pessoa).

## Data Model

Ver [data-model.md](./data-model.md); migracao SQL em
[migration.sql](./migration.sql).
