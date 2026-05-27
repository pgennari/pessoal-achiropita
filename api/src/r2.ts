// Helper para upload e remoção de fotos no Cloudflare R2.
// R2 implementa a API S3, portanto usa @aws-sdk/client-s3.
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

function criarCliente(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Variáveis R2_ACCOUNT_ID, R2_ACCESS_KEY_ID e R2_SECRET_ACCESS_KEY são obrigatórias."
    );
  }
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

// Faz upload de buffer JPEG para R2 e retorna a URL pública.
// A chave no bucket é fotos/{pessoaId}.jpg — sobrescreve ao trocar foto.
export async function uploadFoto(pessoaId: string, buffer: Buffer): Promise<string> {
  const bucket = process.env.R2_BUCKET_NAME ?? "achiropita-fotos";
  const publicUrl = process.env.R2_PUBLIC_URL;
  if (!publicUrl) throw new Error("R2_PUBLIC_URL não configurada.");

  const chave = `fotos/${pessoaId}.jpg`;
  await criarCliente().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: chave,
      Body: buffer,
      ContentType: "image/jpeg",
    })
  );

  return `${publicUrl.replace(/\/$/, "")}/${chave}`;
}

// Remove a foto do bucket. Não lança erro se o objeto já não existe.
export async function deletarFoto(pessoaId: string): Promise<void> {
  const bucket = process.env.R2_BUCKET_NAME ?? "achiropita-fotos";
  await criarCliente().send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: `fotos/${pessoaId}.jpg`,
    })
  );
}
