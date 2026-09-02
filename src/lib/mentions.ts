// Mencoes de pessoas no resumo: o texto salvo guarda um token por pessoa
// marcada no formato `@@[Nome](pessoaId)`. Na edicao o token aparece como um
// "chip"; na visualizacao vira um link que abre o sidesheet da pessoa.

export interface Mencao {
  pessoaId: string;
  nome: string;
  inicio: number;
  fim: number;
}

// Formato: @@[Nome](pessoaId). Nomes PT-BR nao contem `]`, `(`, `)` — seguros
// como delimitadores.
const TOKEN_RE = /@@\[([^\]]+)\]\(([a-zA-Z0-9-]+)\)/g;

export function montarToken(nome: string, pessoaId: string): string {
  return `@@[${nome}](${pessoaId})`;
}

export function extrairMencoes(texto: string): Mencao[] {
  const mencoes: Mencao[] = [];
  TOKEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TOKEN_RE.exec(texto)) !== null) {
    mencoes.push({
      pessoaId: m[2],
      nome: m[1],
      inicio: m.index,
      fim: m.index + m[0].length,
    });
  }
  return mencoes;
}

// Converte o texto salvo em segmentos alternados de texto puro e mencoes,
// para renderizar chips na edicao e links na visualizacao.
export interface Segmento {
  tipo: "texto" | "mencao";
  valor: string;
  pessoaId?: string;
  nome?: string;
}

export function segmentarMencoes(texto: string): Segmento[] {
  const mencoes = extrairMencoes(texto);
  if (mencoes.length === 0) return [{ tipo: "texto", valor: texto }];
  const segmentos: Segmento[] = [];
  let ponteiro = 0;
  for (const m of mencoes) {
    if (m.inicio > ponteiro) {
      segmentos.push({
        tipo: "texto",
        valor: texto.slice(ponteiro, m.inicio),
      });
    }
    segmentos.push({
      tipo: "mencao",
      valor: texto.slice(m.inicio, m.fim),
      pessoaId: m.pessoaId,
      nome: m.nome,
    });
    ponteiro = m.fim;
  }
  if (ponteiro < texto.length) {
    segmentos.push({ tipo: "texto", valor: texto.slice(ponteiro) });
  }
  return segmentos;
}
