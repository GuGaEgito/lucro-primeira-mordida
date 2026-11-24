import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Em desenvolvimento, as chamadas para /api vão para a API do back (porta 3000).
// Assim o navegador fala só com o Vite e não esbarra no CORS.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.VITE_API_PROXY || "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
