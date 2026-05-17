# Análise do Sistema vs User Stories

> Data: 17/05/2026  
> Branch analisada: `claude/system-analysis-report-B1Iu1`  
> Base de referência: `user-stories-festa-100.md` (última atualização: 03/05/2026)

---

## Sumário executivo

O sistema cobre **aproximadamente 75% das user stories do MVP**. As áreas de autenticação, cadastro de pessoas, alocação em barracas e o fluxo crítico de validação pública (`/v/:token`) estão implementadas e operacionais. Os 25% restantes do MVP se concentram em busca global, importação da planilha legada (EP-13) e alguns critérios de aceite pontuais de US já parcialmente entregues.

---

## 1. Implementado de forma diferente do especificado

Funcionalidades entregues, mas com comportamento ou escopo divergente dos critérios de aceite.

| US | O que a spec diz | O que está implementado | Risco |
|----|---|---|---|
| **US-01-01** | Sessão persistente por **30 dias** com checkbox "Manter conectado" | Firebase Auth com persistência padrão (IndexedDB sem prazo explícito); sem checkbox na tela de login | Baixo — funciona, mas não atende o critério literalmente |
| **US-01-01** | Bloqueio após 5 tentativas falhas em 10 min | Implementado via **localStorage** — contornável limpando o cache ou trocando de navegador | Médio — proteção real exige server-side (ex.: Cloud Function ou regra do Firebase App Check) |
| **US-01-03** | Senha nova exige ≥8 chars com letra e número (validação na UI) | Delegado ao Firebase Auth sem validação na própria interface do app | Baixo — Firebase já garante o mínimo, mas a mensagem de erro não é em PT-BR contextualizada |
| **US-02-01** | CPF é **obrigatório** (listado como campo obrigatório) | CPF declarado como **opcional** (`cpf?`) no tipo `Pessoa` e no formulário de cadastro | **Alto** — divergência de dado mestre; afeta auditoria, deduplicação e futura importação |
| **US-02-05** | Busca global com atalho `⌘K` / `Ctrl+K` presente em **todas as telas** | Componente `BuscaGlobal` existe mas não está integrado ao `Layout`; atalho de teclado não implementado | Médio — feature está na spec como Alta/MVP |
| **US-05-01** | Ao criar edição, **oferece copiar** barracas e estrutura da edição anterior | Edição é sempre criada vazia; não há opção de cópia | Médio — impacto na produtividade do ORG na abertura da edição 100 |
| **US-05-05** | Painel de vagas com semáforo: vermelho <60%, amarelo 60–90%, verde >90% | Painel exibe percentuais mas a coloração semântica por faixa não foi confirmada no código | Baixo — visual, mas importante para operação |
| **US-10-01** | Card de KPI **"% dados validados"** listado explicitamente | Dashboard tem 5 cards (pessoas ativas, vagas, formação, crachás, sem foto); "% dados validados" ausente como card separado | Médio — indicador operacional relevante para cobrar a equipe |
| **US-06-04** | Botão **"Notificar todos"** envia push e e-mail para pendências | Não implementado | Médio — dependência de v2, mas está marcado como MVP na spec |
| **US-06-04** | Botão **"Gerar link individual de validação"** para quem fez formação manual e não validou dados | Não implementado | Médio — marcado como MVP |
| **US-07-04** | Botão **"Solicitar foto por e-mail"** com link de expiração | Página de pendências existe mas sem ação de solicitação por e-mail | Baixo — US marcada como Alta/MVP |

---

## 2. Funcionalidades implementadas sem cobertura nos User Stories

Código que existe e funciona, mas não tem US correspondente descrevendo seus requisitos, critérios de aceite ou motivação de negócio.

### 2.1 Registro de veículos (`carros[]`)
O modelo `Pessoa` possui um array `carros[]` e o formulário de cadastro permite adicionar/remover veículos. Nenhuma US descreve esse campo, para que ele serve operacionalmente, quem pode editar, ou como ele aparece em relatórios. Se não for usado, polui o formulário.

**Ação sugerida:** Criar US no EP-02 ou EP-03 descrevendo a finalidade (controle de credenciais de acesso ao estacionamento? entrada de veículos na área interna?) e critérios de aceite; ou remover se não for necessário para a festa 100.

### 2.2 Exclusão permanente de pessoa (ADM)
O sistema permite que ADM exclua fisicamente uma pessoa — remove foto do Storage, limpa `/buscaCracha` e registra em auditoria. US-02-04 descreve apenas **inativação** (soft delete), sem mencionar exclusão física. Não há US que autorize essa operação nem defina em quais condições ela é permitida (ex.: pessoa nunca participou de edição alguma?).

**Ação sugerida:** Criar US ou critério de aceite em US-02-04 descrevendo quando a exclusão é permitida e quais dados são preservados no log de auditoria.

### 2.3 Rota `/v-qr/:token` — página de projeção do QR
Rota dedicada à exibição do QR code em tela cheia para projeção em sala de formação. US-06-05 menciona "QR Code exibido na lista de turmas para projeção" mas não especifica uma rota separada, requisitos de UI (fullscreen, contraste, logo), ou como acessar.

**Ação sugerida:** Adicionar critério de aceite em US-06-05 descrevendo a página de projeção.

### 2.4 Botão "Recriar lookup" (`sincronizarTodosOsCrachas`)
Operação de ADM que percorre todos os documentos `/pessoas` e reconstrói a coleção `/buscaCracha`. Não há US descrevendo quando usar, o que acontece durante a execução (bloqueio da UI?), ou o que fazer se falhar parcialmente.

**Ação sugerida:** Criar critério de aceite em US-12-01 ou nova US em EP-12 documentando essa operação de manutenção.

### 2.5 Confirmação de dados pelo OPC/ADM (`dadosValidados`)
Além da auto-validação via link público (US-06-06), OPC e ADM podem marcar `dadosValidados=true` manualmente numa tela de formação. Não está descrito em nenhuma US — é diferente de US-06-02 (presença manual) e de US-06-06 (validação via link).

**Ação sugerida:** Adicionar critério de aceite em US-06-04 descrevendo quem pode confirmar dados e em que fluxo.

### 2.6 Migração via script Node.js (`seed-fixture.mjs`)
EP-13 descreve um **wizard com UI** (pré-visualização, mapeamento de colunas, relatório de qualidade). O que existe é um script executado diretamente no terminal, sem interface, sem pré-visualização linha a linha e sem relatório estruturado.

**Ação sugerida:** Alinhar com o usuário: manter o script como solução definitiva (e atualizar US-13 para refletir isso) ou construir o wizard conforme especificado.

---

## 3. O que ainda falta desenvolver

### 3.1 MVP — deve estar pronto antes da operação em campo

| US | Feature | Status atual |
|----|---|---|
| **US-01-06** | Aba "Convites" separada de "Usuários" com filtros (e-mail, perfil, status), links copiáveis e tabela com datas | Parcialmente entregue; critérios de aceite não totalmente verificados |
| **US-02-01** | CPF obrigatório no cadastro (alinhamento do tipo `Pessoa` e validação no formulário) | Divergência ativa — campo é opcional no código |
| **US-02-05** | Busca global integrada ao Layout com atalho `⌘K`/`Ctrl+K`, resultado com foto/nome/crachá/barraca, limite 20 resultados | Componente existe isolado; integração e atalho pendentes |
| **US-05-01** | "Copiar barracas e estrutura da edição anterior" no fluxo de criação de nova edição | Não iniciado |
| **US-05-04** | Mover pessoa entre barracas com auditoria e notificação ao CRD da barraca de origem | Não iniciado |
| **US-05-05** | Semáforo de preenchimento: vermelho <60%, amarelo 60–90%, verde >90% | Não confirmado no código atual |
| **US-06-04** | Botão "Gerar link individual de validação" para pessoas com dados não validados | Não iniciado |
| **US-06-04** | Botão "Notificar todos" (push + e-mail) nas listas de pendências | Não iniciado (depende de EP-09) |
| **US-07-04** | Botão "Solicitar foto por e-mail" com link de expiração na lista de pendências | Não iniciado |
| **US-10-01** | Card KPI "% dados validados" no Painel principal | Ausente |
| **US-13-01** | Wizard de importação XLSX com pré-visualização linha a linha | Apenas script seed; UI não iniciada |
| **US-13-02** | Limpeza automática na importação (trim, normalização de estado civil, datas numéricas, bairros) | Não verificado no script atual |
| **US-13-03** | Migração do histórico horizontal (colunas Barraca_74…Barraca_99) para `/participacoes` vertical | Não verificado no script atual |
| **US-13-04** | Relatório de qualidade da migração (CPFs inválidos, duplicatas, campos pendentes) | Não iniciado |

### 3.2 v2 — pós-lançamento, antes da festa (agosto–outubro 2026)

| US | Feature |
|----|---|
| US-02-06 | Detectar e mesclar duplicatas (fila de revisão, merge preservando crachá mais antigo, reversível por 7 dias) |
| US-02-07 | Histórico de alterações por pessoa campo a campo, exportável em CSV |
| US-03-02 | Vincular cônjuges entre cadastros (vínculo bidirecional) |
| US-03-03 | Sinalizar parente também equipista |
| US-04-02 | Filtros combinados no histórico (barraca, função, edições mínimas, faixa etária) + exportação CSV |
| US-04-03 | Sugestão automática de candidatos a coordenador (≥3 edições como equipista, ≥21 anos) |
| US-05-06 | Importar escala da edição anterior como rascunho, excluindo inativos |
| US-05-07 | Bloquear alocação de pessoa não-formada após data X configurável |
| US-07-03 | Marcar entrega de camiseta com tamanho (PP–EG), painel por tamanho |
| US-09-01 | E-mail por segmento via SendGrid (Firebase Extension), com templates e variáveis |
| US-09-03 | Botão "Abrir WhatsApp" no perfil da pessoa (`wa.me`) |
| US-10-02 | Gráficos de distribuição demográfica (idade, estado civil, bairro) |
| US-10-03 | Análise de retenção por coorte entre edições |
| US-11-01 | Lista de crianças com flag "frequenta Recreação", total por faixa etária |
| US-11-02 | Check-in/check-out de criança com identificação do responsável e autorização alternativa |
| US-11-03 | Painel ao vivo da Recreação (contador de crianças presentes) |
| US-12-03 | Filtros completos na auditoria (por usuário, módulo, período) — atualmente parcial |
| US-12-04 | Exportação manual de backup em JSON e CSV sob demanda |
| US-12-05 | Painel de links públicos ativos com revogação individual e em massa, filtros por status/criador |

### 3.3 v3 — otimizações futuras

| US | Feature |
|----|---|
| US-01-05 | Encerrar sessões ativas em outros dispositivos |
| US-09-02 | Push notification via FCM com tópicos por barraca/setor |

---

## Apêndice — Cobertura por épico

| Épico | Total de US | MVP implementado | MVP pendente | v2/v3 |
|---|:---:|:---:|:---:|:---:|
| EP-01 Autenticação | 6 | 4 | 1 (US-01-06 parcial) | 1 |
| EP-02 Cadastro | 7 | 4 | 2 (US-02-01 divergente, US-02-05 parcial) | 2 |
| EP-03 Família | 3 | 1 | — | 2 |
| EP-04 Histórico | 3 | 1 | 1 (US-04-02) | 1 |
| EP-05 Edição & Alocação | 7 | 3 | 3 (US-05-01 parcial, US-05-04, US-05-05) | 2 |
| EP-06 Formação | 5 | 3 | 2 (US-06-04 parcial) | — |
| EP-07 Entregas | 3 | 2 | 1 (US-07-04 parcial) | 1 |
| EP-09 Comunicação | 3 | — | 1 (US-09-01 dependência de US-06-04) | 2 |
| EP-10 Dashboards | 3 | 1 | — (US-10-01 com gap de KPI) | 2 |
| EP-11 Recreação | 3 | — | — | 3 |
| EP-12 Admin | 5 | 2 | — | 3 |
| EP-13 Migração | 4 | — | 4 | — |
| **Total** | **56** | **~21** | **~15** | **~20** |
