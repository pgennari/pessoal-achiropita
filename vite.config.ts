import { execSync } from "node:child_process";
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

function versaoDoBuild(): string {
  let sha = "sem-git";
  try {
    sha = execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    // sem repositório git — a versão ainda reflete a data/hora do build
  }
  const data = new Date().toISOString().slice(0, 19).replace("T", " ");
  return `v0.1-${sha} ${data}Z`;
}

export default defineConfig({
  define: {
    VERSAO_APP: JSON.stringify(versaoDoBuild()),
  },
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  server: {
    host: true,
    headers: {
      "Cross-Origin-Opener-Policy": "unsafe-none",
      "Cross-Origin-Embedder-Policy": "unsafe-none",
    }
  },
  build: { outDir: "dist", sourcemap: false },
});