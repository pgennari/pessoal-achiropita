import { randomBytes } from "crypto";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { defineString } from "firebase-functions/params";
import { logger } from "firebase-functions/v2";
import { HttpsError, onCall } from "firebase-functions/v2/https";

const REGION = "southamerica-east1";

const APP_URL = defineString("APP_URL", {
  default: "http://localhost:3000",
  description: "URL pública usada para gerar links de validação.",
});

interface GerarLinkInput {
  turmaId: string;
  expiraEm: string;
}

interface RevogarInput {
  token: string;
}

interface ValidarInput {
  token: string;
  cracha: number;
  anoNascimento: number;
  dadosAtualizados?: {
    telefone?: string;
    email?: string;
    endereco?: string;
    bairro?: string;
  };
}

function exigirOrgOuAdm(token: { perfil?: string } | undefined) {
  if (!token || (token.perfil !== "ORG" && token.perfil !== "ADM")) {
    throw new HttpsError(
      "permission-denied",
      "Apenas organização pode executar esta ação."
    );
  }
}

export const gerarLinkValidacao = onCall<GerarLinkInput>(
  { region: REGION },
  async (req) => {
    exigirOrgOuAdm(req.auth?.token as { perfil?: string });
    const { turmaId, expiraEm } = req.data;
    if (!turmaId || !expiraEm) {
      throw new HttpsError("invalid-argument", "turmaId e expiraEm são obrigatórios.");
    }
    const token = randomBytes(16).toString("base64url");
    await getFirestore().doc(`linksValidacao/${token}`).set({
      turmaId,
      expiraEm,
      status: "ativo",
      usos: 0,
      criadoPor: req.auth?.uid || "?",
      criadoEm: new Date().toISOString(),
    });
    const url = `${APP_URL.value()}/v/${token}`;
    logger.info("link gerado", { token, turmaId });
    return { token, url };
  }
);

export const revogarLink = onCall<RevogarInput>(
  { region: REGION },
  async (req) => {
    exigirOrgOuAdm(req.auth?.token as { perfil?: string });
    const { token } = req.data;
    await getFirestore().doc(`linksValidacao/${token}`).update({
      status: "revogado",
    });
    return { ok: true };
  }
);

// Pública: qualquer um com o link e o segundo fator (crachá+nascimento) valida.
export const validarLink = onCall<ValidarInput>(
  { region: REGION, cors: true },
  async (req) => {
    const { token, cracha, anoNascimento, dadosAtualizados } = req.data;
    if (!token || !cracha || !anoNascimento) {
      throw new HttpsError(
        "invalid-argument",
        "token, cracha e anoNascimento são obrigatórios."
      );
    }
    const db = getFirestore();
    return db.runTransaction(async (tx) => {
      const linkRef = db.doc(`linksValidacao/${token}`);
      const linkSnap = await tx.get(linkRef);
      if (!linkSnap.exists) {
        throw new HttpsError("not-found", "Link inválido.");
      }
      const link = linkSnap.data()!;
      if (link.status !== "ativo") {
        throw new HttpsError("failed-precondition", "Link revogado.");
      }
      if (new Date(link.expiraEm).getTime() < Date.now()) {
        throw new HttpsError("failed-precondition", "Link expirado.");
      }
      const turma = await tx.get(db.doc(`turmasFormacao/${link.turmaId}`));
      if (!turma.exists) {
        throw new HttpsError("not-found", "Turma inexistente.");
      }
      const edicaoId = (turma.data() as { edicaoId: string }).edicaoId;

      const pessoasSnap = await tx.get(
        db.collection("pessoas").where("cracha", "==", cracha).limit(1)
      );
      if (pessoasSnap.empty) {
        throw new HttpsError("not-found", "Crachá não encontrado.");
      }
      const pessoaDoc = pessoasSnap.docs[0];
      const pessoa = pessoaDoc.data() as { nascimento: string; nome: string };
      const ano = Number((pessoa.nascimento || "").slice(0, 4));
      if (ano !== anoNascimento) {
        throw new HttpsError(
          "permission-denied",
          "Ano de nascimento não confere. Verifique."
        );
      }

      const partRef = db.doc(`participacoes/${pessoaDoc.id}_${edicaoId}`);
      const partSnap = await tx.get(partRef);
      if (!partSnap.exists) {
        throw new HttpsError(
          "failed-precondition",
          "Você ainda não está alocado nesta edição. Procure a coordenação."
        );
      }

      tx.update(pessoaDoc.ref, {
        ...(dadosAtualizados?.telefone && { telefone: dadosAtualizados.telefone }),
        ...(dadosAtualizados?.email && { email: dadosAtualizados.email }),
        ...(dadosAtualizados?.endereco && { endereco: dadosAtualizados.endereco }),
        ...(dadosAtualizados?.bairro && { bairro: dadosAtualizados.bairro }),
        dadosValidados: true,
        atualizadoEm: new Date().toISOString(),
      });
      tx.update(partRef, {
        formacaoFeita: true,
        dataFormacao: new Date().toISOString(),
      });
      tx.update(linkRef, {
        usos: (link.usos || 0) + 1,
        ultimoUsoEm: Timestamp.now(),
      });

      return {
        ok: true,
        mensagem: `Obrigado, ${pessoa.nome}! Sua presença e dados foram confirmados.`,
      };
    });
  }
);
