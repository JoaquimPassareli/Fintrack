import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
	plugins: [
		react(),
		tailwindcss(),
		VitePWA({
			registerType: "prompt", // não atualiza sozinho — notifica o usuário
			injectRegister: "auto",
			devOptions: {
				enabled: true, // permite testar em dev com `vite`
			},
			workbox: {
				// cacheia todos os assets do build
				globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
				cleanupOutdatedCaches: true,
			},
			manifest: {
				name: "FinTrack",
				short_name: "FinTrack",
				description: "Controle financeiro pessoal",
				theme_color: "#09090b",
				background_color: "#09090b",
				display: "standalone",
				icons: [
					{
						src: "/vite.svg",
						sizes: "any",
						type: "image/svg+xml",
						purpose: "any maskable",
					},
				],
			},
		}),
	],
	resolve: {
		alias: {
			"@": fileURLToPath(new URL("./src", import.meta.url)),
		},
	},
});
