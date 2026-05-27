import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const base = process.env.VITE_BASE_PATH || "/";

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["partybeats-icon.svg"],
      manifest: {
        name: "PartyBeats",
        short_name: "PartyBeats",
        description: "Collaborative music queues for parties.",
        theme_color: "#12131a",
        background_color: "#f8f6ef",
        display: "standalone",
        start_url: ".",
        icons: [
          {
            src: "partybeats-icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable"
          }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico}"]
      }
    })
  ]
});
