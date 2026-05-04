/* eslint-disable no-console */
/**
 * STUB para EP-13 — Importação da planilha legada do Excel.
 *
 * O script real deve:
 *  1. Ler a planilha XLSX com `xlsx` (ou similar);
 *  2. Mapear as colunas para o schema Firestore (`pessoas`, `participacoes`, …);
 *  3. Aplicar limpezas: trim, normalização de bairros, padronização de
 *     estado civil, ano de nascimento como inteiro, telefone só dígitos;
 *  4. Detectar duplicatas (nome+nascimento ou crachá) e gerar
 *     `import-report.json` com inconsistências;
 *  5. Subir os documentos via Admin SDK em batch.
 *
 * Uso (esboço):
 *   FIREBASE_PROJECT_ID=achiropita-100 \
 *   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json \
 *   PLANILHA=./dados/festa-99.xlsx \
 *   npx tsx scripts/importar-planilha.ts
 */
console.warn(
  "scripts/importar-planilha.ts ainda não implementado. Veja EP-13 no backlog."
);
process.exit(2);
