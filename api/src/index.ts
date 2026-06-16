import "dotenv/config";
import { serve } from "@hono/node-server";
import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { swaggerUI } from "@hono/swagger-ui";
import pessoas from "./rotas/pessoas.js";
import edicoes from "./rotas/edicoes.js";
import equipes from "./rotas/equipes.js";
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
import historicoParticipacoes from "./rotas/historicoParticipacoes.js";

const app = new OpenAPIHono();

// Swagger UI
app.get("/docs", swaggerUI({ url: "/docs/openapi.json" }));
app.doc("/docs/openapi.json", {
  openapi: "3.0.0",
  info: {
    title: "API Achiropita",
    version: "0.1.0",
    description: "API para gestão de pessoal e formações da Festa da Achiropita",
  },
});

const origensPadrao = [
  "https://achiropita-pessoal.web.app",
  "https://achiropita-pessoal.firebaseapp.com",
  "http://localhost:5173",
  "http://localhost",
];

// CORS: aceita uma lista de origens em ALLOWED_ORIGIN (separadas por vírgula).
// O /health também é chamado pelo frontend, então o middleware precisa cobrir
// todas as rotas, não só /api/*.
const origensPermitidas = (process.env.ALLOWED_ORIGIN ?? origensPadrao.join(","))
  .split(",")
  .map((o) => o.trim().replace(/\/$/, ""))
  .filter((o) => o.length > 0);

app.use(
  "*",
  cors({
    origin: origensPermitidas.includes("*") ? "*" : origensPermitidas,
    allowHeaders: ["Authorization", "Content-Type"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  })
);
console.log("Origens permitidas:", origensPermitidas);

if (process.env.NODE_ENV !== "production") {
  app.use("*", logger());
}

app.get("/health", (c) => c.json({ ok: true, ts: new Date().toISOString() }));

app.route("/api/pessoas", pessoas);
app.route("/api/edicoes", edicoes);
app.route("/api/equipes", equipes);
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
app.route("/api/historico-participacoes", historicoParticipacoes);

app.onError((err, c) => {
  console.error("[API Error]", err);
  return c.json({ erro: err.message ?? "Erro interno do servidor." }, 500);
});

const port = parseInt(process.env.PORT ?? "8080", 10);
serve({ fetch: app.fetch, port }, () => {
  console.log(`API Achiropita escutando na porta ${port}`);
});
