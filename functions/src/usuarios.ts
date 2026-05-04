import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";
import { HttpsError, onCall } from "firebase-functions/v2/https";

type Perfil = "ADM" | "ORG" | "CRD" | "EQP" | "OPC" | "REC";

interface SetUserRoleData {
  email: string;
  perfil: Perfil;
  pessoaId?: string;
  barracasCRD?: string[];
}

interface InviteUserData {
  email: string;
  nome: string;
  perfil: Perfil;
  pessoaId?: string;
  barracasCRD?: string[];
}

const REGION = "southamerica-east1";

function exigirAdm(token: { perfil?: string } | undefined) {
  if (!token || token.perfil !== "ADM") {
    throw new HttpsError(
      "permission-denied",
      "Apenas administradores podem executar esta ação."
    );
  }
}

export const setUserRole = onCall<SetUserRoleData>(
  { region: REGION },
  async (req) => {
    exigirAdm(req.auth?.token as { perfil?: string });
    const { email, perfil, pessoaId, barracasCRD } = req.data;
    if (!email || !perfil) {
      throw new HttpsError("invalid-argument", "email e perfil são obrigatórios.");
    }
    const user = await getAuth().getUserByEmail(email);
    const claims: Record<string, unknown> = { perfil };
    if (pessoaId) claims.pessoaId = pessoaId;
    if (barracasCRD && barracasCRD.length > 0) claims.barracasCRD = barracasCRD;
    await getAuth().setCustomUserClaims(user.uid, claims);
    await getFirestore().doc(`usuarios/${user.uid}`).set(
      {
        email: user.email,
        nome: user.displayName || email,
        perfil,
        pessoaId: pessoaId || null,
        barracasCRD: barracasCRD || null,
        atualizadoEm: new Date().toISOString(),
      },
      { merge: true }
    );
    logger.info("setUserRole", { uid: user.uid, perfil });
    return { ok: true, uid: user.uid };
  }
);

export const inviteUser = onCall<InviteUserData>(
  { region: REGION },
  async (req) => {
    exigirAdm(req.auth?.token as { perfil?: string });
    const { email, nome, perfil, pessoaId, barracasCRD } = req.data;
    if (!email || !nome || !perfil) {
      throw new HttpsError(
        "invalid-argument",
        "email, nome e perfil são obrigatórios."
      );
    }
    const auth = getAuth();
    let user;
    try {
      user = await auth.getUserByEmail(email);
    } catch {
      user = await auth.createUser({ email, displayName: nome });
    }
    const claims: Record<string, unknown> = { perfil };
    if (pessoaId) claims.pessoaId = pessoaId;
    if (barracasCRD && barracasCRD.length > 0) claims.barracasCRD = barracasCRD;
    await auth.setCustomUserClaims(user.uid, claims);
    const link = await auth.generatePasswordResetLink(email);
    await getFirestore().doc(`usuarios/${user.uid}`).set(
      {
        email,
        nome,
        perfil,
        pessoaId: pessoaId || null,
        barracasCRD: barracasCRD || null,
        atualizadoEm: new Date().toISOString(),
      },
      { merge: true }
    );
    // TODO: enviar e-mail via SendGrid. Por enquanto, retorna o link para o ADM.
    logger.info("inviteUser", { uid: user.uid, email });
    return { ok: true, uid: user.uid, link };
  }
);
