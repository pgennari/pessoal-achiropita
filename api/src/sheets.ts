// Acesso a Google Sheets API v4 (somente leitura) com chave de API.
// A planilha precisa estar publica ("qualquer pessoa com o link pode ver").
// A chave fica em GOOGLE_SHEETS_API_KEY (env/Secret Manager no Cloud Run),
// nunca no frontend.

function chaveDeApi(): string {
  const chave = process.env.GOOGLE_SHEETS_API_KEY;
  if (!chave) throw new Error("GOOGLE_SHEETS_API_KEY nao configurada no servidor.");
  return chave;
}

// Aceita a URL completa (https://docs.google.com/spreadsheets/d/ID/...) ou
// somente o ID da planilha.
export function extrairIdPlanilha(entrada: string): string {
  const match = entrada.trim().match(/\/d\/([a-zA-Z0-9\-_]+)/);
  const id = match ? match[1] : entrada.trim();
  if (!id) throw new Error("Informe o ID ou o link da planilha.");
  return id;
}

export interface AbaPlanilha {
  titulo: string;
}

// Lista as abas (tabs) da planilha.
export async function   listarAbas(planilhaId: string): Promise<string[]> {
  const chave = chaveDeApi();
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(planilhaId)}` +
    `?fields=sheets.properties.title&key=${encodeURIComponent(chave)}`;
    console.log("url", url);
  const res = await fetch(url);
  if (!res.ok) throw erroGoogle(res, "nao foi possivel listar as abas da planilha.");
  const dados = (await res.json()) as {
    sheets?: { properties?: { title?: string } }[];
  };
  return (dados.sheets ?? [])
    .map((s) => s.properties?.title ?? "")
    .filter((t) => t.length > 0);
}

// Linhas da planilha: array de arrays (a primeira linha e o cabecalho).
// Sem `aba`, usa a primeira aba da planilha.
export async function obterValores(
  planilhaId: string,
  aba?: string
): Promise<string[][]> {
  const chave = chaveDeApi();
  const intervalo = aba ? `${aba}!A1:ZZZ` : "A1:ZZZ";
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(planilhaId)}` +
    `/values/${encodeURIComponent(intervalo)}?majorDimension=ROWS&key=${encodeURIComponent(chave)}`;
  const res = await fetch(url);
  if (!res.ok) throw erroGoogle(res, "nao foi possivel ler os dados da planilha.");
  const dados = (await res.json()) as { values?: string[][] };
  return dados.values ?? [];
}

async function erroGoogle(res: Response, contexto: string): Promise<Error> {
  const corpo = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
  const motivo = corpo.error?.message ?? `HTTP ${res.status}`;

  if (/must not be an Office file/i.test(motivo)) {
    return new Error(
      "A planilha informada é um arquivo do Office (.xlsx), não uma planilha Google nativa. " +
      "Crie a planilha em Google Planilhas ou converta o arquivo (Arquivo → Salvar como Google Planilhas) e tente novamente."
    );
  }
  if (/not found/i.test(motivo)) {
    return new Error(
      "Planilha não encontrada. Confira o link/ID informado."
    );
  }
  if (/permission|access/i.test(motivo)) {
    return new Error(
      "Sem permissão de leitura. A planilha precisa estar pública " +
      "('Qualquer pessoa com o link → Leitor') ou o link/ID está incorreto."
    );
  }
  return new Error(`Falha ao acessar o Google Sheets: ${contexto}. ${motivo}`);
}
