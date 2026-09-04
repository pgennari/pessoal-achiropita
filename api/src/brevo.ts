// Disparo de e-mails transacionais via Brevo (API v3).
// Requer BREVO_API_KEY e um remetente verificado em BREVO_SENDER_EMAIL
// (verificado em Brevo > Senders). Nao adicionamos dependencias: usa fetch
// global do Node (>=18).

const BREVO_URL = "https://api.brevo.com/v3/smtp/email";
// Cada chamada de envio e limitada a 98 destinatarios em BCC. Chunking acima
// disso fica a cargo do chamador (ver rotas/comunicados.ts).
const MAX_DESTINATARIOS = 98;

export interface EnviarEmailParams {
  destinatariosBcc: string[];
  assunto: string;
  html: string;
  texto: string;
  tags?: string[];
}

export interface ResultadoEnvio {
  messageId: string;
  enviados: number;
}

// Envia UM e-mail com todos os destinatarios em BCC. O campo `to` e obrigatorio
// na API do Brevo, entao usamos o proprio remetente (recebe uma copia).
export async function enviarEmail({
  destinatariosBcc,
  assunto,
  html,
  texto,
  tags,
}: EnviarEmailParams): Promise<ResultadoEnvio> {
  const chave = process.env.BREVO_API_KEY;
  const remetenteEmail = process.env.BREVO_SENDER_EMAIL;
  if (!chave) {
    throw new Error("Disparo de e-mail nao configurado (BREVO_API_KEY ausente).");
  }
  if (!remetenteEmail) {
    throw new Error("Remetente de e-mail nao configurado (BREVO_SENDER_EMAIL ausente).");
  }
  if (destinatariosBcc.length === 0) {
    throw new Error("Nenhum destinatario com e-mail cadastrado.");
  }
  if (destinatariosBcc.length > MAX_DESTINATARIOS) {
    throw new Error(`Limite do Brevo excedido (maximo ${MAX_DESTINATARIOS} por envio).`);
  }

  const corpo: Record<string, unknown> = {
    sender: {
      email: remetenteEmail,
      name: process.env.BREVO_SENDER_NAME ?? "Festa da Achiropita",
    },
    to: [{ email: remetenteEmail }],
    bcc: destinatariosBcc.map((email) => ({ email })),
    subject: assunto,
    htmlContent: html,
    textContent: texto,
  };
  // O Brevo rejeita `tags` vazio (HTTP 400 "tags is blank"). So envia quando
  // ha tags reais; caso contrario omite o campo (parametro opcional da API).
  if (tags && tags.length > 0) {
    corpo.tags = tags;
  }

  const resposta = await fetch(BREVO_URL, {
    method: "POST",
    headers: {
      "api-key": chave,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(corpo),
  });

  if (!resposta.ok) {
    const detalhe = await resposta.text().catch(() => "");
    const resumo = detalhe ? `: ${detalhe.slice(0, 400)}` : "";
    throw new Error(`Falha no envio pelo Brevo (HTTP ${resposta.status})${resumo}`);
  }

  const dados = (await resposta.json().catch(() => ({}))) as { messageId?: string };
  return { messageId: dados.messageId ?? "", enviados: destinatariosBcc.length };
}