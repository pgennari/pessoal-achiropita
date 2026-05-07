import { Pessoa } from "./tipos";

export function nowIso(): string {
  return new Date().toISOString();
}

export function uid(prefixo = "id"): string {
  return `${prefixo}_${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function formatarData(iso: string | undefined | null): string {
  if (!iso) return "—";
  const data = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (isNaN(data.getTime())) return "—";
  return data.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function calcularIdade(nascimento: string | undefined): number | null {
  if (!nascimento) return null;
  const data = new Date(`${nascimento}T00:00:00`);
  if (isNaN(data.getTime())) return null;
  const hoje = new Date();
  let idade = hoje.getFullYear() - data.getFullYear();
  const mes = hoje.getMonth() - data.getMonth();
  if (mes < 0 || (mes === 0 && hoje.getDate() < data.getDate())) idade--;
  return idade;
}

export function soDigitos(texto: string | undefined | null): string {
  return (texto || "").replace(/\D+/g, "");
}

export function formatarCPF(cpf: string): string {
  const d = soDigitos(cpf);
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

// Algoritmo dos dígitos verificadores. Rejeita sequências repetidas.
export function validarCPF(cpf: string): boolean {
  const d = soDigitos(cpf);
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false;

  const digitos = d.split("").map(Number);

  const calcDigito = (parcial: number[], pesoInicial: number): number => {
    let soma = 0;
    for (let i = 0; i < parcial.length; i++) {
      soma += parcial[i] * (pesoInicial - i);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  const dv1 = calcDigito(digitos.slice(0, 9), 10);
  if (dv1 !== digitos[9]) return false;
  const dv2 = calcDigito(digitos.slice(0, 10), 11);
  if (dv2 !== digitos[10]) return false;
  return true;
}

export function proximoCracha(pessoas: Pick<Pessoa, "cracha">[]): number {
  const usados = new Set<number>();
  for (const p of pessoas) {
    if (typeof p.cracha === "number" && p.cracha > 0) usados.add(p.cracha);
  }
  let n = 1;
  while (usados.has(n)) n++;
  return n;
}

// Busca a melhor coincidência client-side.
export function ehDuplicataPorNomeNascimento(
  pessoas: Pessoa[],
  nome: string,
  nascimento: string,
  excetoId?: string
): Pessoa | null {
  const n = normalizar(nome);
  return (
    pessoas.find(
      (p) =>
        p.id !== excetoId &&
        normalizar(p.nome) === n &&
        p.nascimento === nascimento
    ) || null
  );
}

export function ehDuplicataPorCpf(
  pessoas: Pessoa[],
  cpf: string,
  excetoId?: string
): Pessoa | null {
  const d = soDigitos(cpf);
  if (!d) return null;
  return (
    pessoas.find((p) => p.id !== excetoId && soDigitos(p.cpf) === d) || null
  );
}

// Redimensiona uma imagem para um quadrado JPEG com crop centralizado.
// Usado antes do upload (US-02-03).
export async function redimensionarParaJpeg(
  arquivo: Blob,
  lado = 600,
  qualidade = 0.85
): Promise<Blob> {
  let entrada: Blob = arquivo;

  // HEIC: lazy import só quando o formato exige.
  const tipo = (arquivo as File).type || "";
  const ehHeic =
    tipo === "image/heic" ||
    tipo === "image/heif" ||
    /\.heic$|\.heif$/i.test((arquivo as File).name || "");
  if (ehHeic) {
    const { default: heic2any } = await import("heic2any");
    const convertido = await heic2any({
      blob: arquivo,
      toType: "image/jpeg",
      quality: 0.92,
    });
    entrada = Array.isArray(convertido) ? convertido[0] : convertido;
  }

  const url = URL.createObjectURL(entrada);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Falha ao decodificar imagem."));
      i.src = url;
    });

    const canvas = document.createElement("canvas");
    canvas.width = lado;
    canvas.height = lado;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas não disponível.");
    const min = Math.min(img.width, img.height);
    const sx = (img.width - min) / 2;
    const sy = (img.height - min) / 2;
    ctx.drawImage(img, sx, sy, min, min, 0, 0, lado, lado);

    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) =>
          b ? resolve(b) : reject(new Error("Falha ao gerar JPEG.")),
        "image/jpeg",
        qualidade
      )
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
