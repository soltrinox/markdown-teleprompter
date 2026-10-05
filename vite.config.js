import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss()],
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.js"],
  },
});
