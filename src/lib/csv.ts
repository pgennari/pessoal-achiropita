// ============================================================================
// Exportacao de CSV em Windows-1252 (ANSI) em vez de UTF-8.
// O Blob/TextEncoder so geram UTF-8 nativamente; sem reencodificar, os
// acentos viram mojibake ("AlimentaÃ§Ã£o") ao abrir o CSV no Excel pt-BR,
// que le arquivos .csv como ANSI e ignora o BOM UTF-8. Os arquivos legados
// do projeto ja usam Windows-1252.
// ============================================================================

// Windows-1252 difere do Latin-1 apenas em 0x80-0x9F; mapeamos essas
// excecoes para os caracteres mais comuns de codificacao (aspas, travessoes).
const EXCECOES_WINDOWS_1252: ReadonlyMap<number, number> = new Map([
  [0x20ac, 0x80],
  [0x201a, 0x82],
  [0x0192, 0x83],
  [0x201e, 0x84],
  [0x2026, 0x85],
  [0x2020, 0x86],
  [0x2021, 0x87],
  [0x02c6, 0x88],
  [0x2030, 0x89],
  [0x0160, 0x8a],
  [0x2039, 0x8b],
  [0x0152, 0x8c],
  [0x017d, 0x8e],
  [0x2018, 0x91],
  [0x2019, 0x92],
  [0x201c, 0x93],
  [0x201d, 0x94],
  [0x2022, 0x95],
  [0x2013, 0x96],
  [0x2014, 0x97],
  [0x02dc, 0x98],
  [0x2122, 0x99],
  [0x0161, 0x9a],
  [0x203a, 0x9b],
  [0x0153, 0x9c],
  [0x017e, 0x9e],
  [0x0178, 0x9f],
]);

function codificarWindows1252(texto: string): Uint8Array {
  const saida = new Uint8Array(texto.length);
  let n = 0;
  for (const ch of texto) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp <= 0xff) {
      saida[n++] = cp;
    } else if (EXCECOES_WINDOWS_1252.has(cp)) {
      saida[n++] = EXCECOES_WINDOWS_1252.get(cp)!;
    } else {
      saida[n++] = 0x3f; // "?"
    }
  }
  return saida.subarray(0, n);
}

export function dispararCsv(nome: string, conteudo: string) {
  const blob = new Blob([codificarWindows1252(conteudo)], {
    type: "text/csv;charset=windows-1252",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function escaparCsv(valor: string | number): string {
  const s = String(valor ?? "");
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}