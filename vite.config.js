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
      includeAssets: ["partybeats-icon.png"],
      manifest: {
        id: ".",
        name: "BP PartyBeats",
        short_name: "BP PartyBeats",
        description: "Collaborative music queues for parties.",
        theme_color: "#12131a",
        background_color: "#f8f6ef",
        display: "standalone",
        orientation: "portrait-primary",
        categories: ["music", "entertainment", "social"],
        scope: ".",
        start_url: ".",
        icons: [
          {
            src: "partybeats-icon.png",
            sizes: "512x512",
            type: "image/png",
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
