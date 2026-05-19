import { HttpsError, onCall } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

initializeApp();

// ---- Tipos locais (espelham src/lib/importacaoUtils.ts e src/lib/tipos.ts) ----

type EstadoCivil =
  | "Solteiro(a)"
  | "Casado(a)"
  | "Divorciado(a)"
  | "Viúvo(a)"
  | "Separado(a)";

const ESTADOS_CIVIS: EstadoCivil[] = [
  "Solteiro(a)",
  "Casado(a)",
  "Divorciado(a)",
  "Viúvo(a)",
  "Separado(a)",
];

interface ItemHistorico {
  ano: number;
  barraca: string;
  funcao: string;
}

interface LinhaPessoa {
  idx: number;
  nome: string;
  nascimento: string;
  telefone: string;
  cpf: string;
  rg: string;
  email: string;
  endereco: string;
  bairro: string;
  estadoCivil: string;
  cracha: number;
  historico: ItemHistorico[];
  avisos: string[];
}

interface Pendencia {
  idx: number;
  nome: string;
  motivo: string;
}

// ---- Cloud Function ----

export const importarPlanilha = onCall(
  { timeoutSeconds: 600, memory: "512MiB" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Não autenticado.");
    }

    const { jobId, linhasProcessadas } = request.data as {
      jobId: string;
      linhasProcessadas: LinhaPessoa[];
    };

    if (!jobId || !Array.isArray(linhasProcessadas)) {
      throw new HttpsError("invalid-argument", "Dados inválidos.");
    }

    const uid = request.auth.uid;
    const db = getFirestore();

    await db.doc(`importacoesStatus/${jobId}`).set({
      status: "processando",
      progresso: { atual: 0, total: linhasProcessadas.length },
      uid,
      resultado: null,
      erroMsg: null,
      criadoEm: FieldValue.serverTimestamp(),
    });

    try {
      // Carrega pessoas existentes para deduplicação
      const pessoasSnap = await db.collection("pessoas").get();
      const cpfParaId = new Map<string, string>();
      const nomeNascParaId = new Map<string, string>();
      let maxCracha = 0;

      for (const d of pessoasSnap.docs) {
        const p = d.data();
        if (p.cpf) cpfParaId.set(String(p.cpf), d.id);
        if (p.nome && p.nascimento) {
          nomeNascParaId.set(
            `${String(p.nome).toLowerCase()}__${p.nascimento}`,
            d.id
          );
        }
        if (typeof p.cracha === "number" && p.cracha > maxCracha) {
          maxCracha = p.cracha;
        }
      }

      for (const l of linhasProcessadas) {
        if (l.cracha > 0 && l.cracha > maxCracha) maxCracha = l.cracha;
      }

      const pendencias: Pendencia[] = [];
      const avisos: Array<{ idx: number; nome: string; avisos: string[] }> = [];
      let importados = 0;
      let jaExistentes = 0;
      let totalParticipacoes = 0;

      for (let i = 0; i < linhasProcessadas.length; i++) {
        const linha = linhasProcessadas[i];

        // Atualiza progresso a cada 10 pessoas para não sobrecarregar o Firestore
        if (i % 10 === 0) {
          await db
            .doc(`importacoesStatus/${jobId}`)
            .update({ "progresso.atual": i });
        }

        if (!linha.nome) {
          pendencias.push({
            idx: linha.idx,
            nome: "(sem nome)",
            motivo: "Nome em branco",
          });
          continue;
        }

        try {
          let pessoaId: string | null =
            (linha.cpf ? cpfParaId.get(linha.cpf) : undefined) ??
            (linha.nome && linha.nascimento
              ? nomeNascParaId.get(
                  `${linha.nome.toLowerCase()}__${linha.nascimento}`
                )
              : undefined) ??
            null;

          if (pessoaId) {
            jaExistentes++;
          } else {
            const cracha = linha.cracha > 0 ? linha.cracha : ++maxCracha;

            const payload = {
              cracha,
              nome: linha.nome,
              nascimento: linha.nascimento || null,
              telefone: linha.telefone || null,
              cpf: linha.cpf || null,
              rg: linha.rg || null,
              email: linha.email || null,
              endereco: linha.endereco || null,
              bairro: linha.bairro || null,
              estadoCivil: ESTADOS_CIVIS.includes(
                linha.estadoCivil as EstadoCivil
              )
                ? linha.estadoCivil
                : null,
              fotoUrl: null,
              ativo: true,
              filhos: [],
              carros: [],
              criadoEm: FieldValue.serverTimestamp(),
              atualizadoEm: FieldValue.serverTimestamp(),
            };

            const ref = await db.collection("pessoas").add(payload);
            pessoaId = ref.id;

            if (linha.cpf) cpfParaId.set(linha.cpf, pessoaId);
            if (linha.nome && linha.nascimento) {
              nomeNascParaId.set(
                `${linha.nome.toLowerCase()}__${linha.nascimento}`,
                pessoaId
              );
            }

            if (linha.nascimento) {
              await db.doc(`buscaCracha/${cracha}`).set({
                pessoaId,
                anoNascimento: linha.nascimento.slice(0, 4),
                atualizadoEm: FieldValue.serverTimestamp(),
              });
            }

            importados++;
            if (linha.avisos.length > 0) {
              avisos.push({
                idx: linha.idx,
                nome: linha.nome,
                avisos: linha.avisos,
              });
            }
          }

          for (const hist of linha.historico) {
            try {
              const anoReal =
                hist.ano < 30 ? 2000 + hist.ano : 1900 + hist.ano;
              await db
                .doc(`participacoesHistoricas/${pessoaId}_${anoReal}`)
                .set({
                  pessoaId,
                  pessoaNome: linha.nome,
                  anoEdicao: anoReal,
                  barracaNome: hist.barraca,
                  funcao: hist.funcao || "Equipista",
                  criadoEm: FieldValue.serverTimestamp(),
                });
              totalParticipacoes++;
            } catch {
              // Não bloqueia a importação por falha no histórico
            }
          }
        } catch (e) {
          pendencias.push({
            idx: linha.idx,
            nome: linha.nome,
            motivo: e instanceof Error ? e.message : "Falha desconhecida",
          });
        }
      }

      // Auditoria
      const usuarioDoc = await db.doc(`usuarios/${uid}`).get();
      await db.collection("auditoria").add({
        uid,
        nome: usuarioDoc.data()?.nome ?? "",
        tipo: "importacao.concluiu",
        ref: "importacao/xlsx",
        descricao: `${importados} novas · ${jaExistentes} já existentes · ${totalParticipacoes} participações históricas · ${pendencias.length} pendências`,
        quando: FieldValue.serverTimestamp(),
      });

      await db.doc(`importacoesStatus/${jobId}`).update({
        status: "concluido",
        progresso: null,
        resultado: {
          importados,
          jaExistentes,
          participacoes: totalParticipacoes,
          pendencias,
          avisos,
        },
      });
    } catch (e) {
      await db.doc(`importacoesStatus/${jobId}`).update({
        status: "erro",
        progresso: null,
        erroMsg:
          e instanceof Error ? e.message : "Erro inesperado na importação.",
      });
    }

    return { ok: true };
  }
);
