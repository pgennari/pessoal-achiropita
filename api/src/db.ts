import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL não definida.");

const dbSsl = process.env.DATABASE_SSL;
const sql = postgres(url, {
  max: 10,
  idle_timeout: 30,
  connect_timeout: 30,
  // Permite desativar SSL localmente ou em containers que não usam Neon.
  ssl: dbSsl === "false" ? false : (dbSsl === "true" || dbSsl === "require" || process.env.NODE_ENV === "production" ? "require" : false),
});

export default sql;
