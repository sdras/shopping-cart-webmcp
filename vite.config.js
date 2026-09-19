import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // One copy of React even if the hook is ever linked from a sibling checkout.
  resolve: { dedupe: ["react", "react-dom"] },
  test: {
    environment: "node",
    include: ["tests/**/*.test.js"],
  },
});
