import { defineConfig, loadEnv } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import pkg from "./package.json";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, "..", "DEPLOY_VERSION");
  return {
    plugins: [tailwindcss(), react()],
    define: {
      __APP_VERSION__: JSON.stringify(env.DEPLOY_VERSION || pkg.version),
    },
    resolve: {
      extensions: [".js", ".ts", ".jsx", ".tsx"],
    },
    server: {
      host: "0.0.0.0",
      port: 4001,
      open: true,
    },
  };
});
