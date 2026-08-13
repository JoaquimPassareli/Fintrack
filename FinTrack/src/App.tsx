import { useEffect } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { ProtectedRoute } from "@/components/protected-route";
import ForgotPasswordPage from "@/pages/ForgotPassword/ForgotPassword";
import HomePage from "@/pages/Home/Home";
import LoginPage from "@/pages/Login/Login";
import RegisterPage from "@/pages/Register/Register";
import AdminPanel from "@/pages/Admin/AdminPanel";
import AdminSetup from "@/pages/Admin/AdminSetup";
import AdminUserDetail from "@/pages/Admin/AdminUserDetail";
import { ThemeProvider } from "./components/theme-provider";
import { getGoogleRedirectResult } from "@/lib/auth";
import { initializeAdmin } from "@/lib/admin";
import logger from "@/lib/logger";

// Inicializar admin na primeira vez
initializeAdmin("joaquim@admin.fintrack");

export default function App() {
	const navigate = useNavigate();

	// Only run once on mount to capture redirect result if coming from OAuth callback
	useEffect(() => {
		const checkRedirectResult = async () => {
			// Only check if we might be coming from a redirect (URL contains __/auth/callback or similar)
			if (window.location.href.includes("__/auth") || window.location.href.includes("code=")) {
				logger.log("[App] Detected potential OAuth callback URL");
				try {
					const result = await getGoogleRedirectResult();
					if (result && result.user) {
						logger.log(`[App] Successfully captured redirect result: ${result.user.email}`);
						navigate("/dashboard");
					}
				} catch (error) {
					logger.debug(`[App] Error checking redirect: ${error}`);
				}
			}
		};

		checkRedirectResult();
	}, [navigate]);

	return (
		<ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
		<Routes>
			<Route path="/" element={<Navigate to="/login" replace />} />
			<Route
				path="/dashboard"
				element={
					<ProtectedRoute>
						<HomePage />
					</ProtectedRoute>
				}
			/>
			<Route
				path="/admin"
				element={
					<ProtectedRoute>
						<AdminPanel />
					</ProtectedRoute>
				}
			/>
			<Route
				path="/admin/user/:userId"
				element={
					<ProtectedRoute>
						<AdminUserDetail />
					</ProtectedRoute>
				}
			/>
			<Route path="/admin/setup" element={<AdminSetup />} />
			<Route path="/login" element={<LoginPage />} />
			<Route path="/registro" element={<RegisterPage />} />
			<Route path="/esqueci-senha" element={<ForgotPasswordPage />} />
			<Route path="*" element={<Navigate to="/login" replace />} />
		</Routes>
		</ThemeProvider>
	);
}
