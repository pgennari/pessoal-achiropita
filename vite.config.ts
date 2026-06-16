import path from "node:path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const proxyTarget = env.API_PROXY_TARGET;

  return {
    plugins: [react()],
    resolve: {
      alias: { "@": path.resolve(__dirname, "src") },
    },
    server: {
      headers: {
        "Cross-Origin-Opener-Policy": "unsafe-none",
        "Cross-Origin-Embedder-Policy": "unsafe-none",
      },
      ...(proxyTarget && {
        proxy: {
          "/health": { target: proxyTarget, changeOrigin: true },
          "/api": { target: proxyTarget, changeOrigin: true },
        },
      }),
    },
    build: { outDir: "dist", sourcemap: false },
  };
});
