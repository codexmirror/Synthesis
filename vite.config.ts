import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  base: "./",
  server: { fs: { deny: ["**/v0/**"] } },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "jsdom",
    clearMocks: true,
  },
});
