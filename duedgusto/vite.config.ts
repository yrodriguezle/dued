import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import pkg from "./package.json";

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    extensions: [".js", ".ts", ".jsx", ".tsx"],
  },
  server: {
    host: "0.0.0.0",
    port: 4001,
    open: true,
  },
});
