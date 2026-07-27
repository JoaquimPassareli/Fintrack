import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { auth } from "@/lib/firebase";

type ProtectedRouteProps = {
	children: ReactNode;
};

export function ProtectedRoute({ children }: ProtectedRouteProps) {
	const [loading, setLoading] = useState(true);
	const [isAuthenticated, setIsAuthenticated] = useState(false);

	useEffect(() => {
		const unsubscribe = auth.onAuthStateChanged((user) => {
			setIsAuthenticated(!!user);
			setLoading(false);
		});

		return unsubscribe;
	}, []);

	if (loading) {
		return (
			<div className="flex min-h-svh items-center justify-center bg-zinc-100 dark:bg-zinc-950">
				<p className="text-sm text-muted-foreground">Carregando...</p>
			</div>
		);
	}

	if (!isAuthenticated) {
		return <Navigate to="/login" replace />;
	}

	return children;
}
