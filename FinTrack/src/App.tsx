import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "@/components/protected-route";
import ForgotPasswordPage from "@/pages/ForgotPassword/ForgotPassword";
import HomePage from "@/pages/Home/Home";
import LoginPage from "@/pages/Login/Login";
import RegisterPage from "@/pages/Register/Register";
import { ThemeProvider } from "./components/theme-provider";

export default function App() {
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
			<Route path="/login" element={<LoginPage />} />
			<Route path="/registro" element={<RegisterPage />} />
			<Route path="/esqueci-senha" element={<ForgotPasswordPage />} />
			<Route path="*" element={<Navigate to="/login" replace />} />
		</Routes>
		</ThemeProvider>
	);
}
