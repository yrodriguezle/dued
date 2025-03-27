import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    extensions: [".js", ".ts", ".jsx", ".tsx"],
  },
  server: {
    host: "0.0.0.0",
    port: 4001,
    open: true,
  },
});
