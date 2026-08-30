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
import perfis from "./rotas/perfis.js";
import permissoes from "./rotas/permissoes.js";
import convites from "./rotas/convites.js";
import turmas from "./rotas/turmas.js";
import formacoes from "./rotas/formacoes.js";
import links from "./rotas/links.js";
import auditoria from "./rotas/auditoria.js";
import estacionamentos from "./rotas/estacionamentos.js";
import veiculos from "./rotas/veiculos.js";
import checkin from "./rotas/checkin.js";
import publico from "./rotas/publico.js";
import admin from "./rotas/admin.js";
import setores from "./rotas/setores.js";
import parametros from "./rotas/parametros.js";
import historicoParticipacoes from "./rotas/historicoParticipacoes.js";
import dashboard from "./rotas/dashboard.js";
import diasFesta from "./rotas/diasFesta.js";
import presenca from "./rotas/presenca.js";
import presencaPublico from "./rotas/presencaPublico.js";
import avaliacao from "./rotas/avaliacao.js";
import avaliacaoPublico from "./rotas/avaliacaoPublico.js";
import avaliacaoCoordenador from "./rotas/avaliacaoCoordenador.js";
import avaliacaoCoordenadorPublico from "./rotas/avaliacaoCoordenadorPublico.js";
import avaliacaoEquipistaCoordenador from "./rotas/avaliacaoEquipistaCoordenador.js";
import avaliacaoEquipistaCoordenadorPublico from "./rotas/avaliacaoEquipistaCoordenadorPublico.js";
import sincronizacao from "./rotas/sincronizacao.js";
import vagas from "./rotas/vagas.js";
import cantina from "./rotas/cantina.js";
import cantinaPublico from "./rotas/cantinaPublico.js";
import montagem from "./rotas/montagem.js";
import bloqueios from "./rotas/bloqueios.js";

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

app.use(
  "*",
  cors({
    origin: "*",
    allowHeaders: ["Authorization", "Content-Type"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  })
);

if (process.env.NODE_ENV !== "production") {
  app.use("*", logger());
}

app.get("/health", (c) => c.json({ ok: true, ts: new Date().toISOString() }));

app.route("/api/pessoas", pessoas);
app.route("/api/edicoes", edicoes);
app.route("/api/equipes", equipes);
app.route("/api/participacoes", participacoes);
app.route("/api/usuarios", usuarios);
app.route("/api/perfis", perfis);
app.route("/api/permissoes", permissoes);
app.route("/api/convites", convites);
app.route("/api/turmas", turmas);
app.route("/api/formacoes", formacoes);
app.route("/api/links", links);
app.route("/api/auditoria", auditoria);
app.route("/api/estacionamentos/dashboard", dashboard);
app.route("/api/estacionamentos", estacionamentos);
app.route("/api/veiculos", veiculos);
app.route("/api/publico/checkin", checkin);
app.route("/api/publico", publico);
app.route("/api/publico", presencaPublico);
app.route("/api/admin", admin);
app.route("/api/historico-participacoes", historicoParticipacoes);
app.route("/api/setores", setores);
app.route("/api/parametros", parametros);
app.route("/api/dias-festa", diasFesta);
app.route("/api/presenca", presenca);
app.route("/api/avaliacao", avaliacao);
app.route("/api/avaliacoes", avaliacao);
app.route("/api/publico", avaliacaoPublico);
app.route("/api/avaliacao-coordenador", avaliacaoCoordenador);
app.route("/api/avaliacoes-coordenador", avaliacaoCoordenador);
app.route("/api/publico", avaliacaoCoordenadorPublico);
app.route("/api/avaliacao-equipista", avaliacaoEquipistaCoordenador);
app.route("/api/avaliacoes-equipista-coordenador", avaliacaoEquipistaCoordenador);
app.route("/api/publico", avaliacaoEquipistaCoordenadorPublico);
app.route("/api/sincronizacao", sincronizacao);
app.route("/api/vagas", vagas);
app.route("/api/cantina", cantina);
app.route("/api/publico", cantinaPublico);
app.route("/api/montagem", montagem);
app.route("/api/bloqueios", bloqueios);

app.onError((err, c) => {
  console.error("[API Error]", err);
  return c.json({ erro: err.message ?? "Erro interno do servidor." }, 500);
});

const port = parseInt(process.env.PORT ?? "8080", 10);
serve({ fetch: app.fetch, port }, () => {
  console.log(`API Achiropita escutando na porta ${port}`);
});
