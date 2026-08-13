import { Component, StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";

// Initialize Tauri API if available
if (typeof window !== "undefined") {
	console.log("[main] Checking for Tauri API...");
	// Tauri API is automatically available on window.__TAURI__ when running in Tauri
	if ((window as any).__TAURI__) {
		console.log("[main] Tauri API found!");
	} else {
		console.log("[main] Tauri API not found - likely running in web");
	}
}

// Captura erros de render e mostra mensagem em vez de tela preta
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
	state = { error: null };
	static getDerivedStateFromError(error: Error) { return { error }; }
	render() {
		if (this.state.error) {
			return (
				<div style={{ padding: 32, fontFamily: "sans-serif" }}>
					<h2 style={{ color: "#ef4444" }}>Algo deu errado</h2>
					<pre style={{ whiteSpace: "pre-wrap", fontSize: 13, color: "#6b7280" }}>
						{(this.state.error as Error).message}
					</pre>
					<button onClick={() => window.location.reload()} style={{ marginTop: 16 }}>
						Recarregar
					</button>
				</div>
			);
		}
		return this.props.children;
	}
}

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<ErrorBoundary>
			<BrowserRouter>
				<App />
			</BrowserRouter>
		</ErrorBoundary>
	</StrictMode>,
);
