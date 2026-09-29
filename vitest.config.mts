import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Em testes não há o bundler do Next para validar a fronteira servidor/cliente.
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    env: {
      TZ: "America/Sao_Paulo",
      NODE_ENV: "test",
      STORAGE_DRIVER: "local",
      APP_TIMEZONE: "America/Sao_Paulo",
      PORTAL_TOKEN_SECRET: "test-portal-token-secret-0123456789abcdef",
      SESSION_SECRET: "test-session-secret-0123456789abcdef-xyz",
    },
  },
});
