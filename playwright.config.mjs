import { defineConfig } from "@playwright/test";
import process from "node:process";

const baseURL = "http://127.0.0.1:4173";

export default defineConfig({
  testDir: "./tests/e2e",
  use: { baseURL, channel: process.env.WHITEBOARD_BROWSER_CHANNEL },
  webServer: {
    command: "npm run dev -- --port 4173",
    url: baseURL,
  },
});
