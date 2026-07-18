// Vitest config para pruebas de componentes React (jsdom + Testing Library).
// Convive con vite.config.ts (usado por dev/build) sin interferir con la
// config de TanStack Start; Vitest lo prioriza sobre vite.config.ts.
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    css: false,
  },
});
