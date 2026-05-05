import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { logger } from "firebase-functions/v2";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onObjectFinalized } from "firebase-functions/v2/storage";
import * as path from "path";
import sharp from "sharp";

const REGION = "us-east1";

// Trigger: ao subir /pessoas/{id}/foto.jpg, normaliza para 600x600 e atualiza fotoUrl.
export const processarFotoPessoa = onObjectFinalized(
  { region: REGION, memory: "512MiB" },
  async (event) => {
    const objeto = event.data;
    const filePath = objeto.name || "";
    const match = filePath.match(/^pessoas\/([^/]+)\/foto\.jpg$/);
    if (!match) return;
    const pessoaId = match[1];

    // Evita loop: ignora se já tiver metadata processado.
    if (objeto.metadata?.processado === "1") return;

    const bucket = getStorage().bucket(objeto.bucket);
    const tmpOriginal = path.join("/tmp", `${pessoaId}-original`);
    const tmpRedim = path.join("/tmp", `${pessoaId}-redim.jpg`);

    await bucket.file(filePath).download({ destination: tmpOriginal });
    await sharp(tmpOriginal)
      .rotate()
      .resize(600, 600, { fit: "cover" })
      .jpeg({ quality: 82 })
      .toFile(tmpRedim);

    // Salva versão histórica antes de sobrescrever.
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    await bucket.file(filePath).copy(
      bucket.file(`pessoas/${pessoaId}/historico/${stamp}.jpg`)
    );

    await bucket.upload(tmpRedim, {
      destination: filePath,
      metadata: {
        contentType: "image/jpeg",
        metadata: { processado: "1" },
      },
    });

    const [url] = await bucket
      .file(filePath)
      .getSignedUrl({ action: "read", expires: "03-01-2500" });

    await getFirestore().doc(`pessoas/${pessoaId}`).update({
      fotoUrl: url,
      atualizadoEm: new Date().toISOString(),
    });
    logger.info("foto processada", { pessoaId });
  }
);

// Toda segunda às 04:00 BRT: apaga versões em historico/ com mais de 30 dias.
export const cleanupFotosAntigas = onSchedule(
  { schedule: "every monday 04:00", timeZone: "America/Sao_Paulo", region: REGION },
  async () => {
    const bucket = getStorage().bucket();
    const [files] = await bucket.getFiles({ prefix: "pessoas/" });
    const limite = Date.now() - 30 * 24 * 3600 * 1000;
    for (const f of files) {
      if (!f.name.includes("/historico/")) continue;
      const [meta] = await f.getMetadata();
      const ts = meta.timeCreated ? Date.parse(meta.timeCreated) : 0;
      if (ts && ts < limite) {
        await f.delete();
        logger.info("foto antiga removida", { name: f.name });
      }
    }
  }
);
