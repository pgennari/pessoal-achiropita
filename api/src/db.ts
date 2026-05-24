import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL não definida.");

const sql = postgres(url, {
  max: 10,
  idle_timeout: 30,
  connect_timeout: 30,
  // Neon usa SSL; outros ambientes podem não usar.
  ssl: process.env.NODE_ENV === "production" ? "require" : false,
});

export default sql;
