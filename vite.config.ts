import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const proxy = {
    "/api": {
      target: env.BACKEND_URL || "http://127.0.0.1:8080",
      changeOrigin: true,
    },
  };
  return {
    plugins: [react()],
    server: {
      host: "127.0.0.1",
      port: 5173,
      strictPort: true,
      open: "http://hisabo.localhost:5173",
      proxy,
      watch: { usePolling: true, interval: 300 },
    },
    preview: {
      host: "127.0.0.1",
      port: 4173,
      strictPort: true,
      open: "http://hisabo.localhost:4173",
      proxy,
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: (id: string) =>
            /node_modules\/(echarts|zrender)\//.test(id) ? "charts" : undefined,
        },
      },
    },
  };
});
