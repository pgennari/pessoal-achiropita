import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

function versaoDoBuild(): string {
  let sha = "sem-git";
  try {
    sha = execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    // sem repositório git — a versão ainda reflete a data/hora do build
  }
  const data = new Date(Date.now() - 3 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");
  return `v0.1-${sha} ${data}`;
}

// Publica /versao.json junto do app (dist/). O cliente compara a versão do
// arquivo com a versão embutida no build (VERSAO_APP) a cada chamada da API
// e avisa quando houver um build mais novo no Hosting.
function pluginVersaoJson(versao: string): Plugin {
  return {
    name: "versao-json",
    apply: "build",
    closeBundle() {
      const destino = path.resolve(process.cwd(), "dist", "versao.json");
      fs.writeFileSync(destino, JSON.stringify({ versao }));
    },
  };
}

const VERSAO = versaoDoBuild();

export default defineConfig({
  define: {
    VERSAO_APP: JSON.stringify(VERSAO),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["favicon.svg", "logo-achiropita.png"],
      manifest: {
        name: "Achiropita — Pessoal — Gestão da equipe",
        short_name: "Achiropita",
        description: "Gestão da equipe da Festa de Nossa Senhora Achiropita",
        lang: "pt-BR",
        theme_color: "#16753A",
        background_color: "#FFFFFF",
        display: "standalone",
        start_url: "/",
        scope: "/",
        icons: [
          {
            src: "/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/pwa-maskable-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "/pwa-apple-180x180.png",
            sizes: "180x180",
            type: "image/png",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        navigateFallback: "/index.html",
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "fontes-google",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
    pluginVersaoJson(VERSAO),
  ],
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