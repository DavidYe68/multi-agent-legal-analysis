import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    // 避免新增依赖（framer-motion / reactflow）各自解析到不同的 React 副本，
    // 否则会触发 "Invalid hook call / 多个 React 副本"。
    dedupe: ["react", "react-dom"],
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  optimizeDeps: {
    include: ["react", "react-dom", "framer-motion", "reactflow"],
  },
});
