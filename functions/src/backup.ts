import * as admin from "firebase-admin";
import { logger } from "firebase-functions/v2";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { google } from "googleapis";

const REGION = "us-east1";

// Backup semanal — toda quarta-feira 03:00 BRT (US-12-04).
// Exporta o Firestore inteiro para gs://<projectId>-backups/<timestamp>.
export const backupSemanal = onSchedule(
  {
    schedule: "every wednesday 03:00",
    timeZone: "America/Sao_Paulo",
    region: REGION,
  },
  async () => {
    const projectId = admin.app().options.projectId!;
    const bucket = `${projectId}-backups`;
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const outputUriPrefix = `gs://${bucket}/${stamp}`;

    const auth = new google.auth.GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/datastore"],
    });
    const firestore = google.firestore({ version: "v1", auth });
    await firestore.projects.databases.exportDocuments({
      name: `projects/${projectId}/databases/(default)`,
      requestBody: { outputUriPrefix },
    });
    logger.info("backup iniciado", { outputUriPrefix });
  }
);
