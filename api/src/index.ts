import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import pessoas from "./rotas/pessoas.js";
import edicoes from "./rotas/edicoes.js";
import barracas from "./rotas/barracas.js";
import participacoes from "./rotas/participacoes.js";
import usuarios from "./rotas/usuarios.js";
import convites from "./rotas/convites.js";
import turmas from "./rotas/turmas.js";
import formacoes from "./rotas/formacoes.js";
import entregas from "./rotas/entregas.js";
import links from "./rotas/links.js";
import auditoria from "./rotas/auditoria.js";
import publico from "./rotas/publico.js";
import admin from "./rotas/admin.js";

const app = new Hono();

// CORS: aceita apenas a origem do Firebase Hosting em produção.
const origemPermitida = process.env.ALLOWED_ORIGIN ?? "*";
app.use(
  "*",
  cors({
    origin: origemPermitida,
    allowHeaders: ["Authorization", "Content-Type"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    maxAge: 86400,
  })
);

if (process.env.NODE_ENV !== "production") {
  app.use("*", logger());
}

app.get("/health", (c) => c.json({ ok: true, ts: new Date().toISOString() }));

app.route("/api/pessoas", pessoas);
app.route("/api/edicoes", edicoes);
app.route("/api/barracas", barracas);
app.route("/api/participacoes", participacoes);
app.route("/api/usuarios", usuarios);
app.route("/api/convites", convites);
app.route("/api/turmas", turmas);
app.route("/api/formacoes", formacoes);
app.route("/api/entregas", entregas);
app.route("/api/links", links);
app.route("/api/auditoria", auditoria);
app.route("/api/publico", publico);
app.route("/api/admin", admin);

app.onError((err, c) => {
  console.error("[API Error]", err);
  return c.json({ erro: err.message ?? "Erro interno do servidor." }, 500);
});

const port = parseInt(process.env.PORT ?? "8080", 10);
serve({ fetch: app.fetch, port }, () => {
  console.log(`API Achiropita escutando na porta ${port}`);
});
