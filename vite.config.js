import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite: быстрый dev-сервер и сборка для React
export default defineConfig({
  plugins: [react()],
});
