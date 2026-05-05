import { getFirestore } from "firebase-admin/firestore";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions/v2";

const REGION = "us-east1";

async function registrar(
  acao: string,
  alvo: string,
  detalhes?: string,
  autor?: string
) {
  await getFirestore()
    .collection("auditoria")
    .add({
      acao,
      alvo,
      detalhes: detalhes || null,
      autor: autor || "sistema",
      criadoEm: new Date().toISOString(),
    });
}

function determinarAcao(antes: unknown, depois: unknown): "criou" | "atualizou" | "removeu" {
  if (!antes && depois) return "criou";
  if (antes && !depois) return "removeu";
  return "atualizou";
}

export const onPessoaWrite = onDocumentWritten(
  { document: "pessoas/{pessoaId}", region: REGION },
  async (event) => {
    const pessoaId = event.params.pessoaId;
    const acao = determinarAcao(
      event.data?.before.exists,
      event.data?.after.exists
    );
    const dados = event.data?.after.data() || event.data?.before.data();
    await registrar(
      `pessoa_${acao}`,
      `pessoas/${pessoaId}`,
      dados ? `nome=${(dados as { nome?: string }).nome || "?"}` : undefined
    );
    logger.info("auditoria pessoa", { pessoaId, acao });
  }
);

export const onParticipacaoWrite = onDocumentWritten(
  { document: "participacoes/{partId}", region: REGION },
  async (event) => {
    const partId = event.params.partId;
    const acao = determinarAcao(
      event.data?.before.exists,
      event.data?.after.exists
    );
    const dados = event.data?.after.data() || event.data?.before.data();
    const detalhes = dados
      ? `pessoa=${(dados as { pessoaId?: string }).pessoaId} barraca=${
          (dados as { barracaId?: string }).barracaId
        } funcao=${(dados as { funcao?: string }).funcao}`
      : undefined;
    await registrar(`participacao_${acao}`, `participacoes/${partId}`, detalhes);
  }
);

export const onEdicaoWrite = onDocumentWritten(
  { document: "edicoes/{edicaoId}", region: REGION },
  async (event) => {
    const edicaoId = event.params.edicaoId;
    const acao = determinarAcao(
      event.data?.before.exists,
      event.data?.after.exists
    );
    const dados = event.data?.after.data() || event.data?.before.data();
    const detalhes = dados
      ? `${(dados as { numero?: number }).numero}ª ${
          (dados as { ano?: number }).ano
        } status=${(dados as { status?: string }).status}`
      : undefined;
    await registrar(`edicao_${acao}`, `edicoes/${edicaoId}`, detalhes);
  }
);
