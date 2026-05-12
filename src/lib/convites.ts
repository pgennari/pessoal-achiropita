import {
  Timestamp,
  collection,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  updateDoc,
  getDocs,
  where,
  query,
} from "firebase/firestore";
import { db } from "./firebase";
import { Convite, Perfil, StatusConvite } from "./tipos";
import { Sessao } from "./sessao";
import { registrarEvento } from "./auditoria";

const COL = "convites";

export interface DadosCriarConvite {
  email: string;
  perfil: Perfil;
  barracasCRD?: string[];
}

export function gerarToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function conviteDeSnap(
  token: string,
  data: Record<string, unknown>
): Convite {
  const c = data.criadoEm as Timestamp | string | null | undefined;
  const e = data.expiraEm as Timestamp | string | null | undefined;
  return {
    token,
    email: (data.email as string) ?? "",
    perfil: (data.perfil as Perfil) ?? "EQP",
    barracasCRD: Array.isArray(data.barracasCRD)
      ? (data.barracasCRD as string[])
      : undefined,
    status: (data.status as StatusConvite) ?? "pendente",
    criadoEm:
      c instanceof Timestamp ? c.toDate().toISOString() : (c as string) || "",
    expiraEm:
      e instanceof Timestamp ? e.toDate().toISOString() : (e as string) || "",
    criadoPorUid: (data.criadoPorUid as string) ?? "",
    criadoPorNome: (data.criadoPorNome as string) ?? "",
    aceitoPorUid: (data.aceitoPorUid as string) || undefined,
  };
}

function em7Dias(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d;
}

export async function criarConvite(
  sessao: Sessao,
  dados: DadosCriarConvite
): Promise<string> {
  const email = dados.email.trim().toLowerCase();
  const token = gerarToken();
  const agora = serverTimestamp();
  const expira = Timestamp.fromDate(em7Dias());

  // Verifica se ja existe convite pendente para este email
  const pendentes = await getDocs(
    query(
      collection(db(), COL),
      where("email", "==", email),
      where("status", "==", "pendente")
    )
  );
  if (!pendentes.empty) {
    throw new Error(
      "Ja existe um convite pendente para este e-mail."
    );
  }

  await setDoc(doc(db(), COL, token), {
    email,
    perfil: dados.perfil,
    barracasCRD:
      dados.perfil === "CRD" && dados.barracasCRD
        ? dados.barracasCRD
        : null,
    status: "pendente",
    criadoEm: agora,
    expiraEm: expira,
    criadoPorUid: sessao.uid,
    criadoPorNome: sessao.nome,
    aceitoPorUid: null,
  });

  await registrarEvento(
    sessao,
    "convite.criou",
    `convites/${token}`,
    `${email} (${dados.perfil})`
  );

  return token;
}

function conviteExpirado(c: Convite): boolean {
  return new Date(c.expiraEm) < new Date();
}

export async function aceitarConvite(
  token: string,
  sessao: Sessao
): Promise<void> {
  const ref = doc(db(), COL, token);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Convite nao encontrado.");
  const convite = conviteDeSnap(snap.id, snap.data() as Record<string, unknown>);

  if (convite.status !== "pendente") {
    throw new Error("Este convite ja foi utilizado ou expirou.");
  }
  if (conviteExpirado(convite)) {
    throw new Error("Este convite expirou.");
  }
  if (convite.email !== sessao.email.toLowerCase()) {
    throw new Error(
      "Este convite e para outro endereco de e-mail."
    );
  }

  // Atualiza o doc do usuario com o perfil do convite.
  // Inclui conviteToken para as Security Rules validarem a operacao.
  const userRef = doc(db(), "usuarios", sessao.uid);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) {
    throw new Error("Usuario nao encontrado. Faca login primeiro.");
  }
  await updateDoc(userRef, {
    perfil: convite.perfil,
    barracasCRD: convite.barracasCRD ?? null,
    atualizadoEm: serverTimestamp(),
    conviteToken: token,
  });

  // Marca convite como aceito
  await updateDoc(ref, {
    status: "aceito",
    aceitoPorUid: sessao.uid,
  });

  await registrarEvento(
    sessao,
    "convite.aceitou",
    `convites/${token}`,
    `${convite.email} -> ${convite.perfil}`
  );
}
