import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        verde: {
          DEFAULT: "#16753A",
          claro: "#2E9D52",
          escuro: "#0E5026",
        },
        vermelho: {
          DEFAULT: "#C8102E",
          claro: "#E63946",
          escuro: "#8B0A1F",
        },
        bianco: "#FFFFFF",
        crema: "#FAF6EE",
        pietra: {
          clara: "#F0EBDF",
          DEFAULT: "#E0D9C8",
        },
        ardesia: "#6B6960",
        carbone: "#1C1A16",
        ouro: { DEFAULT: "#C99A2E", suave: "#F5EBC8", texto: "#6F5310" },
        azul: { DEFAULT: "#2A5C8A", suave: "#DCE7F2", texto: "#1B3F5C" },
        marrom: { DEFAULT: "#7B4A2D", suave: "#EAE0D3", texto: "#4A2A14" },
      },
      fontFamily: {
        display: ['"Fraunces"', '"Times New Roman"', "serif"],
        sans: ['"Manrope"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      borderRadius: { sm: "6px", md: "12px", lg: "20px" },
      boxShadow: {
        suave:
          "0 1px 2px rgba(28, 26, 22, 0.06), 0 2px 8px rgba(28, 26, 22, 0.04)",
        media:
          "0 4px 12px rgba(28, 26, 22, 0.08), 0 8px 24px rgba(28, 26, 22, 0.06)",
        forte: "0 12px 40px rgba(28, 26, 22, 0.12)",
      },
      maxWidth: { container: "1180px" },
    },
  },
  plugins: [],
};

export default config;
