# Importação da planilha legada

Script one-shot para popular o Firestore com a planilha Excel que vinha
sendo usada manualmente. Roda localmente via Admin SDK e bypassa as
Security Rules — não precisa de Cloud Functions nem do plano Blaze.

Cobre as user stories US-13-01 a US-13-04.

## Pré-requisitos

1. `npm install` (já tem `xlsx` e `firebase-admin` no `package.json`).
2. Uma das duas formas de autenticação:
   - **Service account JSON** (mais simples para usar local):
     baixe do Console → IAM & Admin → Service Accounts → chave em JSON.
     ```sh
     export GOOGLE_APPLICATION_CREDENTIALS=./service-account.json
     ```
   - **Application Default Credentials**:
     ```sh
     gcloud auth application-default login
     ```
     (Nesse caso passe `--project=<id>` ou exporte `GOOGLE_CLOUD_PROJECT`.)

> O `service-account.json` **nunca** entra no git. Ele já está coberto
> pelo `.gitignore` do projeto (`*.json` na raiz? confira). Se não
> estiver, adicione antes de baixar a chave.

## Uso

```sh
# 1) Dry-run: lê a planilha, valida tudo, gera relatório, NÃO escreve.
node scripts/importar-planilha.mjs \
  --file=./planilha.xlsx \
  --dry-run

# 2) Run controlado, 50 primeiras linhas, escrevendo de verdade.
node scripts/importar-planilha.mjs \
  --file=./planilha.xlsx \
  --limit=50

# 3) Run completo (~5.871 linhas).
node scripts/importar-planilha.mjs --file=./planilha.xlsx

# 4) Atribuir crachá automático a quem vier sem (não é o default).
node scripts/importar-planilha.mjs --file=./planilha.xlsx --auto-cracha
```

Saída em `scripts/importar-planilha-relatorio.json` com detalhamento
linha a linha: pendências (não importadas), avisos (importadas com
defeitos), e o mapa exato de colunas usado.

## O que é importado

**Pessoa** (`/pessoas`): nome, nascimento, telefones (celular, residencial,
comercial), CPF (validado), RG, e-mail, endereço, bairro, CEP, estado
civil, crachá, observações, nome do cônjuge, estacionamento, recreação,
parente na festa, filhos (até 3) e placa do carro.

**Histórico** (`/participacoesHistoricas`): cada par `BARRACA_NN / FUNÇÃO`
da planilha vira um doc com `pessoaId`, `pessoaNome`, `anoEdicao`,
`barracaNome`, `funcao`. ID determinístico (`${pessoaId}_${ano}`) — re-rodar
não duplica. Cobre 2000 a 2026 (mapa explícito no script).

**Busca por crachá** (`/buscaCracha`): cria entrada para a validação
pública anônima (US-06-06).

**Auditoria** (`/auditoria`): 1 evento `importacao.planilha` com o resumo
do run.

### Não é importado (e por quê)

- Setor da barraca atual (`SETOR`, col C): redundante — deriva da
  `/barracas`, quando a barraca for cadastrada no app.
- Status de formação / atualização 2026 (cols D, E): controle interno
  da planilha, não tem espaço no modelo.
- Avaliação/Apto coordenar / Imp Crachá (cols Z–AD): avaliações de
  ano específico — ficam para EP-09 (formação) quando entrar.
- CRACHÁ (col L) e CAMISETAS (col M): flags de impressão/entrega, não
  são dado da pessoa.
- IDADE (col O): deriva de NASCIMENTO.
- Fotos: planilha não tem. Use "Solicitar foto por e-mail" em
  Pendências → Fotos para coletar depois.

## Idempotência

Roda quantas vezes precisar:

- **Dedupe de Pessoa**: por CPF (prioritário), depois nome+nascimento.
  Quem já existe é contabilizado como `jaExistentes` e **não é alterado**.
- **Dedupe de Histórico**: `id = ${pessoaId}_${ano}`. Sobrescreve o mesmo
  doc — se a barraca de um ano antigo mudou na planilha, o Firestore
  fica com o valor mais recente.

## Quotas (plano Spark)

Para ~5 800 pessoas + ~30 mil participações históricas:

- ~5 800 docs em `/pessoas`
- ~5 800 docs em `/buscaCracha`
- ~30 000 docs em `/participacoesHistoricas`
- 1 doc em `/auditoria`

Total ≈ 42 000 escritas. Spark dá **20 000 escritas/dia**. Opções:

1. Rodar em **dois dias** (executar metade, esperar 24h, executar o
   resto). O `--limit=N` ajuda.
2. Ativar Blaze **só no dia da importação** — a cobrança real fica em
   praticamente zero (US$ 0,18/100k escritas). Voltar para Spark no
   dia seguinte se quiser.

Recomendação: dry-run + ativar Blaze por 1 dia para a migração + voltar
para Spark. Mais simples que partir.

## Verificação pós-run

1. Abrir `scripts/importar-planilha-relatorio.json` e revisar `pendencias`
   e `avisos`.
2. Firebase Console → Firestore → conferir 5 docs aleatórios em
   `/pessoas`. Bater os campos com a planilha.
3. `npm run dev`, logar como ADM, abrir `/pessoas`. Os filtros e busca
   devem funcionar.
4. `/historico` (US-12-01) lista as participações antigas? Se sim,
   o histórico vertical está OK.
5. Re-rodar o script: `importados=0`, `jaExistentes=<total>` → idempotente.

## Reverter (emergência)

Se algo deu muito errado e o run é recente:

```sh
# Listar pessoas criadas pelo script (não tem flag explícita, mas
# pessoas importadas ainda não foram alteradas via app — criadoEm
# bate com o horário do run).
# Exclusão em massa via Firebase Console → Firestore → coleção →
# selecionar → "Delete documents".
```

Para uma reversão menos manual, use a página `/zeramento` do app
(US-12-02), que apaga tudo de uma edição. Para apagar `/pessoas` e
`/participacoesHistoricas` há helpers em `src/lib/zeramento.ts`.
